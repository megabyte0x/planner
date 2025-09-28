import { useState, useEffect } from 'react';

const useWalletData = () => {
  const [walletAddress, setWalletAddress] = useState('');
  const [ensName, setEnsName] = useState('');
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        if (!window.ethereum) {
          setError('No wallet detected');
          setLoading(false);
          return;
        }

        // Get wallet address
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });

        if (accounts.length > 0) {
          const address = accounts[0];
          setWalletAddress(address);

          // Try to resolve ENS name
          try {
            const response = await fetch(`https://api.ensideas.com/ens/reverse/${address}`);
            const data = await response.json();
            if (data.name) {
              setEnsName(data.name);
            } else {
              // Generate a short display address if no ENS
              setEnsName(`${address.slice(0, 6)}...${address.slice(-4)}`);
            }
          } catch (ensError) {
            console.log('ENS resolution failed, using short address');
            setEnsName(`${address.slice(0, 6)}...${address.slice(-4)}`);
          }

          // Fetch token balances
          await fetchTokenBalances(address);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching wallet data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchWalletData();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          fetchWalletData();
        } else {
          setWalletAddress('');
          setEnsName('');
          setBalances({});
        }
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
      }
    };
  }, []);

  const fetchTokenBalances = async (address) => {
    try {
      const tokenContracts = {
        USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
        WETH: '0x4200000000000000000000000000000000000006', // WETH on Base
      };

      const newBalances = {};

      // Get ETH balance
      try {
        const ethBalance = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest']
        });
        newBalances.ETH = parseFloat((parseInt(ethBalance, 16) / Math.pow(10, 18)).toFixed(6));
      } catch (ethError) {
        console.error('Error fetching ETH balance:', ethError);
        newBalances.ETH = 0;
      }

      // Get token balances
      for (const [symbol, contractAddress] of Object.entries(tokenContracts)) {
        try {
          const balance = await window.ethereum.request({
            method: 'eth_call',
            params: [{
              to: contractAddress,
              data: `0x70a08231000000000000000000000000${address.slice(2)}` // balanceOf(address)
            }, 'latest']
          });

          const decimals = symbol === 'USDC' ? 6 : 18;
          const balanceInToken = parseInt(balance, 16) / Math.pow(10, decimals);
          newBalances[symbol] = parseFloat(balanceInToken.toFixed(6));
        } catch (tokenError) {
          console.error(`Error fetching ${symbol} balance:`, tokenError);
          newBalances[symbol] = 0;
        }
      }

      setBalances(newBalances);
    } catch (error) {
      console.error('Error fetching token balances:', error);
    }
  };

  const calculateTotalPortfolioValue = (btcPrice, ethPrice) => {
    let total = 0;

    // Add ETH value
    if (balances.ETH && ethPrice) {
      total += balances.ETH * ethPrice;
    }

    // Add WETH value (same as ETH price)
    if (balances.WETH && ethPrice) {
      total += balances.WETH * ethPrice;
    }

    // Add USDC value (1:1 with USD)
    if (balances.USDC) {
      total += balances.USDC;
    }

    return total;
  };

  return {
    walletAddress,
    ensName,
    balances,
    loading,
    error,
    calculateTotalPortfolioValue,
    refetchBalances: () => fetchTokenBalances(walletAddress)
  };
};

export default useWalletData;