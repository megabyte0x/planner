import React, { useEffect } from 'react';
import './SuccessCelebrationModal.css';

const SuccessCelebrationModal = ({ isOpen, onClose, amount, token }) => {
  useEffect(() => {
    if (isOpen) {
      // Auto close after 3 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="celebration-overlay">
      {/* Celebration Background */}
      <div className="celebration-background">
        <img src="/celebration.svg" alt="Celebration" className="celebration-svg" />
      </div>
      
      {/* Success Content */}
      <div className="success-content">
        {/* Success Icon with Tick */}
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="tick-mark">
            <circle cx="12" cy="12" r="10" fill="url(#tickGradient)"/>
            <path d="M8 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="tickGradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#22c55e"/>
                <stop offset="1" stopColor="#16a34a"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        {/* Success Message */}
        <div className="success-message">
          <div className="amount-text">{amount} of {token}</div>
          <div className="success-text">bought successfully !</div>
        </div>
      </div>
    </div>
  );
};

export default SuccessCelebrationModal;
