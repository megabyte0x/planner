import { ethers } from 'ethers';
import logger from '../utils/logger';
import { config } from '../config';
import { RouteOptimizer } from './RouteOptimizer';
import { DepositStorage } from './DepositStorage';
import { DepositEvent, SwapExecutionResult, PlannerType } from '../types';

const ETH_PLANNER_ABI = [
  'function executeDepositSwap(address user, address stable, uint256 amountIn, uint256 minOut, bytes calldata path) external'
];

const ERC20_PLANNER_ABI = [
  'function executeDepositSwap(address user, address stable, uint256 amountIn, uint256 minOut, bytes calldata path) external'
];

export class SwapExecutor {
  private wallet: ethers.Wallet;
  private provider: ethers.providers.JsonRpcProvider;
  private ethPlannerContract: ethers.Contract;
  private erc20PlannerContract: ethers.Contract;
  private routeOptimizer: RouteOptimizer;
  private depositStorage: DepositStorage;
  private pendingDeposits: Map<string, DepositEvent> = new Map(); // Key: user+token, Value: deposit
  private processingDeposits: Set<string> = new Set(); // Set of user+token keys currently being processed

  // Minimum amounts in token units (not formatted)
  private readonly minAmounts = {
    usdc: ethers.utils.parseUnits('0.1', 6), // 0.1 USDC minimum
    dai: ethers.utils.parseUnits('0.1', 18), // 0.1 DAI minimum
  };

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
    this.depositStorage = new DepositStorage();
  }

  async executeDepositSwap(deposit: DepositEvent): Promise<SwapExecutionResult> {
    const depositKey = this.getDepositKey(deposit);

    try {
      // Check if deposit amount meets minimum requirements
      const minAmountError = this.validateMinimumAmount(deposit);
      if (minAmountError) {
        logger.warn('Deposit below minimum amount', {
          user: deposit.user,
          token: deposit.token,
          amount: deposit.amount,
          error: minAmountError
        });

        // Save as failed deposit for potential future retry
        await this.depositStorage.saveFailedDeposit(deposit, minAmountError);

        return {
          success: false,
          error: minAmountError
        };
      }
      logger.info('Starting deposit swap execution', {
        user: deposit.user,
        token: deposit.token,
        amount: deposit.amount,
        plannerContract: deposit.plannerContract
      });

      // Check if there are pending deposits for this user+token combination
      if (this.pendingDeposits.has(depositKey)) {
        const existingDeposit = this.pendingDeposits.get(depositKey)!;

        // If the new deposit is newer (higher block number), replace the old one
        if (deposit.blockNumber > existingDeposit.blockNumber) {
          logger.info('Replacing older pending deposit with newer one', {
            oldBlock: existingDeposit.blockNumber,
            newBlock: deposit.blockNumber,
            user: deposit.user,
            token: deposit.token
          });
          this.pendingDeposits.set(depositKey, deposit);
        } else {
          logger.info('Ignoring older deposit, newer one already pending', {
            existingBlock: existingDeposit.blockNumber,
            newBlock: deposit.blockNumber,
            user: deposit.user,
            token: deposit.token
          });
          return {
            success: false,
            error: 'Newer deposit already pending for this user+token combination'
          };
        }
      } else {
        // Add to pending deposits
        this.pendingDeposits.set(depositKey, deposit);
      }

      // Check if this user+token combination is currently being processed
      if (this.processingDeposits.has(depositKey)) {
        logger.info('Deposit already being processed, skipping', {
          user: deposit.user,
          token: deposit.token
        });
        return {
          success: false,
          error: 'Deposit already being processed'
        };
      }

      // Mark as processing and execute
      this.processingDeposits.add(depositKey);

      try {
        const result = await this.executeDepositSwapInternal(deposit);

        // Remove from pending and processing on completion
        this.pendingDeposits.delete(depositKey);
        this.processingDeposits.delete(depositKey);

        // Remove from failed deposits if successful
        if (result.success) {
          await this.depositStorage.removeSuccessfulDeposit(deposit);
        }

        return result;
      } catch (error) {
        // Remove from processing but keep in pending on failure for potential retry
        this.processingDeposits.delete(depositKey);

        // Save failed deposit for retry
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.depositStorage.saveFailedDeposit(deposit, errorMessage);

        throw error;
      }

    } catch (error) {
      logger.error('Failed to execute deposit swap', {
        error,
        deposit
      });

      // Remove from processing and pending on error
      this.processingDeposits.delete(depositKey);
      this.pendingDeposits.delete(depositKey);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Save failed deposit for retry (if not already saved above)
      await this.depositStorage.saveFailedDeposit(deposit, errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private async executeDepositSwapInternal(deposit: DepositEvent): Promise<SwapExecutionResult> {
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

    // Calculate minimum amount out with price feed validation
    const minAmountOut = await this.routeOptimizer.calculateMinAmountOutWithPrice(
      deposit.token,
      targetToken,
      ethers.utils.formatUnits(deposit.amount, this.getTokenDecimals(deposit.token)),
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
  }

  private getDepositKey(deposit: DepositEvent): string {
    return `${deposit.user.toLowerCase()}_${deposit.token.toLowerCase()}_${deposit.plannerContract.toLowerCase()}`;
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
      const targetDecimals = 18; // Both ETH and CBBTC use 18 decimals

      // Truncate minAmountOut to target decimals to avoid "fractional component exceeds decimals" error
      const truncatedMinAmountOut = parseFloat(minAmountOut).toFixed(targetDecimals);
      const minAmountOutParsed = ethers.utils.parseUnits(truncatedMinAmountOut, targetDecimals);

      // Estimate gas before execution
      const gasEstimate = await contract.estimateGas.executeDepositSwap(
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
        // {
        //   gasLimit: 450000
        // }
      );

      logger.info('Multi-hop swap transaction sent', {
        txHash: tx.hash,
        gasEstimate: gasEstimate.toString()
        // gasEstimate: 300000
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
      const targetDecimals = 18; // Both ETH and CBBTC use 18 decimals

      // Truncate minAmountOut to target decimals to avoid "fractional component exceeds decimals" error
      const truncatedMinAmountOut = parseFloat(minAmountOut).toFixed(targetDecimals);
      const minAmountOutParsed = ethers.utils.parseUnits(truncatedMinAmountOut, targetDecimals);

      // Create single-hop path for executeDepositSwap
      const targetToken = this.getTargetToken(plannerType);
      console.log("targetToken ", targetToken)
      const singleHopPath = this.createSingleHopPath(deposit.token, targetToken, fee);

      console.log("deposit: ", deposit);
      console.log("minAmout: ", minAmountOutParsed.toNumber());
      console.log("singleHop: ", singleHopPath);

      // Estimate gas before execution
      const gasEstimate = await contract.estimateGas.executeDepositSwap(
        deposit.user,
        deposit.token,
        deposit.amount,
        minAmountOutParsed,
        singleHopPath
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
        singleHopPath,
        {
          gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
          gasPrice: gasPrice.gasPrice
        },
        // { gasLimit: 300000 }
      );

      logger.info('Single-hop swap transaction sent', {
        txHash: tx.hash,
        fee,
        // gasEstimate: gasEstimate.toString()
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

  private createSingleHopPath(tokenIn: string, tokenOut: string, fee: number): string {
    // Create Uniswap V3 path for single hop: tokenIn + fee + tokenOut using solidityPack for correct 43-byte encoding
    const path = ethers.utils.solidityPack(
      ["address", "uint24", "address"],
      [tokenIn, fee, tokenOut]
    );
    return path;
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

  // Get pending deposits info
  getPendingDepositsInfo(): { pendingCount: number; processingCount: number; deposits: DepositEvent[] } {
    return {
      pendingCount: this.pendingDeposits.size,
      processingCount: this.processingDeposits.size,
      deposits: Array.from(this.pendingDeposits.values())
    };
  }

  // Validate minimum deposit amount
  private validateMinimumAmount(deposit: DepositEvent): string | null {
    const tokenAddress = deposit.token.toLowerCase();
    const amount = ethers.BigNumber.from(deposit.amount);

    if (tokenAddress === config.network.tokens.usdc.toLowerCase()) {
      if (amount.lt(this.minAmounts.usdc)) {
        const minFormatted = ethers.utils.formatUnits(this.minAmounts.usdc, 6);
        const actualFormatted = ethers.utils.formatUnits(amount, 6);
        return `USDC amount ${actualFormatted} below minimum ${minFormatted}`;
      }
    } else if (tokenAddress === config.network.tokens.dai.toLowerCase()) {
      if (amount.lt(this.minAmounts.dai)) {
        const minFormatted = ethers.utils.formatUnits(this.minAmounts.dai, 18);
        const actualFormatted = ethers.utils.formatUnits(amount, 18);
        return `DAI amount ${actualFormatted} below minimum ${minFormatted}`;
      }
    }

    return null;
  }

  // Retry failed deposits on server startup
  async retryFailedDeposits(): Promise<void> {
    try {
      logger.info('Starting retry of failed deposits');

      const retryableDeposits = await this.depositStorage.getRetryableDeposits();

      if (retryableDeposits.length === 0) {
        logger.info('No deposits to retry');
        return;
      }

      logger.info(`Found ${retryableDeposits.length} deposits to retry`);

      for (const failedDeposit of retryableDeposits) {
        try {
          // Mark retry attempt
          await this.depositStorage.markRetryAttempt(failedDeposit);

          // Extract deposit data (remove retry metadata)
          const deposit: DepositEvent = {
            user: failedDeposit.user,
            token: failedDeposit.token,
            amount: failedDeposit.amount,
            blockNumber: failedDeposit.blockNumber,
            transactionHash: failedDeposit.transactionHash,
            plannerContract: failedDeposit.plannerContract
          };

          logger.info(`Retrying deposit (attempt ${failedDeposit.retryCount + 1})`, {
            user: deposit.user,
            token: deposit.token,
            amount: deposit.amount,
            originalError: failedDeposit.error
          });

          // Execute the deposit swap
          const result = await this.executeDepositSwap(deposit);

          if (result.success) {
            logger.info('Retry successful', {
              user: deposit.user,
              txHash: result.transactionHash
            });
          } else {
            logger.warn('Retry failed', {
              user: deposit.user,
              error: result.error
            });
          }

          // Add small delay between retries to avoid overwhelming the network
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          logger.error('Error during deposit retry', {
            error,
            deposit: failedDeposit
          });
        }
      }

      logger.info('Finished retrying failed deposits');
    } catch (error) {
      logger.error('Failed to retry failed deposits', { error });
    }
  }

  // Get failed deposits statistics
  async getFailedDepositsStats(): Promise<{
    total: number;
    retryable: number;
    maxRetriesExceeded: number;
  }> {
    return await this.depositStorage.getFailedDepositsStats();
  }

  // Clean up old failed deposits
  async cleanupOldFailedDeposits(): Promise<number> {
    return await this.depositStorage.cleanupOldFailedDeposits();
  }

  // Clear failed/stuck deposits (admin function)
  clearStuckDeposits(): void {
    logger.info('Clearing stuck deposits', {
      pendingCount: this.pendingDeposits.size,
      processingCount: this.processingDeposits.size
    });

    this.pendingDeposits.clear();
    this.processingDeposits.clear();
  }
}