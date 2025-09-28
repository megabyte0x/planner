import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './DynamicPortfolio.css';

const DynamicPortfolio = ({
  totalValue,
  previousValue,
  loading,
  btcPrice,
  ethPrice,
  balances = {}
}) => {
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const [portfolioChange, setPortfolioChange] = useState(0);

  useEffect(() => {
    if (totalValue && previousValue && totalValue !== previousValue) {
      setPortfolioChange(((totalValue - previousValue) / previousValue) * 100);
      setAnimationTrigger(prev => prev + 1);
    }
  }, [totalValue, previousValue]);

  if (loading) {
    return (
      <div className="dynamic-portfolio loading">
        <div className="portfolio-skeleton">
          <div className="skeleton-line big"></div>
          <div className="skeleton-line small"></div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value) => {
    if (!value) return '$0.00';
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3
    })}`;
  };

  const getPortfolioBreakdown = () => {
    const total = totalValue || 1; // Avoid division by zero
    return [
      {
        asset: 'ETH',
        value: ((balances.ETH || 0) + (balances.WETH || 0)) * (ethPrice || 0),
        percentage: (((balances.ETH || 0) + (balances.WETH || 0)) * (ethPrice || 0)) / total * 100,
        color: '#627eea'
      },
      {
        asset: 'USDC',
        value: balances.USDC || 0,
        percentage: (balances.USDC || 0) / total * 100,
        color: '#2775ca'
      }
    ].filter(item => item.value > 0);
  };

  const breakdown = getPortfolioBreakdown();

  return (
    <div className="dynamic-portfolio">
      <motion.div
        className="portfolio-value"
        key={animationTrigger}
        initial={{ scale: 1 }}
        animate={{
          scale: [1, 1.02, 1],
          color: portfolioChange > 0 ? '#22c55e' : portfolioChange < 0 ? '#ef4444' : '#000'
        }}
        transition={{ duration: 0.5 }}
      >
        {formatCurrency(totalValue)}
      </motion.div>

      {portfolioChange !== 0 && (
        <motion.div
          className={`portfolio-change ${portfolioChange >= 0 ? 'positive' : 'negative'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <span className="change-icon">
            {portfolioChange >= 0 ? '📈' : '📉'}
          </span>
          {portfolioChange >= 0 ? '+' : ''}{portfolioChange.toFixed(2)}%
        </motion.div>
      )}

      <div className="portfolio-breakdown">
        {breakdown.map((item, index) => (
          <motion.div
            key={item.asset}
            className="breakdown-item"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
          >
            <div
              className="asset-indicator"
              style={{ backgroundColor: item.color }}
            ></div>
            <span className="asset-name">{item.asset}</span>
            <span className="asset-percentage">
              {item.percentage.toFixed(1)}%
            </span>
            <span className="asset-value">
              {formatCurrency(item.value)}
            </span>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="live-indicator"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.6, 1, 0.6]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        🔴 Live
      </motion.div>
    </div>
  );
};

export default DynamicPortfolio;