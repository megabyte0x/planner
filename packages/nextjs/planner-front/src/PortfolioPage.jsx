import React from 'react';
import './PortfolioPage.css';

const PortfolioPage = ({ onBack }) => {
  return (
    <div className="portfolio-page">
      {/* Header */}
      <div className="portfolio-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="profile-section">
          <div className="profile-avatar">M</div>
          <span className="profile-name">Megabyte.eth</span>
        </div>
      </div>

      {/* Key Balance Section */}
      <div className="key-balance-section">
        <h2 className="balance-label">Key Balance</h2>
        <div className="balance-amount">$12,931.523</div>
      </div>

      {/* Holdings Section */}
      <div className="holdings-section">
        <h2 className="section-title">Holdings</h2>

        {/* BTC Card */}
        <div className="holding-card">
          <div className="crypto-icon">
            <img src="/btc-holding.svg" alt="Bitcoin" className="crypto-symbol-img" />
          </div>
          <div className="crypto-info">
            <div className="crypto-symbol">BTC</div>
            <div className="crypto-name">Bitcoin</div>
            <div className="price-info">
              <div className="price">$98000.00</div>
              <div className="price-change negative">-7.76%</div>
            </div>
          </div>
          <div className="crypto-stats">
            <div className="stat-row">
              <span className="stat-label">Total Investments</span>
              <span className="stat-value">139,071</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Current Values</span>
              <span className="stat-value">139,071</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Profit</span>
              <span className="stat-value positive">+5.32%</span>
            </div>
          </div>
        </div>

        {/* BTC Card */}
        <div className="holding-card">
          <div className="crypto-icon">
            <img src="/btc-holding.svg" alt="Bitcoin" className="crypto-symbol-img" />
          </div>
          <div className="crypto-info">
            <div className="crypto-symbol">BTC</div>
            <div className="crypto-name">Bitcoin</div>
            <div className="price-info">
              <div className="price">$98000.00</div>
              <div className="price-change negative">-7.76%</div>
            </div>
          </div>
          <div className="crypto-stats">
            <div className="stat-row">
              <span className="stat-label">Total Investments</span>
              <span className="stat-value">139,071</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Current Values</span>
              <span className="stat-value">139,071</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Profit</span>
              <span className="stat-value positive">+5.32%</span>
            </div>
          </div>
        </div>

        {/* BTC Card */}
        <div className="holding-card">
          <div className="crypto-icon">
            <img src="/btc-holding.svg" alt="Bitcoin" className="crypto-symbol-img" />
          </div>
          <div className="crypto-info">
            <div className="crypto-symbol">BTC</div>
            <div className="crypto-name">Bitcoin</div>
            <div className="price-info">
              <div className="price">$98000.00</div>
              <div className="price-change negative">-7.76%</div>
            </div>
          </div>
          <div className="crypto-stats">
            <div className="stat-row">
              <span className="stat-label">Total Investments</span>
              <span className="stat-value">139,071</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Current Values</span>
              <span className="stat-value">139,071</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Profit</span>
              <span className="stat-value positive">+5.32%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Transactions Section */}
      <div className="transactions-section">
        <h2 className="section-title">Last Transactions</h2>
        
        <div className="transaction-item">
          <div className="transaction-main">
            <span className="block-number">Block #1831239</span>
            <div className="deposit-tag">My deposit: 0.412</div>
          </div>
          <div className="transaction-side">
            <span className="timestamp">03:15</span>
            <div className="transaction-creator">Created By: @Username.eth</div>
          </div>
        </div>

        <div className="transaction-item">
          <div className="transaction-main">
            <span className="block-number">Block #1831239</span>
            <div className="deposit-tag">My deposit: 0.853</div>
          </div>
          <div className="transaction-side">
            <span className="timestamp">1 Day ago</span>
            <div className="transaction-creator">Created By: @Username.eth</div>
          </div>
        </div>

        <div className="transaction-item">
          <div className="transaction-main">
            <span className="block-number">Block #1831239</span>
            <div className="deposit-tag">My deposit: 0.662</div>
          </div>
          <div className="transaction-side">
            <span className="timestamp">2 Days ago</span>
            <div className="transaction-creator">Created By: @Username.eth</div>
          </div>
        </div>

        <div className="transaction-item">
          <div className="transaction-main">
            <span className="block-number">Block #1831239</span>
            <div className="deposit-tag">My deposit: 0.652</div>
          </div>
          <div className="transaction-side">
            <span className="timestamp">3 Days ago</span>
            <div className="transaction-creator">Created By: @Username.eth</div>
          </div>
        </div>
      </div>
    </div>
  );
};

      export default PortfolioPage;
