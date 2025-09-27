import React, { useState } from 'react';
import './BuyDirectlyModal.css';

const BuyDirectlyModal = ({ isOpen, onClose, onConfirm, token = 'BTC' }) => {
  const [amount, setAmount] = useState('');

  const presetAmounts = ['$1', '$5', '$10', '$20', '$50', '$75', '$100', '$200', '$500', '$1000'];

  const handleAmountClick = (presetAmount) => {
    setAmount(presetAmount);
  };

  const handleConfirm = () => {
    if (amount) {
      // Call the original confirm handler with amount and token
      onConfirm({ amount, token });
      
      // Close the buy modal
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* Back Button */}
        <button className="modal-back-btn" onClick={onClose}>← Back</button>
        
        <h2 className="modal-title">Buy Directly in one go !</h2>
        
        {/* Amount Input */}
        <div className="input-group">
          <input
            type="text"
            placeholder="Enter an Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="amount-input"
          />
        </div>

        {/* Preset Amount Buttons */}
        <div className="preset-amounts">
          {presetAmounts.map((presetAmount) => (
            <button
              key={presetAmount}
              className={`preset-btn ${amount === presetAmount ? 'active' : ''}`}
              onClick={() => handleAmountClick(presetAmount)}
            >
              {presetAmount}
            </button>
          ))}
        </div>

        {/* Description */}
        <p className="modal-description">
          Skip the exchange delays—send funds directly to an ENS contract and instantly buy 
          when prices move sharply. A seamless way to act quickly during sudden highs or lows.
        </p>

        {/* Send Button */}
        <button 
          className="send-btn" 
          onClick={handleConfirm}
          disabled={!amount}
        >
          Send to planner.eth
        </button>
      </div>
    </div>
  );
};

export default BuyDirectlyModal;
