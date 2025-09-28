import React, { useState } from 'react';
import './InvestmentPlanModal.css';

const InvestmentPlanModal = ({ isOpen, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);

  const presetAmounts = ['$1', '$5', '$10', '$20', '$50', '$75', '$100', '$200', '$500', '$1000'];
  const frequencies = ['Hourly', 'Daily', 'Weekly'];

  const handleAmountClick = (presetAmount) => {
    setAmount(presetAmount);
  };

  const handleConfirm = () => {
    if (!amount || !frequency) return;

    // Parse the amount value, removing $ if present
    const numericAmount = parseFloat(amount.replace('$', ''));

    // If the amount is less than 0.5 USDC, return without doing anything
    if (numericAmount < 0.5) {
      alert('Minimum investment amount is $0.5 USDC');
      return;
    }

    onConfirm({ amount, frequency });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">Set Your Investment Plan</h2>
        
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

        {/* Frequency Dropdown */}
        <div className="input-group">
          <div className="frequency-dropdown" onClick={() => setShowFrequencyDropdown(!showFrequencyDropdown)}>
            <span className="frequency-text">{frequency}</span>
            <span className="dropdown-arrow">▼</span>
          </div>
          
          {showFrequencyDropdown && (
            <div className="frequency-options">
              {frequencies.map((freq) => (
                <div
                  key={freq}
                  className={`frequency-option ${frequency === freq ? 'selected' : ''}`}
                  onClick={() => {
                    setFrequency(freq);
                    setShowFrequencyDropdown(false);
                  }}
                >
                  {freq}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="modal-description">
          Automate your Bitcoin and Ethereum purchases on an hourly, daily, or weekly basis. 
          Smooth out market volatility with a disciplined DCA strategy that keeps your average 
          entry price balanced over time.
        </p>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="confirm-btn" 
            onClick={handleConfirm}
            disabled={!amount || !frequency}
          >
            Start Investing
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvestmentPlanModal;
