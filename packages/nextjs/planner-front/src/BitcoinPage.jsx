import { motion } from "framer-motion";
import { useState } from 'react';
import './BitcoinPage.css'
import InvestmentPlanModal from './InvestmentPlanModal';
import usePythPrice from './hooks/usePythPrice';
import useWalletData from './hooks/useWalletData';

function BitcoinPage({ onBack }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // BTC/USD price feed ID from Pyth
  const BTC_PRICE_ID = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
  const { price, priceChange, loading, error } = usePythPrice(BTC_PRICE_ID);
  const { balances, loading: walletLoading } = useWalletData();

  const btcHoldings = balances.WETH || 0; // Using WETH as proxy for BTC holdings

  const handleCreatePlan = () => {
    setIsModalOpen(true);
  };

  const handleModalConfirm = (planData) => {
    console.log('Investment plan created:', planData);
    // Here you would typically send the data to your backend
  };
  return (
    <div className="bitcoin-page-container">
      {/* Back Button */}
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>

      {/* Header Section with BTC Banner */}
      <div className="bitcoin-header">
        <h1 className="page-title">Bitcoin Price</h1>
        {loading ? (
          <div className="current-price">Loading...</div>
        ) : error ? (
          <div className="current-price">$98,000.00</div>
        ) : (
          <>
            <div className="current-price">
              ${price ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '98,000.00'}
            </div>
            <div className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
              {priceChange ? `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%` : '-7.76%'}
            </div>
          </>
        )}
      </div>

      {/* Bitcoin Asset Summary */}
      <div className="asset-summary">
        <div className="asset-info">
          <div className="asset-icon">
            <img src="/btc.svg" alt="Bitcoin" className="btc-icon" />
          </div>
          <div className="asset-details">
            <div className="asset-symbol">BTC</div>
            <div className="asset-name">Bitcoin</div>
          </div>
        </div>
        <div className="asset-value">
          <div className="value-amount">
            ${price ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '98,945.00'}
          </div>
          <div className="value-quantity">1.00 BTC</div>
        </div>
      </div>

      {/* Price Chart */}
      <div className="chart-container">
        <div className="chart-header">
          <h3>Price Chart</h3>
          <div className="chart-period">7D</div>
        </div>
        <div className="chart-placeholder">
          <svg className="chart-svg" viewBox="0 0 400 200">
            <defs>
              <linearGradient id="btcChartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05"/>
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
            <text x="35" y="25" className="chart-labels" textAnchor="end">100k</text>
            <text x="35" y="65" className="chart-labels" textAnchor="end">80k</text>
            <text x="35" y="105" className="chart-labels" textAnchor="end">60k</text>
            <text x="35" y="145" className="chart-labels" textAnchor="end">40k</text>
            <text x="35" y="185" className="chart-labels" textAnchor="end">20k</text>
            
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
            <path d="M 60 120 L 100 110 L 140 130 L 180 100 L 220 90 L 260 115 L 300 80 L 340 85 L 340 180 L 60 180 Z" className="chart-area"/>
            
            {/* Chart line */}
            <path d="M 60 120 L 100 110 L 140 130 L 180 100 L 220 90 L 260 115 L 300 80 L 340 85" className="chart-line"/>
          </svg>
        </div>
      </div>

      {/* Investment Summary */}
      <div className="investment-summary">
        <div className="summary-row">
          <span className="summary-label">Holdings Value</span>
          <span className="summary-value">
            {walletLoading || loading ? 'Loading...' :
              `$${(btcHoldings * (price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">24h Change</span>
          <span className={`summary-value ${priceChange >= 0 ? 'positive' : 'negative'}`}>
            {priceChange ? `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%` : '-7.76%'}
          </span>
        </div>
      </div>

      {/* Create Plan Button */}
      <motion.button 
        className="create-plan-btn"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCreatePlan}
      >
        Create a Plan
      </motion.button>

      {/* Instructional Text */}
      <div className="instruction-text">
        Choose how much you want to invest and how often — for example, ₹1,000 in Bitcoin every week or $50 in Bitcoin every day. Your purchases will run automatically, helping you average out the price over time.
      </div>

      {/* Investment Plan Modal */}
      <InvestmentPlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
      />
    </div>
  )
}

export default BitcoinPage
