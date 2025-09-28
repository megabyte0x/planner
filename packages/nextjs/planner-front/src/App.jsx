import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import BitcoinPage from './BitcoinPage';
import EthereumPage from './EthereumPage';
import BitcoinBuyPage from './BitcoinBuyPage';
import EthereumBuyPage from './EthereumBuyPage';
import PortfolioPage from './PortfolioPage';
import BuyDirectlyModal from './BuyDirectlyModal';
import SuccessCelebrationModal from './SuccessCelebrationModal';
import { ToastProvider, useToast } from './ToastProvider';
import usePythPrice from './hooks/usePythPrice';
import useWalletData from './hooks/useWalletData';
import DynamicPortfolio from './components/DynamicPortfolio';
import AnimatedPrice from './components/AnimatedPrice';
import './App.css'
import './Dashboard.css'

function AppContent() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'dashboard', 'bitcoin', 'portfolio'
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [buyModalToken, setBuyModalToken] = useState('BTC');
  const [showSuccess, setShowSuccess] = useState(false);
  const [purchaseData, setPurchaseData] = useState({ amount: '', token: 'BTC' });
  const { showError, showSuccess: showToastSuccess } = useToast();

  // Price feeds for dashboard
  const BTC_PRICE_ID = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
  const ETH_PRICE_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
  const { price: btcPrice, priceChange: btcPriceChange, loading: btcLoading } = usePythPrice(BTC_PRICE_ID);
  const { price: ethPrice, priceChange: ethPriceChange, loading: ethLoading } = usePythPrice(ETH_PRICE_ID);
  const { ensName, balances, loading: walletLoading, calculateTotalPortfolioValue } = useWalletData();

  // Calculate total portfolio value
  const totalPortfolioValue = calculateTotalPortfolioValue(btcPrice, ethPrice);
  const [previousPortfolioValue, setPreviousPortfolioValue] = useState(totalPortfolioValue);

  // Update previous value when total changes
  useEffect(() => {
    if (totalPortfolioValue !== previousPortfolioValue) {
      setTimeout(() => setPreviousPortfolioValue(totalPortfolioValue), 1000);
    }
  }, [totalPortfolioValue]);

  const connectWallet = async () => {
    try {
      // Check if MetaMask is installed
      if (typeof window.ethereum !== 'undefined') {
        // Switch to Base mainnet
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }], // Base mainnet chain ID
          });
        } catch (switchError) {
          // If Base mainnet is not added, add it
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x2105',
                  chainName: 'Base',
                  nativeCurrency: {
                    name: 'Ethereum',
                    symbol: 'ETH',
                    decimals: 18,
                  },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org'],
                }],
              });
            } catch (addError) {
              console.error('Error adding Base network:', addError);
              showError('Failed to add Base network. Please add it manually in MetaMask.');
              return;
            }
          } else {
            console.error('Error switching to Base network:', switchError);
            showError('Failed to switch to Base network. Please try again.');
            return;
          }
        }

        // Request account access
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsWalletConnected(true);
          setCurrentPage('dashboard');
        }
      } else {
        showError('MetaMask is not installed. Please install MetaMask to connect your wallet.');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      showError('Failed to connect wallet. Please try again.');
    }
  };

  const disconnectWallet = () => {
    setIsWalletConnected(false);
    setWalletAddress("");
    setCurrentPage('home');
  };

  const goToBitcoinPage = () => {
    setCurrentPage('bitcoin');
  };

  const goToEthereumPage = () => {
    setCurrentPage('ethereum');
  };

  const goToBitcoinBuyPage = () => {
    setCurrentPage('bitcoin-buy');
  };

  const goToEthereumBuyPage = () => {
    setCurrentPage('ethereum-buy');
  };

  const openBuyModal = (token) => {
    setBuyModalToken(token);
    setIsBuyModalOpen(true);
  };

  const handleBuyModalConfirm = (buyData) => {
    console.log('Buy directly confirmed:', buyData);
    setPurchaseData(buyData);
    setShowSuccess(true);
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
  };

  const goToPortfolioPage = () => {
    setCurrentPage('portfolio');
  };

  const goBack = () => {
    if (currentPage === 'bitcoin' || currentPage === 'ethereum' || currentPage === 'bitcoin-buy' || currentPage === 'ethereum-buy') {
      setCurrentPage('dashboard');
    } else if (currentPage === 'dashboard') {
      setCurrentPage('home');
    } else if (currentPage === 'portfolio') {
      setCurrentPage('dashboard');
    }
  };

  // If on Bitcoin page, show Bitcoin page
  if (currentPage === 'bitcoin') {
    return <BitcoinPage onBack={goBack} />;
  }
  
  // If on Ethereum page, show Ethereum page
  if (currentPage === 'ethereum') {
    return <EthereumPage onBack={goBack} />;
  }
  
  // If on Bitcoin Buy page, show Bitcoin Buy page
  if (currentPage === 'bitcoin-buy') {
    return <BitcoinBuyPage onBack={goBack} />;
  }
  
  // If on Ethereum Buy page, show Ethereum Buy page
  if (currentPage === 'ethereum-buy') {
    return <EthereumBuyPage onBack={goBack} />;
  }
  
  // If on Portfolio page, show Portfolio page
  if (currentPage === 'portfolio') {
    return <PortfolioPage onBack={goBack} />;
  }

  // If wallet is connected, show dashboard
  if (isWalletConnected && currentPage === 'dashboard') {
    return (
      <div className="dashboard-container">
        {/* Key Balance Section */}
        <div className="key-balance-section">
          <h2 className="section-title">Key Balance</h2>
          <DynamicPortfolio
            totalValue={totalPortfolioValue}
            previousValue={previousPortfolioValue}
            loading={walletLoading || btcLoading || ethLoading}
            btcPrice={btcPrice}
            ethPrice={ethPrice}
            balances={balances}
          />
          <button className="view-portfolio-btn" onClick={goToPortfolioPage}>View Portfolio</button>
        </div>

        {/* Connected Wallet Section */}
        <div className="connected-wallet-section">
          <h2 className="section-title">Connected Wallet</h2>
          <div className="wallet-card">
            <div className="wallet-avatar">
              <div className="avatar-icon">{ensName ? ensName.charAt(0).toUpperCase() : '🔥'}</div>
            </div>
            <div className="wallet-info">
              <div className="wallet-name">{walletLoading ? 'Loading...' : ensName || 'Wallet'}</div>
            </div>
            <button className="disconnect-btn" onClick={disconnectWallet}>
              <img src="/cancel-button.svg" alt="Disconnect" className="disconnect-icon" />
            </button>
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

          <div className="test-btc-card">
            <div className="test-btc-info">
              <div className="test-btc-icon">
                <img src="/btc.svg" alt="Bitcoin" />
              </div>
              <div className="test-btc-details">
                <div className="test-btc-name">Bitcoin</div>
                <div className="test-btc-price">
                  <AnimatedPrice
                    price={btcPrice}
                    priceChange={btcPriceChange}
                    loading={btcLoading}
                    decimals={0}
                  />
                </div>
              </div>
            </div>
            <button className="start-btn" onClick={goToBitcoinPage}>Start</button>
          </div>

          <div className="test-eth-card">
            <div className="test-eth-info">
              <div className="test-eth-icon">
                <img src="/eth.svg" alt="Ethereum" />
              </div>
              <div className="test-eth-details">
                <div className="test-eth-name">Ethereum</div>
                <div className="test-eth-price">
                  <AnimatedPrice
                    price={ethPrice}
                    priceChange={ethPriceChange}
                    loading={ethLoading}
                    decimals={0}
                  />
                </div>
              </div>
            </div>
            <button className="start-btn" onClick={goToEthereumPage}>Start</button>
          </div>
        </div>

        {/* Buy Directly Section */}
        <div className="buy-directly-section">
          <h2 className="section-title">Buy Directly!</h2>
          <p className="section-description">
            Skip the exchange delays—send funds directly to an ENS contract and instantly buy 
            when prices move sharply. A seamless way to act quickly during sudden highs or lows.
          </p>
          
          <div className="test-btc-card">
            <div className="test-btc-info">
              <div className="test-btc-icon">
                <img src="/btc.svg" alt="Bitcoin" />
              </div>
              <div className="test-btc-details">
                <div className="test-btc-name">Bitcoin</div>
                <div className="test-btc-price">
                  <AnimatedPrice
                    price={btcPrice}
                    priceChange={btcPriceChange}
                    loading={btcLoading}
                    decimals={0}
                  />
                </div>
              </div>
            </div>
            <button className="start-btn" onClick={() => openBuyModal('BTC')}>Start</button>
          </div>

          <div className="test-eth-card">
            <div className="test-eth-info">
              <div className="test-eth-icon">
                <img src="/eth.svg" alt="Ethereum" />
              </div>
              <div className="test-eth-details">
                <div className="test-eth-name">Ethereum</div>
                <div className="test-eth-price">
                  <AnimatedPrice
                    price={ethPrice}
                    priceChange={ethPriceChange}
                    loading={ethLoading}
                    decimals={0}
                  />
                </div>
              </div>
            </div>
            <button className="start-btn" onClick={() => openBuyModal('ETH')}>Start</button>
          </div>
        </div>

        {/* Buy Directly Modal */}
        <BuyDirectlyModal
          isOpen={isBuyModalOpen}
          onClose={() => setIsBuyModalOpen(false)}
          onConfirm={handleBuyModalConfirm}
          token={buyModalToken}
        />

        {/* Success Celebration Modal */}
        <SuccessCelebrationModal
          isOpen={showSuccess}
          onClose={handleSuccessClose}
          amount={purchaseData.amount}
          token={purchaseData.token}
        />
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
            <img src="/logo.svg" alt="Logo" className="logo-image" />
            
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

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App
