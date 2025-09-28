import React from 'react';
import './PortfolioPage.css';
import usePythPrice from './hooks/usePythPrice';
import useWalletData from './hooks/useWalletData';

const PortfolioPage = ({ onBack }) => {
  // BTC/USD and ETH/USD price feeds
  const BTC_PRICE_ID = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
  const ETH_PRICE_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

  const { price: btcPrice, priceChange: btcPriceChange, loading: btcLoading } = usePythPrice(BTC_PRICE_ID);
  const { price: ethPrice, priceChange: ethPriceChange, loading: ethLoading } = usePythPrice(ETH_PRICE_ID);

  const { walletAddress, ensName, balances, loading: walletLoading, calculateTotalPortfolioValue } = useWalletData();

  // Calculate portfolio values
  const totalPortfolioValue = calculateTotalPortfolioValue(btcPrice, ethPrice);
  const btcHoldings = balances.WETH || 0; // Using WETH as proxy for BTC holdings
  const btcValue = btcHoldings * (btcPrice || 0);

  return (
    <div className="portfolio-page">
      {/* Header */}
      <div className="portfolio-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="profile-section">
          <div className="profile-avatar">{ensName ? ensName.charAt(0).toUpperCase() : 'W'}</div>
          <span className="profile-name">{walletLoading ? 'Loading...' : ensName || 'Wallet'}</span>
        </div>
      </div>

      {/* Key Balance Section */}
      <div className="key-balance-section">
        <h2 className="balance-label">Key Balance</h2>
        <div className="balance-amount">
          {walletLoading || btcLoading || ethLoading ?
            '$Loading...' :
            `$${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`
          }
        </div>
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
              <div className="price">
                {btcLoading ? '$Loading...' : `$${btcPrice ? btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '98,000.00'}`}
              </div>
              <div className={`price-change ${btcPriceChange >= 0 ? 'positive' : 'negative'}`}>
                {btcPriceChange ? `${btcPriceChange >= 0 ? '+' : ''}${btcPriceChange.toFixed(2)}%` : '-7.76%'}
              </div>
            </div>
          </div>
          <div className="crypto-stats">
            <div className="stat-row">
              <span className="stat-label">Holdings</span>
              <span className="stat-value">{walletLoading ? 'Loading...' : `${btcHoldings.toFixed(6)} BTC`}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Current Value</span>
              <span className="stat-value">
                {walletLoading || btcLoading ? 'Loading...' : `$${btcValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">24h Change</span>
              <span className={`stat-value ${btcPriceChange >= 0 ? 'positive' : 'negative'}`}>
                {btcPriceChange ? `${btcPriceChange >= 0 ? '+' : ''}${btcPriceChange.toFixed(2)}%` : '+0.00%'}
              </span>
            </div>
          </div>
        </div>

        {/* ETH Card */}
        <div className="holding-card">
          <div className="crypto-icon">
            <img src="/eth.svg" alt="Ethereum" className="crypto-symbol-img" />
          </div>
          <div className="crypto-info">
            <div className="crypto-symbol">ETH</div>
            <div className="crypto-name">Ethereum</div>
            <div className="price-info">
              <div className="price">
                {ethLoading ? '$Loading...' : `$${ethPrice ? ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '4,300.00'}`}
              </div>
              <div className={`price-change ${ethPriceChange >= 0 ? 'positive' : 'negative'}`}>
                {ethPriceChange ? `${ethPriceChange >= 0 ? '+' : ''}${ethPriceChange.toFixed(2)}%` : '+7.76%'}
              </div>
            </div>
          </div>
          <div className="crypto-stats">
            <div className="stat-row">
              <span className="stat-label">Holdings</span>
              <span className="stat-value">{walletLoading ? 'Loading...' : `${(balances.ETH + (balances.WETH || 0)).toFixed(6)} ETH`}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Current Value</span>
              <span className="stat-value">
                {walletLoading || ethLoading ? 'Loading...' : `$${((balances.ETH + (balances.WETH || 0)) * (ethPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">24h Change</span>
              <span className={`stat-value ${ethPriceChange >= 0 ? 'positive' : 'negative'}`}>
                {ethPriceChange ? `${ethPriceChange >= 0 ? '+' : ''}${ethPriceChange.toFixed(2)}%` : '+0.00%'}
              </span>
            </div>
          </div>
        </div>

        {/* USDC Card */}
        <div className="holding-card">
          <div className="crypto-icon">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#2775ca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>USDC</div>
          </div>
          <div className="crypto-info">
            <div className="crypto-symbol">USDC</div>
            <div className="crypto-name">USD Coin</div>
            <div className="price-info">
              <div className="price">$1.00</div>
              <div className="price-change neutral">+0.00%</div>
            </div>
          </div>
          <div className="crypto-stats">
            <div className="stat-row">
              <span className="stat-label">Holdings</span>
              <span className="stat-value">{walletLoading ? 'Loading...' : `${(balances.USDC || 0).toFixed(2)} USDC`}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Current Value</span>
              <span className="stat-value">
                {walletLoading ? 'Loading...' : `$${(balances.USDC || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">24h Change</span>
              <span className="stat-value neutral">+0.00%</span>
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
            <div className="transaction-creator">Created By: {ensName || 'Wallet'}</div>
          </div>
        </div>

        <div className="transaction-item">
          <div className="transaction-main">
            <span className="block-number">Block #1831239</span>
            <div className="deposit-tag">My deposit: 0.853</div>
          </div>
          <div className="transaction-side">
            <span className="timestamp">1 Day ago</span>
            <div className="transaction-creator">Created By: {ensName || 'Wallet'}</div>
          </div>
        </div>

        <div className="transaction-item">
          <div className="transaction-main">
            <span className="block-number">Block #1831239</span>
            <div className="deposit-tag">My deposit: 0.662</div>
          </div>
          <div className="transaction-side">
            <span className="timestamp">2 Days ago</span>
            <div className="transaction-creator">Created By: {ensName || 'Wallet'}</div>
          </div>
        </div>

        <div className="transaction-item">
          <div className="transaction-main">
            <span className="block-number">Block #1831239</span>
            <div className="deposit-tag">My deposit: 0.652</div>
          </div>
          <div className="transaction-side">
            <span className="timestamp">3 Days ago</span>
            <div className="transaction-creator">Created By: {ensName || 'Wallet'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

      export default PortfolioPage;
