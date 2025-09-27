import { motion } from "framer-motion";
import './BitcoinPage.css'

function BitcoinPage({ onBack }) {
  return (
    <div className="bitcoin-page-container">
      {/* Back Button */}
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>

      {/* Header Section with BTC Banner */}
      <div className="bitcoin-header">
        <h1 className="page-title">Bitcoin Price</h1>
        <div className="current-price">$98,000.00</div>
        <div className="price-change negative">-7.76%</div>
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
          <div className="value-amount">$98,945.00</div>
          <div className="value-quantity">1.00 BTC</div>
        </div>
      </div>

      {/* Price Chart */}
      <div className="chart-container">
        <div className="chart">
          <div className="chart-grid">
            <div className="y-axis">
              <span>15k</span>
              <span>12k</span>
              <span>9k</span>
              <span>6k</span>
              <span>3k</span>
              <span>0k</span>
            </div>
            <div className="chart-line"></div>
          </div>
          <div className="x-axis">
            <span>Mon 15</span>
            <span>Tue 16</span>
            <span>Wed 17</span>
            <span>Thu 18</span>
            <span>Fri 19</span>
            <span>Sat 20</span>
            <span>Sun 21</span>
            <span>Mon 22</span>
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

      {/* Create Plan Button */}
      <motion.button 
        className="create-plan-btn"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Create a Plan
      </motion.button>

      {/* Instructional Text */}
      <div className="instruction-text">
        Choose how much you want to invest and how often — for example, ₹1,000 in Ethereum every week or $50 in Bitcoin every day. Your purchases will run automatically, helping you average out the price over time.
      </div>
    </div>
  )
}

export default BitcoinPage
