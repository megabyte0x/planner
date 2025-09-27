import express from 'express';
import logger from './utils/logger';
import { config } from './config';
import { EventMonitor } from './services/EventMonitor';
import { SwapExecutor } from './services/SwapExecutor';
import { PlanScheduler } from './services/PlanScheduler';
import { DepositEvent } from './types';

class DCAWatcherService {
  private app: express.Application;
  private eventMonitor: EventMonitor;
  private swapExecutor: SwapExecutor;
  private planScheduler: PlanScheduler;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.eventMonitor = new EventMonitor();
    this.swapExecutor = new SwapExecutor();
    this.planScheduler = new PlanScheduler();

    this.setupExpress();
    this.setupGracefulShutdown();
  }

  private setupExpress(): void {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Health check endpoint
    this.app.get('/health', async (_, res) => {
      try {
        const isEventMonitorHealthy = this.eventMonitor.isRunning();
        const isSwapExecutorHealthy = await this.swapExecutor.isHealthy();
        const isPlanSchedulerHealthy = this.planScheduler.isActive();

        const status = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          network: config.network.name,
          chainId: config.network.chainId,
          services: {
            eventMonitor: isEventMonitorHealthy ? 'running' : 'stopped',
            swapExecutor: isSwapExecutorHealthy ? 'healthy' : 'unhealthy',
            planScheduler: isPlanSchedulerHealthy ? 'active' : 'inactive'
          },
          walletInfo: this.swapExecutor.getWalletInfo(),
          activePlans: this.planScheduler.getActivePlansCount()
        };

        const allHealthy = isEventMonitorHealthy && isSwapExecutorHealthy && isPlanSchedulerHealthy;
        res.status(allHealthy ? 200 : 503).json(status);

      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(500).json({
          status: 'error',
          message: 'Health check failed'
        });
      }
    });

    // Status endpoint
    this.app.get('/status', (_req, res) => {
      try {
        const status = {
          network: config.network.name,
          chainId: config.network.chainId,
          contracts: {
            ethPlanner: config.network.contracts.ethPlanner,
            erc20Planner: config.network.contracts.erc20Planner
          },
          tokens: config.network.tokens,
          activePlans: this.planScheduler.getActivePlans(),
          isMonitoring: this.eventMonitor.isRunning()
        };

        res.json(status);
      } catch (error) {
        logger.error('Status endpoint failed', { error });
        res.status(500).json({
          error: 'Failed to get status'
        });
      }
    });

    // Force plan execution endpoint (for testing/admin)
    this.app.post('/admin/execute-plans', async (_req, res) => {
      try {
        logger.info('Manual plan execution requested');
        // This would trigger immediate plan execution check
        res.json({
          message: 'Plan execution check triggered',
          activePlans: this.planScheduler.getActivePlansCount()
        });
      } catch (error) {
        logger.error('Manual plan execution failed', { error });
        res.status(500).json({
          error: 'Failed to trigger plan execution'
        });
      }
    });

    // Error handling middleware
    this.app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error('Express error', { error, path: req.path });
      res.status(500).json({
        error: 'Internal server error'
      });
    });
  }

  private async handleDepositEvent(deposit: DepositEvent): Promise<void> {
    try {
      logger.info('Processing deposit event', {
        user: deposit.user,
        token: deposit.token,
        amount: deposit.amount,
        plannerContract: deposit.plannerContract
      });

      // Execute the deposit swap
      const result = await this.swapExecutor.executeDepositSwap(deposit);

      if (result.success) {
        logger.info('Deposit swap completed successfully', {
          user: deposit.user,
          txHash: result.transactionHash,
          outputAmount: result.outputAmount,
          gasUsed: result.gasUsed
        });
      } else {
        logger.error('Deposit swap failed', {
          user: deposit.user,
          error: result.error
        });
      }

    } catch (error) {
      logger.error('Error handling deposit event', {
        error,
        deposit
      });
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        return;
      }

      logger.info(`Received ${signal}, starting graceful shutdown...`);
      this.isShuttingDown = true;

      try {
        // Stop accepting new connections
        const server = this.app.listen(config.port);
        server.close();

        // Stop all services
        await this.eventMonitor.stopMonitoring();
        await this.planScheduler.stopScheduler();

        logger.info('Graceful shutdown completed');
        process.exit(0);

      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting DCA Watcher Service', {
        network: config.network.name,
        chainId: config.network.chainId,
        port: config.port
      });
      console.log("crossed 197")

      // Validate configuration
      await this.validateConfiguration();

      console.log("crossed 201")

      // Start services
      logger.info('Starting event monitoring...');
      await this.eventMonitor.startMonitoring(this.handleDepositEvent.bind(this));

      logger.info('Starting plan scheduler...');
      await this.planScheduler.startScheduler();

      // Start Express server
      const server = this.app.listen(config.port, () => {
        logger.info(`DCA Watcher Service running on port ${config.port}`);
        logger.info('Services started successfully:', {
          eventMonitor: this.eventMonitor.isRunning(),
          planScheduler: this.planScheduler.isActive(),
          walletAddress: this.swapExecutor.getWalletInfo().address
        });
      });

      server.on('error', (error) => {
        logger.error('Express server error', { error });
        process.exit(1);
      });

    } catch (error) {
      logger.error('Failed to start DCA Watcher Service', { error });
      process.exit(1);
    }
  }

  private async validateConfiguration(): Promise<void> {
    try {
      logger.info('Starting configuration validation...');

      // Check if wallet is healthy
      logger.info('Checking wallet health...');
      const walletHealthy = await this.swapExecutor.isHealthy();
      if (!walletHealthy) {
        throw new Error('Wallet health check failed - insufficient balance or connection issues');
      }
      logger.info('Wallet health check passed');

      // Validate contract addresses
      logger.info('Validating contract addresses...');
      const addressChecks = [
        { name: 'ethPlanner', address: config.network.contracts.ethPlanner },
        { name: 'erc20Planner', address: config.network.contracts.erc20Planner },
        { name: 'uniswapV3Router', address: config.network.contracts.uniswapV3Router },
        { name: 'uniswapV3Factory', address: config.network.contracts.uniswapV3Factory },
        { name: 'usdc', address: config.network.tokens.usdc },
        { name: 'dai', address: config.network.tokens.dai },
        { name: 'weth', address: config.network.tokens.weth },
        { name: 'cbbtc', address: config.network.tokens.cbbtc }
      ];

      for (const check of addressChecks) {
        logger.info(`Checking ${check.name}: ${check.address}`);
        if (!check.address || check.address === '0x0000000000000000000000000000000000000000') {
          throw new Error(`Invalid ${check.name} address: ${check.address}`);
        }
      }
      logger.info('All contract addresses validated');

      // Test latest block access
      logger.info('Testing blockchain connection...');
      const latestBlock = await this.eventMonitor.getLatestBlock();
      logger.info('Configuration validated successfully', {
        latestBlock,
        walletAddress: this.swapExecutor.getWalletInfo().address,
        network: config.network.name,
        chainId: config.network.chainId
      });
    } catch (error) {
      logger.error('Configuration validation failed', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
}

// Start the service
async function main() {
  const service = new DCAWatcherService();
  await service.start();
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to start service', { error });
    process.exit(1);
  });
}

export { DCAWatcherService };