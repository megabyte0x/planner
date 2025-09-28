import React, { useState } from 'react';
import './EthereumBuyPage.css';
import BuyDirectlyModal from './BuyDirectlyModal';
import SuccessCelebrationModal from './SuccessCelebrationModal';

const EthereumBuyPage = ({ onBack }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [purchaseData, setPurchaseData] = useState({ amount: '', token: 'ETH' });

  const handleBuyDirectly = () => {
    setIsModalOpen(true);
  };

  const handleModalConfirm = (buyData) => {
    console.log('Buy directly confirmed:', buyData);
    // Here you would typically send the data to your backend
    
    // Show success celebration
    setPurchaseData(buyData);
    setShowSuccess(true);
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
  };

  return (
    <div className="ethereum-buy-page">
      {/* Back Button */}
      <button className="back-btn" onClick={onBack}>← Back</button>

      {/* Header Section */}
      <div className="ethereum-header">
        <h1 className="page-title">Buy Ethereum Directly</h1>
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


      {/* Buy Directly Button */}
      <button className="buy-directly-btn" onClick={handleBuyDirectly}>Buy Directly</button>

      {/* Instructional Text */}
      <div className="instruction-text">
        Skip the exchange delays—send funds directly to an ENS contract and instantly buy 
        when prices move sharply. A seamless way to act quickly during sudden highs or lows.
      </div>

      {/* Buy Directly Modal */}
      <BuyDirectlyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        token="ETH"
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
};

export default EthereumBuyPage;
