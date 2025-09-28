#!/usr/bin/env node

/**
 * Script to allow stable tokens in both ERC20_Planner and ETH_Planner contracts
 * This fixes the "stable not allowed" error when executing deposit swaps
 */

const { ethers } = require('ethers');
require('dotenv').config();

// Contract ABIs - only need the setStable function
const PLANNER_ABI = [
  'function setStable(address stable, bool allowed) external',
  'function allowedStable(address stable) external view returns (bool)',
  'function owner() external view returns (address)'
];

// Network configuration for Base
const BASE_CONFIG = {
  rpcUrl: process.env.BASE_RPC_HTTP || "https://base-mainnet.g.alchemy.com/v2/YUOPnilJ5zuIqykiGiqZJdqhcmP9k9Ya",
  ethPlanner: process.env.BASE_ETH_PLANNER,
  erc20Planner: process.env.BASE_ERC20_PLANNER,
  tokens: {
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDbC on Base
    dai: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"   // DAI on Base
  }
};

async function main() {
  console.log("🚀 Setting up stable tokens as allowed...");

  // Validate environment variables
  if (!process.env.WATCHER_PRIVATE_KEY) {
    throw new Error("WATCHER_PRIVATE_KEY environment variable is required");
  }
  if (!BASE_CONFIG.ethPlanner || !BASE_CONFIG.erc20Planner) {
    throw new Error("BASE_ETH_PLANNER and BASE_ERC20_PLANNER environment variables are required");
  }

  // Setup provider and signer
  const provider = new ethers.providers.JsonRpcProvider(BASE_CONFIG.rpcUrl);
  const wallet = new ethers.Wallet(process.env.WATCHER_PRIVATE_KEY, provider);

  console.log(`📡 Connected to Base mainnet`);
  console.log(`👛 Using wallet: ${wallet.address}`);

  // Create contract instances
  const ethPlannerContract = new ethers.Contract(BASE_CONFIG.ethPlanner, PLANNER_ABI, wallet);
  const erc20PlannerContract = new ethers.Contract(BASE_CONFIG.erc20Planner, PLANNER_ABI, wallet);

  console.log(`📋 ETH Planner: ${BASE_CONFIG.ethPlanner}`);
  console.log(`📋 ERC20 Planner: ${BASE_CONFIG.erc20Planner}`);

  // Check current ownership and allowed status
  console.log("\n🔍 Checking current contract states...");

  try {
    const ethPlannerOwner = await ethPlannerContract.owner();
    const erc20PlannerOwner = await erc20PlannerContract.owner();

    console.log(`ETH Planner Owner: ${ethPlannerOwner}`);
    console.log(`ERC20 Planner Owner: ${erc20PlannerOwner}`);

    // Check if wallet is owner
    if (wallet.address.toLowerCase() !== ethPlannerOwner.toLowerCase()) {
      throw new Error(`Wallet ${wallet.address} is not the owner of ETH Planner (owner: ${ethPlannerOwner})`);
    }
    if (wallet.address.toLowerCase() !== erc20PlannerOwner.toLowerCase()) {
      throw new Error(`Wallet ${wallet.address} is not the owner of ERC20 Planner (owner: ${erc20PlannerOwner})`);
    }

    // Check current allowed status
    const ethUsdcAllowed = await ethPlannerContract.allowedStable(BASE_CONFIG.tokens.usdc);
    const ethDaiAllowed = await ethPlannerContract.allowedStable(BASE_CONFIG.tokens.dai);
    const erc20UsdcAllowed = await erc20PlannerContract.allowedStable(BASE_CONFIG.tokens.usdc);
    const erc20DaiAllowed = await erc20PlannerContract.allowedStable(BASE_CONFIG.tokens.dai);

    console.log(`\n📊 Current allowed status:`);
    console.log(`ETH Planner - USDC: ${ethUsdcAllowed}, DAI: ${ethDaiAllowed}`);
    console.log(`ERC20 Planner - USDC: ${erc20UsdcAllowed}, DAI: ${erc20DaiAllowed}`);

    // Allow USDC and DAI in both contracts
    console.log(`\n⚙️ Setting stable tokens as allowed...`);

    const transactions = [];

    // ETH Planner transactions
    if (!ethUsdcAllowed) {
      console.log(`📤 Allowing USDC in ETH Planner...`);
      const tx = await ethPlannerContract.setStable(BASE_CONFIG.tokens.usdc, true);
      transactions.push({ name: 'ETH Planner - USDC', tx });
      console.log(`   TX: ${tx.hash}`);
    }

    if (!ethDaiAllowed) {
      console.log(`📤 Allowing DAI in ETH Planner...`);
      const tx = await ethPlannerContract.setStable(BASE_CONFIG.tokens.dai, true);
      transactions.push({ name: 'ETH Planner - DAI', tx });
      console.log(`   TX: ${tx.hash}`);
    }

    // ERC20 Planner transactions
    if (!erc20UsdcAllowed) {
      console.log(`📤 Allowing USDC in ERC20 Planner...`);
      const tx = await erc20PlannerContract.setStable(BASE_CONFIG.tokens.usdc, true);
      transactions.push({ name: 'ERC20 Planner - USDC', tx });
      console.log(`   TX: ${tx.hash}`);
    }

    if (!erc20DaiAllowed) {
      console.log(`📤 Allowing DAI in ERC20 Planner...`);
      const tx = await erc20PlannerContract.setStable(BASE_CONFIG.tokens.dai, true);
      transactions.push({ name: 'ERC20 Planner - DAI', tx });
      console.log(`   TX: ${tx.hash}`);
    }

    if (transactions.length === 0) {
      console.log(`✅ All stable tokens are already allowed!`);
      return;
    }

    // Wait for all transactions to be mined
    console.log(`\n⏳ Waiting for transactions to be mined...`);
    for (const { name, tx } of transactions) {
      console.log(`   Waiting for ${name}...`);
      const receipt = await tx.wait();
      console.log(`   ✅ ${name} mined in block ${receipt.blockNumber}`);
    }

    // Verify final state
    console.log(`\n🔍 Verifying final state...`);
    const finalEthUsdcAllowed = await ethPlannerContract.allowedStable(BASE_CONFIG.tokens.usdc);
    const finalEthDaiAllowed = await ethPlannerContract.allowedStable(BASE_CONFIG.tokens.dai);
    const finalErc20UsdcAllowed = await erc20PlannerContract.allowedStable(BASE_CONFIG.tokens.usdc);
    const finalErc20DaiAllowed = await erc20PlannerContract.allowedStable(BASE_CONFIG.tokens.dai);

    console.log(`📊 Final allowed status:`);
    console.log(`ETH Planner - USDC: ${finalEthUsdcAllowed}, DAI: ${finalEthDaiAllowed}`);
    console.log(`ERC20 Planner - USDC: ${finalErc20UsdcAllowed}, DAI: ${finalErc20DaiAllowed}`);

    if (finalEthUsdcAllowed && finalEthDaiAllowed && finalErc20UsdcAllowed && finalErc20DaiAllowed) {
      console.log(`\n🎉 All stable tokens are now allowed! The "stable not allowed" error should be fixed.`);
    } else {
      console.error(`\n❌ Some tokens may still not be allowed. Please check manually.`);
    }

  } catch (error) {
    console.error(`\n❌ Error checking or setting stable tokens:`, error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log(`\n✨ Script completed successfully!`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`\n💥 Script failed:`, error.message);
      process.exit(1);
    });
}

module.exports = { main };