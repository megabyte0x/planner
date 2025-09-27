import React from 'react';
import './EthereumBuyPage.css';

const EthereumBuyPage = ({ onBack }) => {
  return (
    <div className="ethereum-buy-page">
      {/* Back Button */}
      <button className="back-btn" onClick={onBack}>← Back</button>

      {/* Header Section with Banner */}
      <div className="ethereum-header">
        <h1 className="page-title">Ethereum Price</h1>
        
        {/* Ethereum Price Display */}
        <div className="price-section">
          <div className="current-price">$4,300.00</div>
          <div className="price-change positive">+7.76%</div>
        </div>
      </div>

      {/* Ethereum Asset Summary */}
      <div className="asset-summary">
        <div className="asset-info">
          <div className="asset-icon">
            <img src="/eth.svg" alt="Ethereum" className="eth-icon" />
          </div>
          <div className="asset-details">
            <div className="asset-symbol">ETH</div>
            <div className="asset-name">Ethereum</div>
          </div>
        </div>
        <div className="asset-value">
          <div className="value-amount">$4,300.00</div>
          <div className="value-quantity">1.00 ETH</div>
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
          <span className="summary-label">Total Investments</span>
          <span className="summary-value">139,071</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Current Values</span>
          <span className="summary-value">139,071</span>
        </div>
      </div>

      {/* Buy Directly Button */}
      <button className="buy-directly-btn">Buy Directly</button>

      {/* Instructional Text */}
      <div className="instruction-text">
        Skip the exchange delays—send funds directly to an ENS contract and instantly buy 
        when prices move sharply. A seamless way to act quickly during sudden highs or lows.
      </div>
    </div>
  );
};

export default EthereumBuyPage;
