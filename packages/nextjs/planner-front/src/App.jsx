import { motion } from "framer-motion";
import { useState } from "react";
import './App.css'
import './Dashboard.css'

function App() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  const connectWallet = async () => {
    try {
      // Check if MetaMask is installed
      if (typeof window.ethereum !== 'undefined') {
        // Request account access
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsWalletConnected(true);
        }
      } else {
        alert('MetaMask is not installed. Please install MetaMask to connect your wallet.');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const disconnectWallet = () => {
    setIsWalletConnected(false);
    setWalletAddress("");
  };

  // If wallet is connected, show dashboard
  if (isWalletConnected) {
    return (
      <div className="dashboard-container">
        {/* Key Balance Section */}
        <div className="key-balance-section">
          <h2 className="section-title">Key Balance</h2>
          <div className="balance-amount">$12,931.523</div>
          <button className="view-portfolio-btn">View Portfolio</button>
        </div>

        {/* Connected Wallet Section */}
        <div className="connected-wallet-section">
          <h2 className="section-title">Connected Wallet</h2>
          <div className="wallet-card">
            <div className="wallet-avatar">
              <div className="avatar-icon">🔥</div>
            </div>
            <div className="wallet-info">
              <div className="wallet-name">Megabyte.eth</div>
            </div>
            <button className="disconnect-btn" onClick={disconnectWallet}>×</button>
          </div>
        </div>

        {/* Create a Plan Section */}
        <div className="create-plan-section">
          <h2 className="section-title">Create a Plan</h2>
          <p className="section-description">
            Automate your Bitcoin and Ethereum purchases on an hourly, daily, or weekly basis. 
            Smooth out market volatility with a disciplined DCA strategy that keeps your average 
            entry price balanced over time.
          </p>
          
          <div className="crypto-cards">
            <div className="crypto-card">
              {/* <div className="crypto-icon ethereum-icon"> */}
                {/* <img src="/eth-frame.png" alt="Ethereum" /> */}
              {/* </div> */}
              <div className="crypto-info">
                <div className="crypto-name">Ethereum</div>
                <div className="crypto-price">$4300 <span className="price-change positive">+5.32%</span></div>
              </div>
              <button className="start-btn">Start</button>
            </div>

            <div className="crypto-card">
              {/* <div className="crypto-icon bitcoin-icon"> */}
                {/* <img src="/btc-frame.svg" alt="Bitcoin" /> */}
              {/* </div> */}
              <div className="crypto-info">
                <div className="crypto-name">Bitcoin</div>
                <div className="crypto-price">$98,000 <span className="price-change negative">-7.76%</span></div>
              </div>
              <button className="start-btn">Start</button>
            </div>
          </div>
        </div>

        {/* Buy Directly Section */}
        <div className="buy-directly-section">
          <h2 className="section-title">Buy Directly!</h2>
          <p className="section-description">
            Skip the exchange delays—send funds directly to an ENS contract and instantly buy 
            when prices move sharply. A seamless way to act quickly during sudden highs or lows.
          </p>
          
          <div className="crypto-cards">
            <div className="crypto-card">
              {/* <div className="crypto-icon ethereum-icon">
                <img src="/eth-frame.png" alt="Ethereum" />
              </div> */}
              <div className="crypto-info">
                <div className="crypto-name">Ethereum</div>
                <div className="crypto-price">$4300 <span className="price-change positive">+5.32%</span></div>
              </div>
              <button className="start-btn">Start</button>
            </div>

            <div className="crypto-card">
              {/* <div className="crypto-icon bitcoin-icon">
                <img src="/btc-frame.svg" alt="Bitcoin" />
              </div> */}
              <div className="crypto-info">
                <div className="crypto-name">Bitcoin</div>
                <div className="crypto-price">$98,000 <span className="price-change negative">-7.76%</span></div>
              </div>
              <button className="start-btn">Start</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Original homepage when wallet is not connected
  return (
    <div className="mobile-app-container">
      {/* Main Content */}
      <div className="main-content">
        {/* Central Logo with Floating Icons */}
        <div className="logo-container">
          <motion.div 
            className="logo"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <img src="/Vector.png" alt="Logo" className="logo-image" />
            
            {/* Bitcoin icons - left side (pink) */}
            <div className="crypto-icon bitcoin-left-1">
              <img src="/bitcoin-logo.png" alt="Bitcoin" />
            </div>

            <div className="crypto-icon bitcoin-left-2">
              <img src="/bitcoin-logo.svg" alt="Bitcoin" />
            </div>
            
            {/* Highlighted Bitcoin icon - top center (blue outline) */}
            <div className="crypto-icon bitcoin-top">
              <img src="/Group.svg" alt="Bitcoin" />
            </div>
            
            {/* Ethereum icons - right side (purple) */}
            <div className="crypto-icon ethereum-right-1">
              <img src="/path0.png" alt="Ethereum" />
            </div>

            <div className="crypto-icon ethereum-right-2">
              <img src="/path0.svg" alt="Ethereum" />
            </div>

            <div className="crypto-icon ethereum-right-3">
              <img src="/path0-2.svg" alt="Ethereum" />
            </div>
          </motion.div>
        </div>

        {/* Text Content */}
        <motion.div 
          className="text-container"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <p className="main-text">
            Invest in Crypto, Smarter & Faster
          </p>
        </motion.div>

        {/* Connect Wallet Button */}
        <motion.button 
          className="connect-button"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={connectWallet}
        >
          Connect Wallet
        </motion.button>
      </div>
    </div>
  )
}

export default App
