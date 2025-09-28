import { useState, useEffect } from 'react';
import { HermesClient } from '@pythnetwork/hermes-client';

const usePythPrice = (priceId) => {
  const [price, setPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let intervalId;

    const fetchPrice = async () => {
      try {
        const client = new HermesClient("https://hermes.pyth.network");

        const priceUpdates = await client.getLatestPriceUpdates([priceId]);

        if (priceUpdates && priceUpdates.parsed && priceUpdates.parsed.length > 0) {
          const priceData = priceUpdates.parsed[0];
          const currentPrice = parseFloat(priceData.price.price) * Math.pow(10, priceData.price.expo);
          const prevPrice = parseFloat(priceData.prev_price?.price || priceData.price.price) * Math.pow(10, priceData.prev_price?.expo || priceData.price.expo);

          setPrice(currentPrice);

          if (prevPrice && prevPrice !== currentPrice) {
            const change = ((currentPrice - prevPrice) / prevPrice) * 100;
            setPriceChange(change);
          }
        }

        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error fetching Pyth price:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (priceId) {
      fetchPrice();

      // Update price every 10 seconds
      intervalId = setInterval(fetchPrice, 10000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [priceId]);

  return { price, priceChange, loading, error };
};

export default usePythPrice;