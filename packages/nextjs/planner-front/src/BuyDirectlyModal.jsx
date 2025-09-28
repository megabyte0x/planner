import React, { useState, useEffect } from 'react';
import './BuyDirectlyModal.css';
import { useToast } from './ToastProvider';

const BuyDirectlyModal = ({ isOpen, onClose, onConfirm, token = 'BTC' }) => {
  const [amount, setAmount] = useState('');
  const [usdcBalance, setUsdcBalance] = useState('0.00');
  const [isLoading, setIsLoading] = useState(false);
  const { showError, showSuccess } = useToast();

  const presetAmounts = ['1', '5', '10', '20', '50', '75', '100', '200', '500', '1000'];

  // ENS domain mapping
  const ensDomains = {
    'BTC': 'btc.swapswap.eth',
    'ETH': 'eth.swapswap.eth'
  };

  const targetDomain = ensDomains[token] || 'btc.swapswap.eth';

  const handleAmountClick = (presetAmount) => {
    setAmount(presetAmount);
  };

  // Fetch USDC balance
  useEffect(() => {
    const fetchUsdcBalance = async () => {
      if (isOpen && window.ethereum) {
        try {
          // USDC contract address on Base mainnet
          const usdcContractAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
          
          // Get user's address
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          const userAddress = accounts[0];
          
          // Call balanceOf function on USDC contract
          const balance = await window.ethereum.request({
            method: 'eth_call',
            params: [{
              to: usdcContractAddress,
              data: `0x70a08231000000000000000000000000${userAddress.slice(2)}` // balanceOf(address)
            }, 'latest']
          });
          
          // Convert from wei to USDC (6 decimals)
          const balanceInUsdc = parseInt(balance, 16) / Math.pow(10, 6);
          setUsdcBalance(balanceInUsdc.toFixed(2));
        } catch (error) {
          console.error('Error fetching USDC balance:', error);
          setUsdcBalance('0.00');
        }
      }
    };

    fetchUsdcBalance();
  }, [isOpen]);

  const handleConfirm = async () => {
    if (amount && !isLoading) {
      setIsLoading(true);

      try {
        // Get user's address
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const userAddress = accounts[0];

        // USDC contract address on Base mainnet
        const usdcContractAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

        // Convert amount to USDC units (6 decimals)
        const amountInUsdc = Math.floor(parseFloat(amount) * Math.pow(10, 6));
        const amountHex = '0x' + amountInUsdc.toString(16).padStart(16, '0');

        // Use placeholder address for now
        const placeholderAddresses = {
          'btc.swapswap.eth': '0x2B7A919B1B1eFbbDCBb941d7e85e124bFBe0F146',
          'eth.swapswap.eth': '0x4Ed34E5B1e85080ef5011dCd7272e4Cfd9ef5060'
        };
        const targetAddress = placeholderAddresses[targetDomain] || '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
        
        // Prepare the transfer transaction
        const transferData = {
          to: usdcContractAddress,
          from: userAddress,
          data: `0xa9059cbb${targetAddress.slice(2).padStart(64, '0')}${amountHex.slice(2).padStart(64, '0')}`, // transfer(address,uint256)
          value: '0x0'
        };
        
        // Send the transaction
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [transferData]
        });
        
        console.log('Transaction sent:', txHash);
        
        // Wait for transaction confirmation (optional)
        // In a real app, you might want to wait for confirmation
        // const receipt = await waitForTransactionReceipt(txHash);
        
        // Call the original confirm handler with transaction details
        onConfirm({ 
          amount, 
          token, 
          paymentMethod: 'USDC',
          txHash,
          targetDomain,
          targetAddress
        });
        
        // Close the buy modal
        onClose();
        
      } catch (error) {
        console.error('Error processing payment:', error);
        if (error.code === 4001) {
          showError('Transaction rejected by user.');
        } else if (error.code === -32603) {
          showError('Transaction failed. Please check your USDC balance and try again.');
        } else {
          showError(`Payment failed: ${error.message || 'Please try again.'}`);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* Back Button */}
        <button className="modal-back-btn" onClick={onClose}>←</button>
        
        <h2 className="modal-title">Buy Directly in one go !</h2>
        
        {/* USDC Balance Display */}
        <div className="balance-section">
          <div className="balance-label">Available Balance</div>
          <div className="balance-amount">
            <span className="balance-value">{usdcBalance}</span>
            <span className="balance-currency">USDC</span>
          </div>
        </div>
        
        {/* Amount Input */}
        <div className="input-group">
          <label className="input-label">Amount in USDC</label>
          <input
            type="number"
            placeholder="Enter amount in USDC"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="amount-input"
            step="0.01"
            min="0"
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
              ${presetAmount}
            </button>
          ))}
        </div>

        {/* Send Button */}
        <button
          className="send-btn"
          onClick={handleConfirm}
          disabled={!amount || isLoading || parseFloat(amount) > parseFloat(usdcBalance) || parseFloat(amount) < 0.5}
        >
          {isLoading ? 'Sending USDC...' : `Send to ${targetDomain}`}
        </button>
        
        {parseFloat(amount) > parseFloat(usdcBalance) && amount && (
          <div className="error-message">
            Insufficient USDC balance
          </div>
        )}

        {parseFloat(amount) < 0.5 && amount && (
          <div className="error-message">
            Minimum amount is 0.5 USDC
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyDirectlyModal;
