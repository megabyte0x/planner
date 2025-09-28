const { ethers } = require('ethers');
require('dotenv').config();

const ETH_PLANNER_ABI = [
  'function createPlan(address stable, uint256 amount, uint256 interval) external',
  'function plans(address user) view returns (tuple(address stable, uint256 amount, uint256 interval, uint256 nextExec, bool active))',
  'function allowedStable(address stable) view returns (bool)',
  'event PlanCreated(address indexed user, address indexed stable, uint256 amount, uint256 interval, uint256 firstExecAt)'
];

// Network configurations (matching networks.ts)
const NETWORKS = {
  base: {
    name: "base",
    chainId: 8453,
    rpcHttp: process.env.BASE_RPC_HTTP || "https://base-mainnet.g.alchemy.com/v2/YUOPnilJ5zuIqykiGiqZJdqhcmP9k9Ya",
    contracts: {
      ethPlanner: process.env.BASE_ETH_PLANNER || "0x5CbAFAE58F8722673026032d4975a85F79e1299f",
    },
    tokens: {
      usdc: process.env.USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDbC on Base
    }
  }
};

async function createDCAPlan() {
  try {
    console.log('🚀 Creating DCA Plan on ETH_Planner...');

    // Get network configuration
    const networkName = process.env.NETWORK_NAME || 'base';
    const network = NETWORKS[networkName];

    if (!network) {
      throw new Error(`Unsupported network: ${networkName}`);
    }

    console.log(`📡 Using network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`📋 ETH Planner Contract: ${network.contracts.ethPlanner}`);

    // Setup provider and signer
    const provider = new ethers.providers.JsonRpcProvider(network.rpcHttp);
    const privateKey = process.env.WATCHER_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error('WATCHER_PRIVATE_KEY environment variable is required');
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`👤 Using wallet: ${wallet.address}`);

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Wallet balance: ${ethers.utils.formatEther(balance)} ETH`);

    if (balance.lt(ethers.utils.parseEther('0.001'))) {
      console.warn('⚠️  Low wallet balance, transaction may fail');
    }

    // Setup contract
    const contract = new ethers.Contract(network.contracts.ethPlanner, ETH_PLANNER_ABI, wallet);

    // Plan parameters
    const stableToken = network.tokens.usdc;
    const amount = ethers.utils.parseUnits('0.1', 6); // 0.1 USDC (6 decimals)
    const interval = 30; // 30 seconds

    console.log('📊 Plan Parameters:');
    console.log(`  • Stable Token: ${stableToken} (USDC)`);
    console.log(`  • Amount: 0.1 USDC per interval`);
    console.log(`  • Interval: ${interval} seconds`);

    // Check if USDC is allowed
    console.log('🔍 Checking if USDC is allowed...');
    const isAllowed = await contract.allowedStable(stableToken);
    console.log(`  • USDC allowed: ${isAllowed}`);

    if (!isAllowed) {
      console.error('❌ USDC is not allowed as stable token on this contract');
      console.log('💡 Tip: Run allowStables.js script first to allow USDC');
      process.exit(1);
    }

    // Check if user already has a plan
    console.log('🔍 Checking existing plans...');
    const existingPlan = await contract.plans(wallet.address);
    console.log(`  • Existing plan active: ${existingPlan.active}`);

    if (existingPlan.active) {
      console.log('📋 Existing plan details:');
      console.log(`  • Stable: ${existingPlan.stable}`);
      console.log(`  • Amount: ${ethers.utils.formatUnits(existingPlan.amount, 6)} USDC`);
      console.log(`  • Interval: ${existingPlan.interval} seconds`);
      console.log(`  • Next Execution: ${new Date(existingPlan.nextExec * 1000).toISOString()}`);

      console.error('❌ Plan already exists for this address');
      process.exit(1);
    }

    // Estimate gas
    console.log('⛽ Estimating gas...');
    const gasEstimate = await contract.estimateGas.createPlan(stableToken, amount, interval);
    console.log(`  • Gas estimate: ${gasEstimate.toString()}`);

    // Get gas price
    const feeData = await provider.getFeeData();
    console.log(`  • Gas price: ${ethers.utils.formatUnits(feeData.gasPrice, 'gwei')} gwei`);

    // Create the plan
    console.log('🔄 Creating plan...');
    const tx = await contract.createPlan(stableToken, amount, interval, {
      gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
      gasPrice: feeData.gasPrice
    });

    console.log(`📨 Transaction sent: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);

    // Parse the PlanCreated event
    const planCreatedEvent = receipt.events?.find(e => e.event === 'PlanCreated');
    if (planCreatedEvent) {
      const { user, stable, amount: eventAmount, interval: eventInterval, firstExecAt } = planCreatedEvent.args;

      console.log('🎉 Plan Created Successfully!');
      console.log(`  • User: ${user}`);
      console.log(`  • Stable: ${stable}`);
      console.log(`  • Amount: ${ethers.utils.formatUnits(eventAmount, 6)} USDC per interval`);
      console.log(`  • Interval: ${eventInterval} seconds`);
      console.log(`  • First Execution: ${new Date(firstExecAt * 1000).toISOString()}`);
    }

    // Verify the plan was created
    console.log('🔍 Verifying plan creation...');
    const newPlan = await contract.plans(wallet.address);
    if (newPlan.active) {
      console.log('✅ Plan verification successful!');
      console.log('📋 Final plan details:');
      console.log(`  • Stable: ${newPlan.stable}`);
      console.log(`  • Amount: ${ethers.utils.formatUnits(newPlan.amount, 6)} USDC`);
      console.log(`  • Interval: ${newPlan.interval} seconds`);
      console.log(`  • Next Execution: ${new Date(newPlan.nextExec * 1000).toISOString()}`);
    } else {
      console.error('❌ Plan verification failed - plan not active');
    }

  } catch (error) {
    console.error('❌ Error creating plan:', error);

    if (error.code === 'CALL_EXCEPTION') {
      console.log('💡 Possible causes:');
      console.log('  • Contract may have onlyOwner modifier - check if you\'re using the owner\'s private key');
      console.log('  • USDC might not be allowed - run allowStables.js first');
      console.log('  • Plan might already exist for this address');
      console.log('  • Insufficient gas or funds');
    }

    process.exit(1);
  }
}

// Execute the script
if (require.main === module) {
  createDCAPlan();
}

module.exports = { createDCAPlan };