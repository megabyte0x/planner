import { ethers } from 'ethers';
import WebSocket from 'ws';
import logger from '../utils/logger';
import { config } from '../config';
import { DepositEvent } from '../types';

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

interface AlchemyMinedTransactionResponse {
  jsonrpc: string;
  method: string;
  params: {
    result: {
      hash: string;
      blockNumber: string;
      from: string;
      to: string;
      logs: Array<{
        address: string;
        topics: string[];
        data: string;
        blockNumber: string;
        transactionHash: string;
        transactionIndex: string;
        blockHash: string;
        logIndex: string;
        removed: boolean;
      }>;
    };
  };
}

export class EventMonitor {
  private provider: ethers.providers.JsonRpcProvider;
  private alchemyWs: WebSocket | null = null;
  private isMonitoring = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.network.rpcHttp); // Use HTTP for contract calls
  }

  async startMonitoring(onDepositDetected: (deposit: DepositEvent) => Promise<void>) {
    if (this.isMonitoring) {
      logger.warn('Event monitoring is already running');
      return;
    }

    logger.info('Starting Alchemy WebSocket event monitoring for deposit detection...');
    this.isMonitoring = true;

    try {
      await this.connectToAlchemy(onDepositDetected);

      logger.info(`Event monitoring started for network: ${config.network.name}`);
      logger.info(`Monitoring USDC: ${config.network.tokens.usdc}`);
      logger.info(`Monitoring DAI: ${config.network.tokens.dai}`);
      logger.info(`ETH Planner: ${config.network.contracts.ethPlanner}`);
      logger.info(`ERC20 Planner: ${config.network.contracts.erc20Planner}`);

    } catch (error) {
      logger.error('Failed to start event monitoring', { error });
      this.isMonitoring = false;
      throw error;
    }
  }

  private async connectToAlchemy(onDepositDetected: (deposit: DepositEvent) => Promise<void>) {
    const wsUrl = config.network.rpcWs.replace('http', 'ws');

    this.alchemyWs = new WebSocket(wsUrl);

    this.alchemyWs.on('open', () => {
      logger.info('Alchemy WebSocket connected');
      this.reconnectAttempts = 0;

      // Subscribe to mined transactions for our target addresses
      this.subscribeToMinedTransactions();
    });

    this.alchemyWs.on('message', async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as AlchemyMinedTransactionResponse;

        if (message.method === 'alchemy_minedTransactions') {
          await this.processMinedTransaction(message.params.result, onDepositDetected);
        }
      } catch (error) {
        logger.error('Error processing WebSocket message', { error });
      }
    });

    this.alchemyWs.on('close', () => {
      logger.warn('Alchemy WebSocket connection closed');

      if (this.isMonitoring && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
          this.connectToAlchemy(onDepositDetected);
        }, 5000 * this.reconnectAttempts); // Exponential backoff
      }
    });

    this.alchemyWs.on('error', (error) => {
      logger.error('Alchemy WebSocket error', { error });
    });
  }

  private subscribeToMinedTransactions() {
    if (!this.alchemyWs || this.alchemyWs.readyState !== WebSocket.OPEN) {
      logger.error('WebSocket not ready for subscription');
      return;
    }

    // Subscribe to mined transactions for both planner contracts
    const subscription = {
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_minedTransactions',
      params: [
        {
          addresses: [
            {
              to: config.network.contracts.ethPlanner
            },
            {
              to: config.network.contracts.erc20Planner
            }
          ],
          includeRemoved: false,
          hashesOnly: false
        }
      ]
    };

    this.alchemyWs.send(JSON.stringify(subscription));
    logger.info('Subscribed to mined transactions for planner contracts');
  }

  private async processMinedTransaction(
    transaction: AlchemyMinedTransactionResponse['params']['result'],
    onDepositDetected: (deposit: DepositEvent) => Promise<void>
  ) {
    try {
      // Process each log in the transaction
      for (const log of transaction.logs) {
        await this.processTransferLog(log, onDepositDetected);
      }
    } catch (error) {
      logger.error('Error processing mined transaction', {
        error,
        txHash: transaction.hash
      });
    }
  }

  private async processTransferLog(
    log: AlchemyMinedTransactionResponse['params']['result']['logs'][0],
    onDepositDetected: (deposit: DepositEvent) => Promise<void>
  ) {
    try {
      // Check if this is a Transfer event for USDC or DAI
      const transferEventSignature = ethers.utils.id('Transfer(address,address,uint256)');

      if (log.topics[0] !== transferEventSignature) {
        return; // Not a Transfer event
      }

      // Check if the token is USDC or DAI
      const isUsdc = log.address.toLowerCase() === config.network.tokens.usdc.toLowerCase();
      const isDai = log.address.toLowerCase() === config.network.tokens.dai.toLowerCase();

      if (!isUsdc && !isDai) {
        return; // Not our target tokens
      }

      // Decode the transfer event
      const from = ethers.utils.getAddress('0x' + log.topics[1].slice(26)); // Remove padding
      const to = ethers.utils.getAddress('0x' + log.topics[2].slice(26));   // Remove padding
      const value = ethers.BigNumber.from(log.data);

      // Check if this is a transfer TO one of our planner contracts
      const isToEthPlanner = to.toLowerCase() === config.network.contracts.ethPlanner.toLowerCase();
      const isToErc20Planner = to.toLowerCase() === config.network.contracts.erc20Planner.toLowerCase();

      if (!isToEthPlanner && !isToErc20Planner) {
        return; // Not a deposit to our contracts
      }

      const tokenSymbol = isUsdc ? 'USDC' : 'DAI';
      const decimals = isUsdc ? 6 : 18;

      logger.info(`${tokenSymbol} deposit detected via Alchemy`, {
        from,
        to,
        amount: ethers.utils.formatUnits(value, decimals),
        txHash: log.transactionHash,
        blockNumber: parseInt(log.blockNumber, 16)
      });

      const depositEvent: DepositEvent = {
        user: from,
        token: log.address,
        amount: value.toString(),
        blockNumber: parseInt(log.blockNumber, 16),
        transactionHash: log.transactionHash,
        plannerContract: to
      };

      await onDepositDetected(depositEvent);

    } catch (error) {
      logger.error('Error processing transfer log', {
        error,
        logData: log
      });
    }
  }


  async stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('Stopping event monitoring...');
    this.isMonitoring = false;

    // Close Alchemy WebSocket connection
    if (this.alchemyWs) {
      this.alchemyWs.close();
      this.alchemyWs = null;
    }

    // Reset reconnection attempts
    this.reconnectAttempts = 0;

    logger.info('Event monitoring stopped');
  }

  isRunning(): boolean {
    return this.isMonitoring;
  }

  async getLatestBlock(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  // Get historical deposit events (for startup sync)
  async getHistoricalDeposits(fromBlock: number, toBlock: number = -1): Promise<DepositEvent[]> {
    logger.info('Fetching historical deposits', { fromBlock, toBlock });
    const deposits: DepositEvent[] = [];

    try {
      // Get USDC deposits
      const usdcLogs = await this.provider.getLogs({
        address: config.network.tokens.usdc,
        topics: [
          ethers.utils.id('Transfer(address,address,uint256)'), // Transfer event signature
          null, // from (any address)
          [
            ethers.utils.hexZeroPad(config.network.contracts.ethPlanner, 32),
            ethers.utils.hexZeroPad(config.network.contracts.erc20Planner, 32)
          ] // to (our planner contracts)
        ],
        fromBlock,
        toBlock
      });

      // Get DAI deposits
      const daiLogs = await this.provider.getLogs({
        address: config.network.tokens.dai,
        topics: [
          ethers.utils.id('Transfer(address,address,uint256)'),
          null,
          [
            ethers.utils.hexZeroPad(config.network.contracts.ethPlanner, 32),
            ethers.utils.hexZeroPad(config.network.contracts.erc20Planner, 32)
          ]
        ],
        fromBlock,
        toBlock
      });

      // Process logs
      const allLogs = [...usdcLogs, ...daiLogs];
      for (const log of allLogs) {
        const decoded = this.decodeTransferLog(log);
        if (decoded) {
          deposits.push({
            user: decoded.from,
            token: log.address,
            amount: decoded.value.toString(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            plannerContract: decoded.to
          });
        }
      }

      logger.info(`Found ${deposits.length} historical deposits`);
      return deposits;

    } catch (error) {
      logger.error('Failed to fetch historical deposits', { error });
      throw error;
    }
  }

  private decodeTransferLog(log: ethers.providers.Log): { from: string; to: string; value: ethers.BigNumber } | null {
    try {
      const iface = new ethers.utils.Interface(ERC20_ABI);
      const decoded = iface.parseLog(log);

      if (decoded && decoded.name === 'Transfer') {
        return {
          from: decoded.args[0],
          to: decoded.args[1],
          value: decoded.args[2]
        };
      }
    } catch (error) {
      logger.error('Failed to decode transfer log', { error, logData: log });
    }
    return null;
  }
}