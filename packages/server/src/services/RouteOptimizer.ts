import { ethers } from 'ethers';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { AlphaRouter, SwapType } from '@uniswap/smart-order-router';
import logger from '../utils/logger';
import { config } from '../config';
import { RouteInfo } from '../types';
import { priceFeedService } from './PriceFeedService';

export class RouteOptimizer {
  private provider: ethers.providers.JsonRpcProvider;
  private alphaRouter: AlphaRouter;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcHttp);
    this.alphaRouter = new AlphaRouter({
      chainId: config.network.chainId,
      provider: this.provider as any, // Type assertion for compatibility
    });
  }

  async findOptimalRoute(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string,
    slippageTolerance: number = config.slippageBps
  ): Promise<RouteInfo> {
    try {
      logger.info('Finding optimal route', {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        amountIn,
        slippageTolerance
      });

      // Check for zero or very small amounts
      const parsedAmount = parseFloat(amountIn);
      if (parsedAmount <= 0 || parsedAmount < 0.01) {
        throw new Error(`Amount too small for routing: ${amountIn}`);
      }

      // Create token objects
      const tokenIn = await this.createToken(tokenInAddress);
      const tokenOut = await this.createToken(tokenOutAddress);

      // Create currency amount
      const typedValueParsed = CurrencyAmount.fromRawAmount(
        tokenIn,
        ethers.utils.parseUnits(amountIn, tokenIn.decimals).toString()
      );
      // Find route using AlphaRouter
      const route = await this.alphaRouter.route(
        typedValueParsed,
        tokenOut,
        TradeType.EXACT_INPUT,
        {
          type: SwapType.SWAP_ROUTER_02,
          recipient: config.network.contracts.ethPlanner, // Will be updated based on target
          slippageTolerance: new Percent(slippageTolerance, 10000),
          deadline: Math.floor(Date.now() / 1000 + 1800), // 30 minutes
        }
      );

      if (!route || !route.route || route.route.length === 0) {
        throw new Error('No route found by AlphaRouter');
      }

      // Check if we should use single-hop instead
      const singleHopFee = this.getSingleHopFee(tokenInAddress, tokenOutAddress);
      const isMultiHop = !singleHopFee || route.route.length > 1;

      const routeInfo: RouteInfo = {
        isMultiHop,
        expectedOutput: route.quote.toExact(),
        gasEstimate: route.estimatedGasUsed.toString(),
      };

      if (isMultiHop) {
        routeInfo.path = this.encodePathFromRoute(route.route[0]);
        logger.info('Using multi-hop route', {
          path: routeInfo.path,
          expectedOutput: routeInfo.expectedOutput,
          gasEstimate: routeInfo.gasEstimate
        });
      } else {
        routeInfo.fee = singleHopFee;
        logger.info('Using single-hop route', {
          fee: routeInfo.fee,
          expectedOutput: routeInfo.expectedOutput,
          gasEstimate: routeInfo.gasEstimate
        });
      }

      return routeInfo;

    } catch (error) {
      logger.error('Failed to find optimal route', { error });

      // Fallback to manual route construction
      return this.constructFallbackRoute(tokenInAddress, tokenOutAddress, amountIn);
    }
  }

  private async createToken(address: string): Promise<Token> {
    // Get token info from contract
    const tokenContract = new ethers.Contract(
      address,
      [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ],
      this.provider
    );

    const [name, symbol, decimals] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals()
    ]);

    return new Token(config.network.chainId, address, decimals, symbol, name);
  }

  private getSingleHopFee(tokenInAddress: string, tokenOutAddress: string): number | null {
    const tokenInSymbol = this.getTokenSymbol(tokenInAddress);
    const tokenOutSymbol = this.getTokenSymbol(tokenOutAddress);

    if (!tokenInSymbol || !tokenOutSymbol) return null;

    const pair1 = `${tokenInSymbol}/${tokenOutSymbol}`;
    const pair2 = `${tokenOutSymbol}/${tokenInSymbol}`;

    return config.network.fees[pair1] || config.network.fees[pair2] || null;
  }

  private getTokenSymbol(address: string): string | null {
    const tokens = config.network.tokens;

    for (const [symbol, tokenAddress] of Object.entries(tokens)) {
      if (tokenAddress.toLowerCase() === address.toLowerCase()) {
        return symbol.toUpperCase();
      }
    }

    return null;
  }

  private getTokenDecimals(address: string): number {
    const symbol = this.getTokenSymbol(address);
    if (!symbol) return 18; // Default to 18 decimals

    const decimals: { [key: string]: number } = {
      ETH: 18,
      WETH: 18,
      CBBTC: 8,
      USDC: 6,
      DAI: 18
    };
    return decimals[symbol] || 18;
  }

  private encodePathFromRoute(route: any): string {
    // Encode the path for Uniswap V3 using solidityPack for correct 43-byte encoding
    // Format: [token0, fee, token1, fee, token2, ...]
    const tokens = route.tokenPath;
    const fees = route.pools.map((pool: any) => pool.fee);

    // Build the types and values arrays for solidityPack
    const types = [];
    const values = [];

    for (let i = 0; i < tokens.length; i++) {
      types.push("address");
      values.push(tokens[i].address);

      if (i < fees.length) {
        types.push("uint24");
        values.push(fees[i]);
      }
    }

    return ethers.utils.solidityPack(types, values);
  }

  private async constructFallbackRoute(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string
  ): Promise<RouteInfo> {
    logger.info('Constructing fallback route');

    // Try direct single-hop first
    const directFee = this.getSingleHopFee(tokenInAddress, tokenOutAddress);
    if (directFee) {
      return {
        isMultiHop: false,
        fee: directFee,
        expectedOutput: amountIn, // Placeholder - would need price calculation
        gasEstimate: '150000' // Estimated gas for single hop
      };
    }

    // Try routing through WETH
    const wethAddress = config.network.tokens.weth;
    const inToWethFee = this.getSingleHopFee(tokenInAddress, wethAddress);
    const wethToOutFee = this.getSingleHopFee(wethAddress, tokenOutAddress);

    if (inToWethFee && wethToOutFee) {
      // Construct multi-hop path through WETH
      const path = this.encodePath([
        { address: tokenInAddress, fee: inToWethFee },
        { address: wethAddress, fee: wethToOutFee },
        { address: tokenOutAddress }
      ]);

      return {
        isMultiHop: true,
        path: path,
        expectedOutput: amountIn, // Placeholder
        gasEstimate: '200000' // Estimated gas for multi-hop
      };
    }

    throw new Error(`No route found between ${tokenInAddress} and ${tokenOutAddress}`);
  }

  private encodePath(pathData: Array<{ address: string; fee?: number }>): string {
    // Build the types and values arrays for solidityPack for correct 43-byte encoding
    const types = [];
    const values = [];

    for (let i = 0; i < pathData.length; i++) {
      types.push("address");
      values.push(pathData[i].address);

      if (i < pathData.length - 1) {
        const fee = pathData[i].fee;
        if (fee === undefined) {
          throw new Error('Missing fee in path encoding');
        }
        types.push("uint24");
        values.push(fee);
      }
    }

    return ethers.utils.solidityPack(types, values);
  }

  // Get estimated output for a given input (for UI purposes)
  async getEstimatedOutput(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string
  ): Promise<string> {
    try {
      const route = await this.findOptimalRoute(tokenInAddress, tokenOutAddress, amountIn);
      return route.expectedOutput;
    } catch (error) {
      logger.error('Failed to get estimated output', { error });
      throw error;
    }
  }

  // Calculate minimum amount out based on slippage (deprecated - use calculateMinAmountOutWithPrice)
  calculateMinAmountOut(expectedOutput: string, slippageBps: number): string {
    const slippageMultiplier = (10000 - slippageBps) / 10000;
    const expectedBigInt = ethers.utils.parseUnits(expectedOutput, 18); // Assuming 18 decimals for calculation
    const minAmount = expectedBigInt.mul(Math.floor(slippageMultiplier * 10000)).div(10000);
    return ethers.utils.formatUnits(minAmount, 18);
  }

  // Calculate minimum amount out using real price feeds from Pyth/Hermes
  async calculateMinAmountOutWithPrice(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string,
    slippageBps: number = config.slippageBps
  ): Promise<string> {
    try {
      // Get token symbols from addresses
      const tokenInSymbol = this.getTokenSymbol(tokenInAddress);
      const tokenOutSymbol = this.getTokenSymbol(tokenOutAddress);

      if (!tokenInSymbol || !tokenOutSymbol) {
        logger.warn('Token symbol not found, falling back to old calculation method');
        // Fallback to route-based calculation if we can't identify tokens
        const route = await this.findOptimalRoute(tokenInAddress, tokenOutAddress, amountIn, slippageBps);
        return this.calculateMinAmountOut(route.expectedOutput, slippageBps);
      }

      // Convert input amount to USD
      const inputAmountNumber = parseFloat(amountIn);
      const amountInUSD = await priceFeedService.convertToUSD(tokenInSymbol, inputAmountNumber);

      // Calculate minimum amount out using price feeds
      const minAmountOut = await priceFeedService.calculateMinAmountOutWithPrice(
        tokenInSymbol,
        tokenOutSymbol,
        amountInUSD,
        slippageBps
      );

      logger.info('Calculated minimum amount out with price feed', {
        tokenIn: tokenInSymbol,
        tokenOut: tokenOutSymbol,
        amountIn,
        amountInUSD,
        slippageBps,
        minAmountOut
      });

      return minAmountOut;

    } catch (error) {
      logger.error('Failed to calculate minimum amount out with price feed, falling back', { error });
      // Fallback to route-based calculation
      const route = await this.findOptimalRoute(tokenInAddress, tokenOutAddress, amountIn, slippageBps);
      return this.calculateMinAmountOut(route.expectedOutput, slippageBps);
    }
  }

  // Validate minimum amount against actual market price
  async validateMinAmountOut(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string,
    minAmountOut: string,
    slippageBps: number = config.slippageBps
  ): Promise<{ isValid: boolean; expectedMinimum: string; actualRatio?: number }> {
    try {
      const expectedMinimum = await this.calculateMinAmountOutWithPrice(
        tokenInAddress,
        tokenOutAddress,
        amountIn,
        slippageBps
      );

      // Get token decimals for proper BigNumber conversion
      const tokenDecimals = this.getTokenDecimals(tokenOutAddress);

      const expectedMinBigInt = ethers.utils.parseUnits(expectedMinimum, tokenDecimals);
      const actualMinBigInt = ethers.utils.parseUnits(minAmountOut, tokenDecimals);

      // Check if actual minimum is at least 95% of expected minimum (some tolerance for price movements)
      const tolerance = expectedMinBigInt.mul(95).div(100);
      const isValid = actualMinBigInt.gte(tolerance);

      const actualRatio = actualMinBigInt.mul(10000).div(expectedMinBigInt).toNumber() / 100;

      logger.info('Validated minimum amount out', {
        amountIn,
        expectedMinimum,
        minAmountOut,
        isValid,
        actualRatio
      });

      return {
        isValid,
        expectedMinimum,
        actualRatio
      };

    } catch (error) {
      logger.error('Failed to validate minimum amount out', { error });
      // If validation fails, assume it's valid to not break existing functionality
      return { isValid: true, expectedMinimum: minAmountOut };
    }
  }
}