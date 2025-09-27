# Complete Dollar Cost Averaging (DCA) Project Plan

## Project Overview

This is a comprehensive DCA application built on Scaffold-ETH 2, enabling users to convert USDC/DAI into ETH or cbBTC through two methods:
1. **Push Flow**: Direct token transfers with automated swap execution
2. **Plan Flow**: Recurring on-chain DCA plans with scheduled execution

## Current Implementation Status

### ✅ **COMPLETED COMPONENTS**

**Smart Contracts (Foundry)**
- `ETH_Planner.sol` - Handles USDC/DAI → ETH conversions via WETH unwrapping
- `ERC20_Planner.sol` - Handles USDC/DAI → cbBTC (or any ERC-20) conversions
- Both contracts support push deposits and recurring plans
- Uniswap V3 integration with multi-hop path support
- Security features: ReentrancyGuard, Ownable, SafeERC20

**Deployment Infrastructure**
- Deployment scripts: `DeployETHPlanner.s.sol`, `DeployERC20Planner.s.sol`
- Helper scripts for network configuration
- Foundry project structure with proper dependencies

### ⚠️ **MISSING CRITICAL COMPONENTS**

**1. Backend Watcher Service (HIGH PRIORITY)**
- Location: `./server/src/index.ts` (currently empty)
- **Responsibilities:**
  - Listen for ERC20 Transfer events to planner contracts
  - Execute deposit swaps automatically
  - Schedule and execute recurring DCA plans
  - Route optimization (single-hop vs multi-hop)
  - Slippage protection and error handling

**2. Frontend Application (HIGH PRIORITY)**
- Next.js application structure exists but needs DCA-specific components
- **Required Pages/Components:**
  - Wallet connection (RainbowKit integration)
  - DCA plan creation interface
  - Instant swap interface (push flow)
  - Plan management dashboard
  - Transaction history and status

**3. Smart Contract Tests (MEDIUM PRIORITY)**
- Foundry test suite for both planner contracts
- Unit tests for push deposits and plan execution
- Integration tests with Uniswap V3
- Fork tests for real network conditions

**4. Network Configuration (MEDIUM PRIORITY)**
- Address configurations for Sepolia, Base, Ethereum mainnet
- Environment variable management
- Deployment automation for multiple networks

## Development Phases & Implementation Roadmap

### **Phase 1: Core Backend Infrastructure** (Week 1-2)
**Objective**: Implement watcher service for automated swap execution

**Tasks:**
1. **Watcher Service Implementation**
   - ERC20 Transfer event listener for USDC/DAI deposits
   - Automatic swap execution with route optimization
   - Plan scheduler with timing management
   - Error handling and retry logic

2. **Route Optimization Engine**
   - Uniswap V3 pool discovery and fee tier selection
   - Path encoding for multi-hop swaps
   - Slippage calculation and protection

3. **Configuration Management**
   - Multi-network support (Sepolia → Base → Mainnet)
   - Environment variable handling
   - Address book for each network

### **Phase 2: Smart Contract Testing & Hardening** (Week 2-3)
**Objective**: Comprehensive testing and security validation

**Tasks:**
1. **Unit Test Suite**
   - Push deposit flow tests
   - Recurring plan creation/execution tests
   - Path validation and edge cases
   - Access control and admin functions

2. **Integration Testing**
   - Fork testing against live Uniswap pools
   - Multi-network deployment testing
   - Gas optimization validation

3. **Security Audit Preparation**
   - Reentrancy attack simulation
   - Edge case handling (zero amounts, invalid paths)
   - Admin function security review

### **Phase 3: Frontend Development** (Week 3-4)
**Objective**: User-friendly DCA interface

**Tasks:**
1. **Core UI Components**
   - Wallet connection with RainbowKit
   - DCA plan creation form with input validation
   - Real-time plan status and countdown timers
   - Transaction history and status tracking

2. **Advanced Features**
   - Token approval management
   - Slippage tolerance settings
   - Estimated output calculations
   - Network switching support

3. **User Experience**
   - Loading states and transaction feedback
   - Error handling and user guidance
   - Mobile-responsive design
   - Help documentation and tooltips

### **Phase 4: Production Deployment & Monitoring** (Week 4-5)
**Objective**: Launch on target networks with monitoring

**Tasks:**
1. **Network Deployment**
   - Sepolia testnet deployment and testing
   - Base mainnet deployment
   - Ethereum mainnet deployment
   - Contract verification and documentation

2. **Monitoring & Analytics**
   - Watcher service health monitoring
   - Transaction success rate tracking
   - Gas usage optimization
   - User adoption metrics

3. **Documentation & Support**
   - User guides and tutorials
   - API documentation for developers
   - Troubleshooting guides
   - Community support setup

## Technical Architecture

### **Smart Contract Layer**
- **ETH_Planner**: USDC/DAI → ETH via WETH unwrapping
- **ERC20_Planner**: USDC/DAI → cbBTC (configurable target token)
- **Security**: OpenZeppelin patterns, reentrancy protection, admin controls
- **Integration**: Uniswap V3 with multi-hop routing support

### **Backend Service Layer**
- **Event Monitoring**: Real-time ERC20 Transfer event detection
- **Execution Engine**: Automated swap execution with optimal routing
- **Scheduler**: Recurring plan management with drift prevention
- **Configuration**: Multi-network support with address management

### **Frontend Layer**
- **Framework**: Next.js 15 with App Router
- **Web3 Integration**: wagmi/viem with RainbowKit wallet connection
- **State Management**: React hooks with contract interaction helpers
- **Styling**: Tailwind CSS with DaisyUI components

## Success Metrics & Milestones

### **Technical Milestones**
- [ ] Watcher service processes 100% of deposits within 30 seconds
- [ ] Smart contracts handle edge cases without failures
- [ ] Frontend supports all major wallet providers
- [ ] Multi-network deployment completed successfully

### **User Experience Metrics**
- [ ] Sub-5-minute setup time for new DCA plans
- [ ] <2% transaction failure rate
- [ ] Mobile-responsive interface on all devices
- [ ] Clear error messages and recovery paths

### **Business Metrics**
- [ ] Support for $10-$10,000+ DCA amounts
- [ ] Multiple interval options (daily, weekly, monthly)
- [ ] Cross-network asset migration capability
- [ ] Integration with popular DeFi wallets

## Next Steps for Implementation

### **Immediate Actions Required**

1. **Start with Backend Watcher** (`./server/src/index.ts`)
   - Implement ERC20 Transfer event monitoring
   - Build Uniswap V3 route optimization
   - Create plan execution scheduler

2. **Develop Smart Contract Tests** (`./foundry/test/`)
   - Unit tests for both planner contracts
   - Integration tests with mock Uniswap interactions
   - Security and edge case validation

3. **Build Frontend Components** (`./nextjs/app/`)
   - DCA plan creation and management
   - Wallet integration with transaction handling
   - Real-time status monitoring

### **Critical Dependencies**
- Uniswap V3 SDK for route calculation
- WebSocket or polling for event monitoring
- Multi-network configuration management
- Gas price optimization strategies

This comprehensive plan provides a clear roadmap from the current smart contract foundation to a fully functional DCA application ready for production deployment across multiple networks.