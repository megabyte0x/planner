const { ethers } = require('ethers');
require('dotenv').config();

const ETH_PLANNER_ABI = [
  'function plans(address user) view returns (tuple(address stable, uint256 amount, uint256 interval, uint256 nextExec, bool active))',
  'function allowedStable(address stable) view returns (bool)',
];

async function checkExistingPlan() {
  try {
    console.log('🔍 Checking existing DCA plan...');

    // Setup provider
    const rpcUrl = process.env.BASE_RPC_HTTP || "https://base-mainnet.g.alchemy.com/v2/YUOPnilJ5zuIqykiGiqZJdqhcmP9k9Ya";
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // Setup wallet
    const privateKey = process.env.WATCHER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('WATCHER_PRIVATE_KEY environment variable is required');
    }
    const wallet = new ethers.Wallet(privateKey, provider);

    // Setup contract
    const ethPlannerAddress = process.env.BASE_ETH_PLANNER || "0x4Ed34E5B1e85080ef5011dCd7272e4Cfd9ef5060";
    const contract = new ethers.Contract(ethPlannerAddress, ETH_PLANNER_ABI, provider);

    console.log(`📋 ETH Planner Contract: ${ethPlannerAddress}`);
    console.log(`👤 User Address: ${wallet.address}`);

    // Check the plan
    const planData = await contract.plans(wallet.address);

    console.log('\n📊 Plan Data:');
    console.log(`  • Active: ${planData.active}`);
    console.log(`  • Stable Token: ${planData.stable}`);
    console.log(`  • Amount: ${ethers.utils.formatUnits(planData.amount, 6)} USDC`);
    console.log(`  • Interval: ${planData.interval} seconds`);
    console.log(`  • Next Execution: ${new Date(planData.nextExec * 1000).toISOString()}`);

    if (planData.active) {
      console.log('\n✅ Plan is ACTIVE and should be loaded by PlanScheduler');

      // Check if the next execution time makes sense
      const nextExecTime = new Date(planData.nextExec * 1000);
      const now = new Date();
      const timeDiff = nextExecTime.getTime() - now.getTime();

      if (timeDiff > 0) {
        console.log(`⏰ Next execution in: ${Math.round(timeDiff / 1000)} seconds`);
      } else {
        console.log(`⚠️  Next execution was ${Math.round(-timeDiff / 1000)} seconds ago (should have executed already)`);
      }

    } else {
      console.log('\n❌ Plan is NOT ACTIVE');
    }

    // Check USDC allowance
    const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const isUsdcAllowed = await contract.allowedStable(usdcAddress);
    console.log(`\n💰 USDC Allowed: ${isUsdcAllowed}`);

  } catch (error) {
    console.error('❌ Error checking plan:', error);
  }
}

// Execute the script
if (require.main === module) {
  checkExistingPlan();
}

module.exports = { checkExistingPlan };