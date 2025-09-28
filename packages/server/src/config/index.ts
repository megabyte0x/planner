import dotenv from 'dotenv';
import { getNetworkByName, NetworkConfig } from './networks';

dotenv.config();

export interface Config {
  network: NetworkConfig;
  privateKey: string;
  slippageBps: number;
  confirmations: number;
  maxGasPriceGwei: number;
  schedulerIntervalSeconds: number;
  logLevel: string;
  logFile: string;
  port: number;
  webhook?: {
    enabled: boolean;
    secret?: string;
    path: string;
  };
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

export const config: Config = {
  network: getNetworkByName(process.env.NETWORK_NAME || 'base'),
  privateKey: getRequiredEnv('WATCHER_PRIVATE_KEY'),
  slippageBps: getEnvNumber('SLIPPAGE_BPS', 50), // 0.5%
  confirmations: getEnvNumber('CONFIRMATIONS', 1),
  maxGasPriceGwei: getEnvNumber('MAX_GAS_PRICE_GWEI', 20),
  schedulerIntervalSeconds: getEnvNumber('SCHEDULER_INTERVAL_SECONDS', 30),
  logLevel: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE || './logs/watcher.log',
  port: getEnvNumber('PORT', 3001),
  webhook: process.env.WEBHOOK_ENABLED === 'true' ? {
    enabled: true,
    secret: process.env.WEBHOOK_SECRET,
    path: process.env.WEBHOOK_PATH || '/webhook/alchemy'
  } : undefined,
};

export * from './networks';