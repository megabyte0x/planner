import { motion } from "framer-motion";
import './App.css'

function App() {
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
        >
          Connect Wallet
        </motion.button>
      </div>
    </div>
  )
}

export default App
