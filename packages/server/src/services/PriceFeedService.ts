import { HermesClient } from '@pythnetwork/hermes-client';
import logger from '../utils/logger';

export interface PriceData {
  price: number;
  confidence: number;
  publishTime: number;
}

export class PriceFeedService {
  private hermesClient: HermesClient;
  private priceCache: Map<string, { data: PriceData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION_MS = 30000; // 30 seconds cache

  // Pyth price feed IDs for major assets
  private readonly PRICE_FEED_IDS = {
    ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH/USD
    BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // BTC/USD
    USDC: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', // USDC/USD
    USDT: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca5f0d8e17f72c9afdc3afe9f8c', // USDT/USD
    DAI: '0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd'   // DAI/USD
  };

  constructor() {
    // Initialize Hermes client with mainnet endpoint
    this.hermesClient = new HermesClient('https://hermes.pyth.network', {});
  }

  // Map token symbols to price feed symbols
  private mapSymbolToFeedSymbol(symbol: string): string {
    const symbolMapping: { [key: string]: string } = {
      'WETH': 'ETH',  // WETH uses ETH price feed
      'CBBTC': 'BTC', // CBBTC uses BTC price feed
    };

    return symbolMapping[symbol] || symbol;
  }

  async getPrice(symbol: string): Promise<PriceData> {
    const normalizedSymbol = this.mapSymbolToFeedSymbol(symbol.toUpperCase());

    // Check cache first
    const cached = this.priceCache.get(normalizedSymbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION_MS) {
      logger.debug(`Using cached price for ${normalizedSymbol}`, cached.data);
      return cached.data;
    }

    const priceId = this.PRICE_FEED_IDS[normalizedSymbol as keyof typeof this.PRICE_FEED_IDS];
    if (!priceId) {
      throw new Error(`Price feed not available for ${symbol}`);
    }

    try {
      logger.info(`Fetching price for ${normalizedSymbol}`, { priceId });

      const response = await this.hermesClient.getLatestPriceUpdates([priceId]) as any;

      if (!response || !response.parsed || response.parsed.length === 0) {
        throw new Error(`No price data received for ${symbol}`);
      }

      const priceFeed = response.parsed[0];
      const price = priceFeed.price;

      if (!price) {
        throw new Error(`Invalid price data for ${symbol}`);
      }

      // Convert price from Pyth format (price * 10^expo) to regular number
      const normalizedPrice = price.price * Math.pow(10, price.expo);

      const priceData: PriceData = {
        price: normalizedPrice,
        confidence: price.conf * Math.pow(10, price.expo), // Confidence interval
        publishTime: price.publish_time || Date.now()
      };

      // Cache the result
      this.priceCache.set(normalizedSymbol, {
        data: priceData,
        timestamp: Date.now()
      });

      logger.info(`Retrieved price for ${normalizedSymbol}`, priceData);
      return priceData;

    } catch (error) {
      logger.error(`Failed to fetch price for ${symbol}`, { error });
      throw new Error(`Failed to get price for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPriceInUSD(symbol: string): Promise<number> {
    const priceData = await this.getPrice(symbol);
    return priceData.price;
  }

  // Get token decimals based on symbol
  private getTokenDecimals(tokenSymbol: string): number {
    const decimals: { [key: string]: number } = {
      ETH: 18,
      WETH: 18,
      CBBTC: 8,
      USDC: 6,
      DAI: 18
    };
    return decimals[tokenSymbol.toUpperCase()] || 18; // Default to 18 if unknown
  }

  // Calculate minimum amount out using real price feeds
  async calculateMinAmountOutWithPrice(
    tokenInSymbol: string,
    tokenOutSymbol: string,
    amountInUSD: number,
    slippageBps: number
  ): Promise<string> {
    try {
      // Get the price of the output token in USD
      const outputTokenPrice = await this.getPriceInUSD(tokenOutSymbol);

      // Calculate expected amount of output tokens based on USD value
      const expectedOutputAmount = amountInUSD / outputTokenPrice;

      // Apply slippage tolerance
      const slippageMultiplier = (10000 - slippageBps) / 10000;
      const minAmountOut = expectedOutputAmount * slippageMultiplier;

      // Get the correct decimal places for the output token
      const outputTokenDecimals = this.getTokenDecimals(tokenOutSymbol);

      // Convert to token units (multiply by 10^decimals)
      const minAmountOutInTokenUnits = minAmountOut * Math.pow(10, outputTokenDecimals);

      logger.info(`Calculated minimum amount out`, {
        tokenInSymbol,
        tokenOutSymbol,
        amountInUSD,
        outputTokenPrice,
        expectedOutputAmount,
        slippageBps,
        minAmountOut,
        outputTokenDecimals,
        minAmountOutInTokenUnits: minAmountOutInTokenUnits.toString()
      });

      // Return as string in token units (wei-like format)
      return Math.floor(minAmountOutInTokenUnits).toString();

    } catch (error) {
      logger.error('Failed to calculate minimum amount out with price', { error });
      throw error;
    }
  }

  // Convert token amount to USD value
  async convertToUSD(tokenSymbol: string, amount: number): Promise<number> {
    const price = await this.getPriceInUSD(tokenSymbol);
    return amount * price;
  }

  // Get supported tokens
  getSupportedTokens(): string[] {
    return Object.keys(this.PRICE_FEED_IDS);
  }

  // Clear price cache
  clearCache(): void {
    this.priceCache.clear();
    logger.info('Price cache cleared');
  }
}

// Export singleton instance
export const priceFeedService = new PriceFeedService();