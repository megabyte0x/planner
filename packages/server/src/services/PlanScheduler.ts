import { ethers } from 'ethers';
import cron from 'node-cron';
import logger from '../utils/logger';
import { config } from '../config';
import { RouteOptimizer } from './RouteOptimizer';
import { Plan, SwapExecutionResult, PlannerType } from '../types';

const PLANNER_ABI = [
  'function plans(address user) view returns (tuple(address stable, uint256 amount, uint256 interval, uint256 nextExec, bool active))',
  'function executePlan(address user, uint256 minOut, bytes calldata path) external',
  'function executePlanSingleIn(address user, uint256 minOut, uint24 fee) external',
  'event PlanCreated(address indexed user, address indexed stable, uint256 amount, uint256 interval, uint256 firstExecAt)',
  'event PlanCancelled(address indexed user)',
  'event PlanExecuted(address indexed user, address indexed stable, uint256 amountIn, uint256 amountOut, uint256 nextExecAt)'
];

interface PlanExecution {
  user: string;
  plannerType: PlannerType;
  plan: Plan;
  nextExecution: Date;
}

export class PlanScheduler {
  private provider: ethers.providers.JsonRpcProvider;
  private ethPlannerContract: ethers.Contract;
  private erc20PlannerContract: ethers.Contract;
  private routeOptimizer: RouteOptimizer;
  private activePlans: Map<string, PlanExecution> = new Map();
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcHttp);

    this.ethPlannerContract = new ethers.Contract(
      config.network.contracts.ethPlanner,
      PLANNER_ABI,
      this.provider
    );

    this.erc20PlannerContract = new ethers.Contract(
      config.network.contracts.erc20Planner,
      PLANNER_ABI,
      this.provider
    );

    this.routeOptimizer = new RouteOptimizer();
  }

  async startScheduler(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Plan scheduler is already running');
      return;
    }

    logger.info('Starting DCA plan scheduler...');
    this.isRunning = true;

    try {
      // Load existing plans
      await this.loadExistingPlans();

      // Set up event listeners for plan changes
      this.setupEventListeners();

      // Start the cron job for plan execution
      this.startCronJob();

      logger.info('DCA plan scheduler started successfully');
    } catch (error) {
      logger.error('Failed to start plan scheduler', { error });
      this.isRunning = false;
      throw error;
    }
  }

  async stopScheduler(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping DCA plan scheduler...');
    this.isRunning = false;

    // Stop cron job
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    // Remove event listeners
    this.ethPlannerContract.removeAllListeners();
    this.erc20PlannerContract.removeAllListeners();

    // Clear active plans
    this.activePlans.clear();

    logger.info('DCA plan scheduler stopped');
  }

  private async loadExistingPlans(): Promise<void> {
    logger.info('Loading existing DCA plans...');

    try {
      // Get plan events from both contracts to find all users with plans
      const [ethPlanEvents, erc20PlanEvents] = await Promise.all([
        this.getPlanEvents(this.ethPlannerContract, PlannerType.ETH),
        this.getPlanEvents(this.erc20PlannerContract, PlannerType.ERC20)
      ]);

      const allEvents = [...ethPlanEvents, ...erc20PlanEvents];

      // Process each unique user
      const users = new Set(allEvents.map(event => event.user));

      for (const user of users) {
        await Promise.all([
          this.loadUserPlan(user, PlannerType.ETH),
          this.loadUserPlan(user, PlannerType.ERC20)
        ]);
      }

      logger.info(`Loaded ${this.activePlans.size} active DCA plans`);

    } catch (error) {
      logger.error('Failed to load existing plans', { error });
      throw error;
    }
  }

  private async getPlanEvents(contract: ethers.Contract, plannerType: PlannerType): Promise<Array<{ user: string }>> {
    // When webhooks are enabled, we don't query for historical events
    // Instead, we rely on webhook notifications for new plan events
    if (config.webhook?.enabled) {
      logger.info(`Skipping historical plan event query for ${plannerType} - webhooks enabled`);
      return [];
    }

    try {
      const currentBlock = await this.provider.getBlockNumber();
      // Use smaller block range to avoid Alchemy free tier limits
      const fromBlock = Math.max(0, currentBlock - 10); // Look back only 10 blocks

      const filter = contract.filters.PlanCreated();
      const events = await contract.queryFilter(filter, fromBlock);

      return events.map(event => {
        return {
          user: event.args?.[0] || ''
        };
      });
    } catch (error) {
      logger.error(`Failed to get plan events for ${plannerType}`, { error });
      return [];
    }
  }

  private async loadUserPlan(user: string, plannerType: PlannerType): Promise<void> {
    try {
      const contract = plannerType === PlannerType.ETH
        ? this.ethPlannerContract
        : this.erc20PlannerContract;

      const planData = await contract.plans(user);

      // Check if plan is active
      if (!planData.active) {
        return;
      }

      const plan: Plan = {
        stable: planData.stable,
        amount: planData.amount.toString(),
        interval: Number(planData.interval),
        nextExec: Number(planData.nextExec),
        active: planData.active
      };

      const planKey = `${user}-${plannerType}`;
      const nextExecution = new Date(plan.nextExec * 1000);

      this.activePlans.set(planKey, {
        user,
        plannerType,
        plan,
        nextExecution
      });

      logger.info('Loaded user plan', {
        user,
        plannerType,
        stable: plan.stable,
        amount: ethers.utils.formatUnits(plan.amount, this.getTokenDecimals(plan.stable)),
        nextExecution: nextExecution.toISOString()
      });

    } catch (error) {
      logger.error('Failed to load user plan', { error, user, plannerType });
    }
  }

  private setupEventListeners(): void {
    // Listen for new plans
    this.ethPlannerContract.on('PlanCreated', async (user, stable, amount, interval, firstExecAt) => {
      await this.handlePlanCreated(user, stable, amount, interval, firstExecAt, PlannerType.ETH);
    });

    this.erc20PlannerContract.on('PlanCreated', async (user, stable, amount, interval, firstExecAt) => {
      await this.handlePlanCreated(user, stable, amount, interval, firstExecAt, PlannerType.ERC20);
    });

    // Listen for plan cancellations
    this.ethPlannerContract.on('PlanCancelled', async (user) => {
      await this.handlePlanCancelled(user, PlannerType.ETH);
    });

    this.erc20PlannerContract.on('PlanCancelled', async (user) => {
      await this.handlePlanCancelled(user, PlannerType.ERC20);
    });

    // Listen for plan executions
    this.ethPlannerContract.on('PlanExecuted', async (user, stable, amountIn, amountOut, nextExecAt) => {
      await this.handlePlanExecuted(user, stable, amountIn, amountOut, nextExecAt, PlannerType.ETH);
    });

    this.erc20PlannerContract.on('PlanExecuted', async (user, stable, amountIn, amountOut, nextExecAt) => {
      await this.handlePlanExecuted(user, stable, amountIn, amountOut, nextExecAt, PlannerType.ERC20);
    });

    logger.info('Event listeners set up for plan management');
  }

  private async handlePlanCreated(
    user: string,
    stable: string,
    amount: ethers.BigNumber,
    interval: ethers.BigNumber,
    firstExecAt: ethers.BigNumber,
    plannerType: PlannerType
  ): Promise<void> {
    logger.info('New plan created', {
      user,
      stable,
      amount: ethers.utils.formatUnits(amount, this.getTokenDecimals(stable)),
      interval: Number(interval),
      firstExecAt: Number(firstExecAt),
      plannerType
    });

    const plan: Plan = {
      stable,
      amount: amount.toString(),
      interval: Number(interval),
      nextExec: Number(firstExecAt),
      active: true
    };

    const planKey = `${user}-${plannerType}`;
    this.activePlans.set(planKey, {
      user,
      plannerType,
      plan,
      nextExecution: new Date(Number(firstExecAt) * 1000)
    });
  }

  private async handlePlanCancelled(user: string, plannerType: PlannerType): Promise<void> {
    logger.info('Plan cancelled', { user, plannerType });

    const planKey = `${user}-${plannerType}`;
    this.activePlans.delete(planKey);
  }

  private async handlePlanExecuted(
    user: string,
    stable: string,
    amountIn: ethers.BigNumber,
    amountOut: ethers.BigNumber,
    nextExecAt: ethers.BigNumber,
    plannerType: PlannerType
  ): Promise<void> {
    logger.info('Plan executed', {
      user,
      stable,
      amountIn: ethers.utils.formatUnits(amountIn, this.getTokenDecimals(stable)),
      amountOut: amountOut.toString(),
      nextExecAt: Number(nextExecAt),
      plannerType
    });

    // Update next execution time
    const planKey = `${user}-${plannerType}`;
    const planExecution = this.activePlans.get(planKey);

    if (planExecution) {
      planExecution.plan.nextExec = Number(nextExecAt);
      planExecution.nextExecution = new Date(Number(nextExecAt) * 1000);
      this.activePlans.set(planKey, planExecution);
    }
  }

  private startCronJob(): void {
    // Run every 30 seconds (or as configured)
    const interval = Math.max(10, config.schedulerIntervalSeconds); // Minimum 10 seconds

    this.cronJob = cron.schedule(`*/${interval} * * * * *`, async () => {
      await this.checkAndExecuteDuePlans();
    });

    logger.info(`Cron job started with ${interval}s interval`);
  }

  private async checkAndExecuteDuePlans(): Promise<void> {
    if (!this.isRunning) return;

    const now = Date.now();
    const duePlans: PlanExecution[] = [];

    // Find plans that are due for execution
    for (const [_planKey, planExecution] of this.activePlans) {
      if (planExecution.nextExecution.getTime() <= now) {
        duePlans.push(planExecution);
      }
    }

    if (duePlans.length === 0) {
      return;
    }

    logger.info(`Found ${duePlans.length} plans due for execution`);

    // Execute plans in parallel (with reasonable concurrency)
    const concurrencyLimit = 3;
    for (let i = 0; i < duePlans.length; i += concurrencyLimit) {
      const batch = duePlans.slice(i, i + concurrencyLimit);
      await Promise.allSettled(
        batch.map(planExecution => this.executePlan(planExecution))
      );
    }
  }

  private async executePlan(planExecution: PlanExecution): Promise<SwapExecutionResult> {
    const { user, plannerType, plan } = planExecution;

    try {
      logger.info('Executing DCA plan', {
        user,
        plannerType,
        stable: plan.stable,
        amount: ethers.utils.formatUnits(plan.amount, this.getTokenDecimals(plan.stable))
      });

      // Determine target token
      const targetToken = plannerType === PlannerType.ETH
        ? config.network.tokens.weth
        : config.network.tokens.cbbtc;

      // Find optimal route
      const route = await this.routeOptimizer.findOptimalRoute(
        plan.stable,
        targetToken,
        ethers.utils.formatUnits(plan.amount, this.getTokenDecimals(plan.stable))
      );

      // Calculate minimum amount out
      const minAmountOut = this.routeOptimizer.calculateMinAmountOut(
        route.expectedOutput,
        config.slippageBps
      );

      // Execute the plan
      const contract = plannerType === PlannerType.ETH
        ? this.ethPlannerContract
        : this.erc20PlannerContract;

      let tx;
      if (route.isMultiHop && route.path) {
        // Multi-hop execution
        const targetDecimals = plannerType === PlannerType.ETH ? 18 : 8;
        const minAmountOutParsed = ethers.utils.parseUnits(minAmountOut, targetDecimals);

        tx = await contract.executePlan(user, minAmountOutParsed, route.path);
      } else if (route.fee) {
        // Single-hop execution
        const targetDecimals = plannerType === PlannerType.ETH ? 18 : 8;
        const minAmountOutParsed = ethers.utils.parseUnits(minAmountOut, targetDecimals);

        tx = await contract.executePlanSingleIn(user, minAmountOutParsed, route.fee);
      } else {
        throw new Error('Invalid route configuration');
      }

      const receipt = await tx.wait();

      logger.info('DCA plan executed successfully', {
        user,
        plannerType,
        txHash: tx.hash,
        gasUsed: receipt?.gasUsed.toString()
      });

      return {
        success: true,
        transactionHash: tx.hash,
        outputAmount: route.expectedOutput,
        gasUsed: receipt?.gasUsed.toString()
      };

    } catch (error) {
      logger.error('Failed to execute DCA plan', {
        error,
        user,
        plannerType
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getTokenDecimals(tokenAddress: string): number {
    const tokens = config.network.tokens;

    if (tokenAddress.toLowerCase() === tokens.usdc.toLowerCase()) return 6;
    if (tokenAddress.toLowerCase() === tokens.dai.toLowerCase()) return 18;
    if (tokenAddress.toLowerCase() === tokens.weth.toLowerCase()) return 18;
    if (tokenAddress.toLowerCase() === tokens.cbbtc.toLowerCase()) return 8;

    throw new Error(`Unknown token decimals for: ${tokenAddress}`);
  }

  // Public methods for status and management
  getActivePlansCount(): number {
    return this.activePlans.size;
  }

  getActivePlans(): Array<{ user: string, plannerType: PlannerType, nextExecution: string }> {
    return Array.from(this.activePlans.entries()).map(([_key, execution]) => ({
      user: execution.user,
      plannerType: execution.plannerType,
      nextExecution: execution.nextExecution.toISOString()
    }));
  }

  isActive(): boolean {
    return this.isRunning;
  }

  // Method to handle plan events received via webhooks
  async handlePlanEventFromWebhook(eventData: {
    user: string;
    stable: string;
    amount: string;
    interval: string;
    firstExecAt: string;
    plannerContract: string;
  }): Promise<void> {
    try {
      // Determine planner type based on contract address
      const plannerType = eventData.plannerContract.toLowerCase() === config.network.contracts.ethPlanner.toLowerCase()
        ? PlannerType.ETH
        : PlannerType.ERC20;

      const plan: Plan = {
        stable: eventData.stable,
        amount: eventData.amount,
        interval: Number(eventData.interval),
        nextExec: Number(eventData.firstExecAt),
        active: true
      };

      const planKey = `${eventData.user}-${plannerType}`;
      this.activePlans.set(planKey, {
        user: eventData.user,
        plannerType,
        plan,
        nextExecution: new Date(Number(eventData.firstExecAt) * 1000)
      });

      logger.info('Plan added from webhook', {
        user: eventData.user,
        plannerType,
        stable: plan.stable,
        amount: ethers.utils.formatUnits(plan.amount, this.getTokenDecimals(plan.stable)),
        nextExecution: new Date(plan.nextExec * 1000).toISOString()
      });

    } catch (error) {
      logger.error('Failed to handle plan event from webhook', { error, eventData });
    }
  }
}