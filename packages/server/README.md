# DCA Watcher Service

A TypeScript-based watcher service for automated DCA (Dollar Cost Averaging) swap execution and recurring plan scheduling. This service monitors ERC20 transfer events using Alchemy WebSockets and executes swaps through Uniswap V3.

## Features

- **Real-time Event Monitoring**: Uses Alchemy WebSocket API to monitor USDC/DAI deposits to planner contracts
- **Automatic Swap Execution**: Executes swaps immediately when deposits are detected (push flow)
- **DCA Plan Scheduling**: Manages and executes recurring DCA plans on schedule
- **Route Optimization**: Uses Uniswap V3 SDK for optimal routing (single-hop vs multi-hop)
- **Multi-Network Support**: Configurable for Sepolia, Base, and Ethereum mainnet
- **Health Monitoring**: Built-in health checks and monitoring endpoints
- **Graceful Shutdown**: Proper cleanup and shutdown handling

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EventMonitor  │    │  SwapExecutor   │    │ PlanScheduler   │
│                 │    │                 │    │                 │
│ • Alchemy WS    │───▶│ • Route Opt.    │    │ • Cron Jobs     │
│ • Transfer      │    │ • Gas Checks    │    │ • Plan Mgmt     │
│   Detection     │    │ • Slippage      │    │ • Auto Execute  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Main Service   │
                    │                 │
                    │ • Express API   │
                    │ • Health Checks │
                    │ • Coordination  │
                    └─────────────────┘
```

## Setup

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key environment variables:

```env
# Network Configuration
NETWORK_NAME=sepolia
CHAIN_ID=11155111

# Alchemy Configuration (get from dashboard)
RPC_HTTP=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
RPC_WS=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Wallet Configuration (use a dedicated watcher wallet)
WATCHER_PRIVATE_KEY=0x...

# Contract Addresses (deploy first)
ETH_PLANNER_ADDRESS=0x...
ERC20_PLANNER_ADDRESS=0x...

# Execution Settings
SLIPPAGE_BPS=50          # 0.5% slippage tolerance
MAX_GAS_PRICE_GWEI=20    # Max gas price limit
SCHEDULER_INTERVAL_SECONDS=30  # Plan check frequency
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Build and Run

Development mode with hot reload:
```bash
yarn dev
```

Production build and run:
```bash
yarn build
yarn start
```

## API Endpoints

### Health Check
```
GET /health
```

Returns service health status:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "network": "sepolia",
  "chainId": 11155111,
  "services": {
    "eventMonitor": "running",
    "swapExecutor": "healthy",
    "planScheduler": "active"
  },
  "walletInfo": {
    "address": "0x...",
    "chainId": 11155111
  },
  "activePlans": 5
}
```

### Service Status
```
GET /status
```

Returns detailed service configuration and active plans.

## How It Works

### 1. Deposit Detection (Push Flow)

1. **Alchemy WebSocket** monitors for ERC20 Transfer events where:
   - Token: USDC or DAI
   - To: ETH_Planner or ERC20_Planner contract

2. **Route Optimization**:
   - Checks for direct single-hop routes (preferred)
   - Falls back to multi-hop routing through WETH
   - Calculates slippage protection

3. **Swap Execution**:
   - Calls appropriate planner contract function
   - Handles both single-hop and multi-hop swaps
   - Includes gas price checks and limits

### 2. Plan Scheduling (Pull Flow)

1. **Event Listening**:
   - Monitors `PlanCreated`, `PlanCancelled`, `PlanExecuted` events
   - Maintains in-memory plan schedule

2. **Cron Scheduling**:
   - Runs every 30 seconds (configurable)
   - Checks for plans due for execution
   - Executes multiple plans in parallel (with limits)

3. **Plan Execution**:
   - Pulls funds via `transferFrom` (requires user approval)
   - Finds optimal route and calculates slippage
   - Executes swap and updates next execution time

## Development

### Testing

```bash
# Run tests
yarn test

# Run in development mode
yarn dev

# Build for production
yarn build
```

### Code Structure

```
src/
├── config/          # Network and environment configuration
├── services/        # Core business logic services
├── types/          # TypeScript type definitions
├── utils/          # Utility functions and helpers
└── index.ts        # Main service entry point
```
