import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const AnimatedPrice = ({ price, priceChange, loading, currency = '$', decimals = 2 }) => {
  const [prevPrice, setPrevPrice] = useState(price);
  const [isIncreasing, setIsIncreasing] = useState(null);

  useEffect(() => {
    if (price && prevPrice && price !== prevPrice) {
      setIsIncreasing(price > prevPrice);
      setPrevPrice(price);
    } else if (price && !prevPrice) {
      setPrevPrice(price);
    }
  }, [price, prevPrice]);

  if (loading) {
    return <div className="loading-price">Loading...</div>;
  }

  const formatPrice = (value) => {
    if (!value) return '0.00';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  return (
    <div className="animated-price-container">
      <motion.div
        className="price-value"
        initial={{ scale: 1 }}
        animate={{
          scale: isIncreasing !== null ? [1, 1.05, 1] : 1,
          color: isIncreasing === true ? '#22c55e' : isIncreasing === false ? '#ef4444' : '#000'
        }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {currency}{formatPrice(price)}
      </motion.div>

      {priceChange !== null && (
        <motion.div
          className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.span
            animate={{
              scale: Math.abs(priceChange) > 1 ? [1, 1.1, 1] : 1
            }}
            transition={{ duration: 0.4 }}
          >
            {priceChange >= 0 ? '↗' : '↘'} {Math.abs(priceChange).toFixed(2)}%
          </motion.span>
        </motion.div>
      )}
    </div>
  );
};

export default AnimatedPrice;