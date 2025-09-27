# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Dollar Cost Averaging (DCA) application built using Scaffold-ETH 2. The project consists of:

- **Smart Contracts** (Foundry): Two main planner contracts for DCA functionality
  - `ERC20_Planner.sol`: Handles DCA swaps from stablecoins (USDC/DAI) to target ERC-20 tokens
  - `ETH_Planner.sol`: Handles DCA swaps from stablecoins to ETH via WETH
- **Frontend** (Next.js): React-based web interface with wallet integration
- **Server** (Node.js): TypeScript backend service

Both planner contracts support:
- **Push flow**: Users transfer funds to contract, watcher calls swap execution
- **Plan flow**: Users create on-chain recurring DCA plans, keepers execute them
- Uniswap V3 integration for token swaps with custom path routing
- Reentrancy protection and ownership controls

## Common Commands

### Root Level (from `/packages`)
- `yarn install` - Install all dependencies
- `yarn chain` - Start local Foundry blockchain
- `yarn deploy` - Deploy smart contracts to local network
- `yarn start` - Start Next.js frontend development server
- `yarn format` - Format all code (Next.js + Foundry)
- `yarn lint` - Lint all code (Next.js + Foundry)
- `yarn test` - Run Foundry tests

### Foundry Package Commands
- `yarn foundry:compile` - Compile smart contracts
- `yarn foundry:test` - Run contract tests with `forge test`
- `yarn foundry:format` - Format Solidity code
- `yarn foundry:lint` - Lint Solidity code
- `yarn foundry:clean` - Clean build artifacts
- `yarn foundry:deploy` - Deploy contracts with deployment scripts

### Next.js Package Commands  
- `yarn next:build` - Build Next.js application for production
- `yarn next:dev` - Start development server (same as `yarn start`)
- `yarn next:lint` - Lint TypeScript/React code
- `yarn next:format` - Format TypeScript/React code
- `yarn next:check-types` - Run TypeScript type checking

## Architecture Notes

### Smart Contract Architecture
- Uses OpenZeppelin contracts for security (Ownable, ReentrancyGuard, SafeERC20)
- Implements custom Uniswap V3 path parsing and validation
- Tracks uncredited deposits to prevent double-spending in push flows
- Plans are stored on-chain with timing and amount parameters

### Frontend Architecture
- Built on Scaffold-ETH 2 framework with Next.js 15 and React 19
- Uses wagmi/viem for Ethereum interactions and RainbowKit for wallet connection
- Custom hooks in `hooks/scaffold-eth/` wrap wagmi functionality
- Contract interactions handled through auto-generated TypeScript ABIs
- Styled with Tailwind CSS and DaisyUI components

### Development Workflow
1. Start local chain: `yarn chain`
2. Deploy contracts: `yarn deploy` 
3. Start frontend: `yarn start`
4. Visit http://localhost:3000 to interact with contracts

### File Structure
- `foundry/contracts/` - Smart contract source files
- `foundry/script/` - Deployment and helper scripts  
- `foundry/test/` - Contract test files
- `nextjs/app/` - Next.js pages using App Router
- `nextjs/components/` - React components
- `nextjs/contracts/` - Auto-generated contract ABIs and addresses
- `server/src/` - Backend TypeScript source

### Testing
- Smart contracts: Use `forge test` or `yarn foundry:test`
- No specific frontend test setup currently configured
- Contract tests should be in `foundry/test/` directory

## Requirements
- Node.js >= 20.18.3
- Yarn package manager  
- Foundry for smart contract development