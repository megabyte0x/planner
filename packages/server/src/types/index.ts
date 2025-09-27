export interface DepositEvent {
  user: string;
  token: string;
  amount: string;
  blockNumber: number;
  transactionHash: string;
  plannerContract: string;
}

export interface Plan {
  stable: string;
  amount: string;
  interval: number;
  nextExec: number;
  active: boolean;
}

export interface RouteInfo {
  path?: string;
  fee?: number;
  isMultiHop: boolean;
  expectedOutput: string;
  gasEstimate: string;
}

export interface SwapExecutionResult {
  success: boolean;
  transactionHash?: string;
  outputAmount?: string;
  error?: string;
  gasUsed?: string;
}

export enum PlannerType {
  ETH = 'ETH',
  ERC20 = 'ERC20'
}