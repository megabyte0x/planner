import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';
import { DepositEvent } from '../types';

export interface FailedDeposit extends DepositEvent {
  failedAt: number; // timestamp
  error: string;
  retryCount: number;
  lastRetryAt?: number;
}

export class DepositStorage {
  private readonly filePath: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelayMs: number = 2 * 60 * 1000; // 2 minutes (reduced from 5)
  private readonly gasErrorRetryDelayMs: number = 30 * 1000; // 30 seconds for gas estimation errors

  constructor(filePath: string = './failed_deposits.json') {
    this.filePath = path.resolve(filePath);
  }

  async saveFailedDeposit(deposit: DepositEvent, error: string): Promise<void> {
    try {
      const failedDeposits = await this.loadFailedDeposits();
      const depositKey = this.getDepositKey(deposit);

      const failedDeposit: FailedDeposit = {
        ...deposit,
        failedAt: Date.now(),
        error,
        retryCount: 0
      };

      // Update existing or add new failed deposit
      failedDeposits[depositKey] = failedDeposit;

      await this.saveFailedDeposits(failedDeposits);

      logger.info('Saved failed deposit', {
        user: deposit.user,
        token: deposit.token,
        amount: deposit.amount,
        error
      });
    } catch (saveError) {
      logger.error('Failed to save failed deposit', { saveError, deposit });
    }
  }

  async getRetryableDeposits(): Promise<FailedDeposit[]> {
    try {
      const failedDeposits = await this.loadFailedDeposits();
      const now = Date.now();

      return Object.values(failedDeposits).filter(deposit => {
        // Skip if already exceeded max retries
        if (deposit.retryCount >= this.maxRetries) {
          return false;
        }

        // Check if enough time has passed since last retry
        const lastRetry = deposit.lastRetryAt || deposit.failedAt;

        // Use shorter delay for gas estimation errors
        const isGasError = deposit.error.toLowerCase().includes('gas') ||
                          deposit.error.toLowerCase().includes('unpredictable');
        const delayMs = isGasError ? this.gasErrorRetryDelayMs : this.retryDelayMs;

        return (now - lastRetry) >= delayMs;
      });
    } catch (error) {
      logger.error('Failed to load retryable deposits', { error });
      return [];
    }
  }

  async markRetryAttempt(deposit: FailedDeposit): Promise<void> {
    try {
      const failedDeposits = await this.loadFailedDeposits();
      const depositKey = this.getDepositKey(deposit);

      if (failedDeposits[depositKey]) {
        failedDeposits[depositKey].retryCount += 1;
        failedDeposits[depositKey].lastRetryAt = Date.now();
        await this.saveFailedDeposits(failedDeposits);
      }
    } catch (error) {
      logger.error('Failed to mark retry attempt', { error, deposit });
    }
  }

  async removeSuccessfulDeposit(deposit: DepositEvent): Promise<void> {
    try {
      const failedDeposits = await this.loadFailedDeposits();
      const depositKey = this.getDepositKey(deposit);

      if (failedDeposits[depositKey]) {
        delete failedDeposits[depositKey];
        await this.saveFailedDeposits(failedDeposits);

        logger.info('Removed successful deposit from failed list', {
          user: deposit.user,
          token: deposit.token
        });
      }
    } catch (error) {
      logger.error('Failed to remove successful deposit', { error, deposit });
    }
  }

  async getFailedDepositsStats(): Promise<{
    total: number;
    retryable: number;
    maxRetriesExceeded: number;
  }> {
    try {
      const failedDeposits = await this.loadFailedDeposits();
      const deposits = Object.values(failedDeposits);

      const retryable = deposits.filter(d => d.retryCount < this.maxRetries).length;
      const maxRetriesExceeded = deposits.filter(d => d.retryCount >= this.maxRetries).length;

      return {
        total: deposits.length,
        retryable,
        maxRetriesExceeded
      };
    } catch (error) {
      logger.error('Failed to get failed deposits stats', { error });
      return { total: 0, retryable: 0, maxRetriesExceeded: 0 };
    }
  }

  async cleanupOldFailedDeposits(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const failedDeposits = await this.loadFailedDeposits();
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, deposit] of Object.entries(failedDeposits)) {
        if (now - deposit.failedAt > maxAgeMs) {
          delete failedDeposits[key];
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        await this.saveFailedDeposits(failedDeposits);
        logger.info('Cleaned up old failed deposits', { cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup old failed deposits', { error });
      return 0;
    }
  }

  private async loadFailedDeposits(): Promise<Record<string, FailedDeposit>> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, return empty object
      return {};
    }
  }

  private async saveFailedDeposits(deposits: Record<string, FailedDeposit>): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(deposits, null, 2), 'utf-8');
  }

  private getDepositKey(deposit: DepositEvent): string {
    return `${deposit.user.toLowerCase()}_${deposit.token.toLowerCase()}_${deposit.plannerContract.toLowerCase()}_${deposit.transactionHash}`;
  }
}