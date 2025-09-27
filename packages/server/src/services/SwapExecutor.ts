import { ethers } from 'ethers';
import logger from '../utils/logger';
import { config } from '../config';
import { RouteOptimizer } from './RouteOptimizer';
import { DepositEvent, SwapExecutionResult, PlannerType } from '../types';

const ETH_PLANNER_ABI = [
  'function executeDepositSwap(address user, address stable, uint256 amountIn, uint256 minOut, bytes calldata path) external',
  'function executeDepositSwapSingleIn(address user, address stable, uint256 amountIn, uint256 minOut, uint24 fee) external'
];

const ERC20_PLANNER_ABI = [
  'function executeDepositSwap(address user, address stable, uint256 amountIn, uint256 minOut, bytes calldata path) external',
  'function executeDepositSwapSingleIn(address user, address stable, uint256 amountIn, uint256 minOut, uint24 fee) external'
];

export class SwapExecutor {
  private wallet: ethers.Wallet;
  private provider: ethers.providers.JsonRpcProvider;
  private ethPlannerContract: ethers.Contract;
  private erc20PlannerContract: ethers.Contract;
  private routeOptimizer: RouteOptimizer;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcHttp);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);

    this.ethPlannerContract = new ethers.Contract(
      config.network.contracts.ethPlanner,
      ETH_PLANNER_ABI,
      this.wallet
    );

    this.erc20PlannerContract = new ethers.Contract(
      config.network.contracts.erc20Planner,
      ERC20_PLANNER_ABI,
      this.wallet
    );

    this.routeOptimizer = new RouteOptimizer();
  }

  async executeDepositSwap(deposit: DepositEvent): Promise<SwapExecutionResult> {
    try {
      logger.info('Starting deposit swap execution', {
        user: deposit.user,
        token: deposit.token,
        amount: deposit.amount,
        plannerContract: deposit.plannerContract
      });

      // Determine planner type and target token
      const plannerType = this.getPlannerType(deposit.plannerContract);
      const targetToken = this.getTargetToken(plannerType);

      // Wait for confirmations if configured
      if (config.confirmations > 0) {
        await this.waitForConfirmations(deposit.transactionHash, config.confirmations);
      }

      // Find optimal route
      const route = await this.routeOptimizer.findOptimalRoute(
        deposit.token,
        targetToken,
        ethers.utils.formatUnits(deposit.amount, this.getTokenDecimals(deposit.token))
      );

      // Calculate minimum amount out with slippage protection
      const minAmountOut = this.routeOptimizer.calculateMinAmountOut(
        route.expectedOutput,
        config.slippageBps
      );

      // Execute the swap based on route type
      let result: SwapExecutionResult;
      if (route.isMultiHop && route.path) {
        result = await this.executeMultiHopSwap(
          deposit,
          plannerType,
          minAmountOut,
          route.path
        );
      } else if (route.fee) {
        result = await this.executeSingleHopSwap(
          deposit,
          plannerType,
          minAmountOut,
          route.fee
        );
      } else {
        throw new Error('Invalid route configuration');
      }

      logger.info('Deposit swap execution completed', {
        success: result.success,
        txHash: result.transactionHash,
        outputAmount: result.outputAmount,
        gasUsed: result.gasUsed
      });

      return result;

    } catch (error) {
      logger.error('Failed to execute deposit swap', {
        error,
        deposit
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeMultiHopSwap(
    deposit: DepositEvent,
    plannerType: PlannerType,
    minAmountOut: string,
    path: string
  ): Promise<SwapExecutionResult> {
    try {
      const contract = plannerType === PlannerType.ETH
        ? this.ethPlannerContract
        : this.erc20PlannerContract;

      // Parse minAmountOut to correct decimals
      const targetDecimals = plannerType === PlannerType.ETH ? 18 : 8; // ETH: 18, cbBTC: 8
      const minAmountOutParsed = ethers.utils.parseUnits(minAmountOut, targetDecimals);

      // Estimate gas before execution
      const gasEstimate = await contract.executeDepositSwap.estimateGas(
        deposit.user,
        deposit.token,
        deposit.amount,
        minAmountOutParsed,
        path
      );

      // Check gas price
      const gasPrice = await this.provider.getFeeData();
      if (gasPrice.gasPrice && gasPrice.gasPrice.gt(ethers.utils.parseUnits(config.maxGasPriceGwei.toString(), 'gwei'))) {
        throw new Error(`Gas price too high: ${ethers.utils.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`);
      }

      // Execute the swap
      const tx = await contract.executeDepositSwap(
        deposit.user,
        deposit.token,
        deposit.amount,
        minAmountOutParsed,
        path,
        {
          gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
          gasPrice: gasPrice.gasPrice
        }
      );

      logger.info('Multi-hop swap transaction sent', {
        txHash: tx.hash,
        gasEstimate: gasEstimate.toString()
      });

      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash,
        outputAmount: minAmountOut, // Actual amount would need to be parsed from logs
        gasUsed: receipt?.gasUsed.toString()
      };

    } catch (error) {
      logger.error('Multi-hop swap execution failed', { error });
      throw error;
    }
  }

  private async executeSingleHopSwap(
    deposit: DepositEvent,
    plannerType: PlannerType,
    minAmountOut: string,
    fee: number
  ): Promise<SwapExecutionResult> {
    try {
      const contract = plannerType === PlannerType.ETH
        ? this.ethPlannerContract
        : this.erc20PlannerContract;

      // Parse minAmountOut to correct decimals
      const targetDecimals = plannerType === PlannerType.ETH ? 18 : 8;
      const minAmountOutParsed = ethers.utils.parseUnits(minAmountOut, targetDecimals);

      // Estimate gas before execution
      const gasEstimate = await contract.executeDepositSwapSingleIn.estimateGas(
        deposit.user,
        deposit.token,
        deposit.amount,
        minAmountOutParsed,
        fee
      );

      // Check gas price
      const gasPrice = await this.provider.getFeeData();
      if (gasPrice.gasPrice && gasPrice.gasPrice.gt(ethers.utils.parseUnits(config.maxGasPriceGwei.toString(), 'gwei'))) {
        throw new Error(`Gas price too high: ${ethers.utils.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`);
      }

      // Execute the swap
      const tx = await contract.executeDepositSwapSingleIn(
        deposit.user,
        deposit.token,
        deposit.amount,
        minAmountOutParsed,
        fee,
        {
          gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
          gasPrice: gasPrice.gasPrice
        }
      );

      logger.info('Single-hop swap transaction sent', {
        txHash: tx.hash,
        fee,
        gasEstimate: gasEstimate.toString()
      });

      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash,
        outputAmount: minAmountOut,
        gasUsed: receipt?.gasUsed.toString()
      };

    } catch (error) {
      logger.error('Single-hop swap execution failed', { error });
      throw error;
    }
  }

  private getPlannerType(plannerContract: string): PlannerType {
    if (plannerContract.toLowerCase() === config.network.contracts.ethPlanner.toLowerCase()) {
      return PlannerType.ETH;
    } else if (plannerContract.toLowerCase() === config.network.contracts.erc20Planner.toLowerCase()) {
      return PlannerType.ERC20;
    } else {
      throw new Error(`Unknown planner contract: ${plannerContract}`);
    }
  }

  private getTargetToken(plannerType: PlannerType): string {
    switch (plannerType) {
      case PlannerType.ETH:
        return config.network.tokens.weth; // ETH planner targets WETH (which gets unwrapped)
      case PlannerType.ERC20:
        return config.network.tokens.cbbtc; // ERC20 planner targets cbBTC
      default:
        throw new Error(`Unknown planner type: ${plannerType}`);
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

  private async waitForConfirmations(txHash: string, confirmations: number): Promise<void> {
    if (confirmations <= 0) return;

    logger.info(`Waiting for ${confirmations} confirmations`, { txHash });

    try {
      const receipt = await this.provider.waitForTransaction(txHash, confirmations);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      logger.info(`Transaction confirmed with ${confirmations} confirmations`, {
        txHash,
        blockNumber: receipt.blockNumber
      });
    } catch (error) {
      logger.error('Failed to wait for confirmations', { error, txHash });
      throw error;
    }
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      // Check wallet balance
      const balance = await this.provider.getBalance(this.wallet.address);
      if (balance.lt(ethers.utils.parseEther('0.0001'))) {
        logger.warn('Low wallet balance', {
          balance: ethers.utils.formatEther(balance),
          address: this.wallet.address
        });
        return false;
      }

      // Check provider connection
      await this.provider.getBlockNumber();

      return true;
    } catch (error) {
      logger.error('Health check failed', { error });
      return false;
    }
  }

  // Get wallet info
  getWalletInfo(): { address: string; chainId: number } {
    return {
      address: this.wallet.address,
      chainId: config.network.chainId
    };
  }
}