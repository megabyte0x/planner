import { ethers } from 'ethers';
import crypto from 'crypto';
import logger from '../utils/logger';
import { config } from '../config';
import { DepositEvent, AlchemyAddressActivityWebhook } from '../types';

export class WebhookService {
  private readonly targetTokens: Set<string>;
  private readonly plannerContracts: Set<string>;

  constructor() {
    this.targetTokens = new Set([
      config.network.tokens.usdc.toLowerCase(),
      config.network.tokens.dai.toLowerCase()
    ]);

    this.plannerContracts = new Set([
      config.network.contracts.ethPlanner.toLowerCase(),
      config.network.contracts.erc20Planner.toLowerCase()
    ]);
  }

  public verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!config.webhook?.secret) {
      logger.warn('Webhook secret not configured, skipping signature verification');
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', config.webhook.secret)
        .update(payload)
        .digest('hex');

      // Compare signatures in constant time to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying webhook signature', { error });
      return false;
    }
  }

  public async processAddressActivityWebhook(
    webhook: AlchemyAddressActivityWebhook,
    onDepositDetected: (deposit: DepositEvent) => Promise<void>
  ): Promise<void> {
    logger.info('Processing address activity webhook', {
      webhookId: webhook.webhookId,
      event: webhook.event
    });

    // Check if activity array exists
    if (!webhook.event.activity || !Array.isArray(webhook.event.activity)) {
      logger.warn('No activity array found in webhook event', {
        event: webhook.event
      });
      return;
    }

    logger.info('Found activity data', {
      activityCount: webhook.event.activity.length
    });

    for (const activity of webhook.event.activity) {
      await this.processActivity(activity, onDepositDetected);
    }
  }

  private async processActivity(
    activity: AlchemyAddressActivityWebhook['event']['activity'][0],
    onDepositDetected: (deposit: DepositEvent) => Promise<void>
  ): Promise<void> {
    try {
      // Handle token transfers (deposits)
      if (activity.category === 'token') {
        await this.handleTokenTransfer(activity, onDepositDetected);
      }

      // TODO: Handle plan creation events
      // Note: Plan creation events are contract logs, not token transfers
      // This would require a different webhook type (e.g., event logs webhook)
      // For now, we'll use the minimal HTTP query approach as fallback

    } catch (error) {
      logger.error('Error processing activity', {
        error,
        activity
      });
    }
  }

  private async handleTokenTransfer(
    activity: AlchemyAddressActivityWebhook['event']['activity'][0],
    onDepositDetected: (deposit: DepositEvent) => Promise<void>
  ): Promise<void> {
    // Check if recipient is one of our planner contracts
    const toAddress = activity.toAddress.toLowerCase();
    if (!this.plannerContracts.has(toAddress)) {
      return;
    }

    // Check if the token is USDC or DAI
    const tokenAddress = activity.rawContract?.address?.toLowerCase();
    if (!tokenAddress || !this.targetTokens.has(tokenAddress)) {
      return;
    }

    const tokenSymbol = tokenAddress === config.network.tokens.usdc.toLowerCase() ? 'USDC' : 'DAI';
    const decimals = tokenAddress === config.network.tokens.usdc.toLowerCase() ? 6 : 18;

    // Activity.value is in human-readable format (e.g., 0.5)
    // So we need to parse it with the correct decimals to get wei-equivalent units
    const amount = ethers.utils.parseUnits(activity.value.toString(), decimals);

    logger.info(`${tokenSymbol} deposit detected via webhook`, {
      from: activity.fromAddress,
      to: activity.toAddress,
      amount: ethers.utils.formatUnits(amount, decimals),
      txHash: activity.hash,
      blockNumber: parseInt(activity.blockNum, 16)
    });

    const depositEvent: DepositEvent = {
      user: activity.fromAddress,
      token: tokenAddress,
      amount: amount.toString(),
      blockNumber: parseInt(activity.blockNum, 16),
      transactionHash: activity.hash,
      plannerContract: activity.toAddress
    };

    await onDepositDetected(depositEvent);
  }
}