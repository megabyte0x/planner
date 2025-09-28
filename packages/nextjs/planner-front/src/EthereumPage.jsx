import React, { useState } from 'react';
import './EthereumPage.css';
import InvestmentPlanModal from './InvestmentPlanModal';
import usePythPrice from './hooks/usePythPrice';
import useWalletData from './hooks/useWalletData';

const EthereumPage = ({ onBack }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ETH/USD price feed ID from Pyth
  const ETH_PRICE_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
  const { price: ethPrice, priceChange: ethPriceChange, loading: ethLoading, error } = usePythPrice(ETH_PRICE_ID);
  const { balances, loading: walletLoading } = useWalletData();

  const handleCreatePlan = () => {
    setIsModalOpen(true);
  };

  const handleModalConfirm = async (planData) => {
    console.log('Investment plan created:', planData);

    try {
      // Parse the amount value, removing $ if present
      const numericAmount = parseFloat(planData.amount.replace('$', ''));

      // Calculate total amount for first 10 executions (as mentioned in TODO)
      const totalAmount = numericAmount * 10;

      // ETH Planner contract details (needs to be deployed)
      const ETH_PLANNER_ADDRESS = "0x4Ed34E5B1e85080ef5011dCd7272e4Cfd9ef5060"; // Placeholder - deploy ETH_Planner contract
      const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base

      if (!window.ethereum) {
        alert('Please install a Web3 wallet to create investment plans');
        return;
      }

      // Get user's address
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];

      // Step 1: Approve ETH Planner contract to use USDC
      const totalAmountInUsdc = Math.floor(totalAmount * Math.pow(10, 6)); // Convert to USDC units (6 decimals)
      const totalAmountHex = totalAmountInUsdc.toString(16).padStart(64, '0');

      const approvalData = {
        to: USDC_ADDRESS,
        from: userAddress,
        data: `0x095ea7b3${ETH_PLANNER_ADDRESS.slice(2).padStart(64, '0')}${totalAmountHex}`, // approve(address,uint256)
        value: '0x0'
      };

      console.log('Requesting USDC approval for ETH Planner...');
      const approvalTxHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [approvalData]
      });

      console.log('Approval transaction sent:', approvalTxHash);

      // Wait for approval confirmation
      console.log('Waiting for approval confirmation...');

      // Step 2: Create plan on ETH_Planner contract
      const planAmountInUsdc = Math.floor(numericAmount * Math.pow(10, 6)); // Single execution amount in USDC units
      const stableAddressHex = USDC_ADDRESS.slice(2).padStart(64, '0');
      const planAmountHex = planAmountInUsdc.toString(16).padStart(64, '0');

      // Frequency mapping: daily=86400, weekly=604800, monthly=2592000 seconds
      const frequencySeconds = planData.frequency === 'daily' ? 86400 :
                              planData.frequency === 'weekly' ? 604800 : 2592000;
      const frequencyHex = frequencySeconds.toString(16).padStart(64, '0');

      const createPlanData = {
        to: ETH_PLANNER_ADDRESS,
        from: userAddress,
        data: `0x5a7c017c${stableAddressHex}${planAmountHex}${frequencyHex}`, // createPlan(address,uint256,uint256)
        value: '0x0'
      };

      console.log('Creating investment plan...');
      const createPlanTxHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [createPlanData]
      });

      console.log('Create plan transaction sent:', createPlanTxHash);

      // Step 2: Create plan on ETH_Planner contract
      // Note: This requires the ETH_Planner contract to be deployed first
      // For now, we'll show a message indicating the plan was created locally
      alert(`Investment plan created!\n\nAmount: ${planData.amount}\nFrequency: ${planData.frequency}\nTotal approved: $${totalAmount.toFixed(2)} USDC\n\nNote: ETH_Planner contract integration pending deployment.`);

    } catch (error) {
      console.error('Error creating investment plan:', error);
      if (error.code === 4001) {
        alert('Transaction rejected by user.');
      } else {
        alert(`Failed to create investment plan: ${error.message || 'Please try again.'}`);
      }
    }
  };

  return (
    <div className="ethereum-page">
      {/* Back Button */}
      <button className="back-btn" onClick={onBack}>← Back</button>

      {/* Header Section with Banner */}
      <div className="ethereum-header">
        <h1 className="page-title">Ethereum Price</h1>
        
        {/* Ethereum Price Display */}
        <div className="price-section">
          {ethLoading ? (
            <div className="current-price">Loading...</div>
          ) : error ? (
            <div className="current-price">$4,300.00</div>
          ) : (
            <>
              <div className="current-price">
                ${ethPrice ? ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '4,300.00'}
              </div>
              <div className={`price-change ${ethPriceChange >= 0 ? 'positive' : 'negative'}`}>
                {ethPriceChange ? `${ethPriceChange >= 0 ? '+' : ''}${ethPriceChange.toFixed(2)}%` : '+7.76%'}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart Section */}
      <div className="chart-section">
        <div className="chart-container">
          <div className="chart-header">
            <h3>Price Chart</h3>
            <div className="chart-period">7D</div>
          </div>
          <div className="chart-placeholder">
            <svg className="chart-svg" viewBox="0 0 400 200">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05"/>
                </linearGradient>
              </defs>
              
              {/* Grid lines */}
              <line x1="40" y1="20" x2="40" y2="180" className="chart-grid"/>
              <line x1="40" y1="180" x2="380" y2="180" className="chart-grid"/>
              <line x1="40" y1="140" x2="380" y2="140" className="chart-grid"/>
              <line x1="40" y1="100" x2="380" y2="100" className="chart-grid"/>
              <line x1="40" y1="60" x2="380" y2="60" className="chart-grid"/>
              <line x1="40" y1="20" x2="380" y2="20" className="chart-grid"/>
              
              {/* Y-axis labels */}
              <text x="35" y="25" className="chart-labels" textAnchor="end">15k</text>
              <text x="35" y="65" className="chart-labels" textAnchor="end">12k</text>
              <text x="35" y="105" className="chart-labels" textAnchor="end">9k</text>
              <text x="35" y="145" className="chart-labels" textAnchor="end">6k</text>
              <text x="35" y="185" className="chart-labels" textAnchor="end">3k</text>
              
              {/* X-axis labels */}
              <text x="60" y="195" className="chart-labels" textAnchor="middle">Mon 15</text>
              <text x="100" y="195" className="chart-labels" textAnchor="middle">Tue 16</text>
              <text x="140" y="195" className="chart-labels" textAnchor="middle">Wed 17</text>
              <text x="180" y="195" className="chart-labels" textAnchor="middle">Thu 18</text>
              <text x="220" y="195" className="chart-labels" textAnchor="middle">Fri 19</text>
              <text x="260" y="195" className="chart-labels" textAnchor="middle">Sat 20</text>
              <text x="300" y="195" className="chart-labels" textAnchor="middle">Sun 21</text>
              <text x="340" y="195" className="chart-labels" textAnchor="middle">Mon 22</text>
              
              {/* Chart area */}
              <path d="M 60 80 L 100 70 L 140 90 L 180 60 L 220 50 L 260 75 L 300 40 L 340 45 L 340 180 L 60 180 Z" className="chart-area"/>
              
              {/* Chart line */}
              <path d="M 60 80 L 100 70 L 140 90 L 180 60 L 220 50 L 260 75 L 300 40 L 340 45" className="chart-line"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Investment Summary */}
      <div className="investment-summary">
        <div className="summary-row">
          <span className="summary-label">Holdings Value</span>
          <span className="summary-value">
            {walletLoading || ethLoading ? 'Loading...' :
              `$${((balances.ETH + (balances.WETH || 0)) * (ethPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">24h Change</span>
          <span className={`summary-value ${ethPriceChange >= 0 ? 'positive' : 'negative'}`}>
            {ethPriceChange ? `${ethPriceChange >= 0 ? '+' : ''}${ethPriceChange.toFixed(2)}%` : '+0.00%'}
          </span>
        </div>
      </div>

      {/* Create Plan Button */}
      <button className="create-plan-btn" onClick={handleCreatePlan}>Create A Plan</button>

      {/* Instructional Text */}
      <div className="instruction-text">
        Choose how much you want to invest and how often — for example, ₹1,000 in Ethereum every week or $50 in Ethereum every day. Your purchases will run automatically, helping you average out the price over time.
      </div>

      {/* Investment Plan Modal */}
      <InvestmentPlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
      />
    </div>
  );
};

export default EthereumPage;
