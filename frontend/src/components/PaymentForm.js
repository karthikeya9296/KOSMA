import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import CircleAPI from './CircleAPI'; // Assuming Circle API integration in a separate file
import SuperfluidSDK from '@superfluid-finance/js-sdk'; // Superfluid SDK
import { useLit } from './useLitProtocol'; // Custom hook for Lit Protocol encryption
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'; // Ledger Transport
import Ledger from '@ledgerhq/hw-app-eth'; // Ledger Ethereum app
import KosmaPaymentsABI from './abi/KosmaPayments.json'; // KosmaPayments.sol ABI

const PaymentForm = ({ kosmaPaymentsAddress }) => {
  const [amount, setAmount] = useState('');
  const [paymentReason, setPaymentReason] = useState('');
  const [paymentType, setPaymentType] = useState('one-time');
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('Circle USDC');
  const [usdToUsdcRate, setUsdToUsdcRate] = useState(null); // Exchange rate
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [ledgerConnected, setLedgerConnected] = useState(false);
  const [encryptedPaymentDetails, setEncryptedPaymentDetails] = useState(null);

  const { encryptData } = useLit(); // Custom Lit Protocol hook for encryption

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();

  // Initialize Superfluid SDK
  const sf = new SuperfluidSDK.Framework({
    ethers: provider,
  });

  // Initialize KosmaPayments contract
  const kosmaPaymentsContract = new ethers.Contract(
    kosmaPaymentsAddress,
    KosmaPaymentsABI,
    signer
  );

  // Fetch real-time USDC exchange rate (mocked)
  const fetchExchangeRate = useCallback(async () => {
    try {
      // Assuming backend API fetches the exchange rate
      const rate = await CircleAPI.getUSDCExchangeRate(); // Get exchange rate from Circle API
      setUsdToUsdcRate(rate);
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  }, []);

  // Handle form submission
  const handlePayment = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      // Client-side form validation
      if (!amount || !paymentReason || !walletAddress) {
        setErrorMessage('Please complete all fields.');
        setLoading(false);
        return;
      }

      const usdcAmount = ethers.utils.parseUnits(amount, 6); // USDC has 6 decimals

      // Encrypt payment details with Lit Protocol
      const encryptedDetails = await encryptData({
        amount,
        paymentReason,
        walletAddress,
      });
      setEncryptedPaymentDetails(encryptedDetails);

      // One-time payment via Circle USDC
      if (paymentType === 'one-time' && selectedMethod === 'Circle USDC') {
        const approvalTx = await kosmaPaymentsContract.approve(
          kosmaPaymentsAddress,
          usdcAmount
        );
        await approvalTx.wait();

        const paymentTx = await kosmaPaymentsContract.depositUSDC(
          usdcAmount,
          encryptedDetails
        );
        await paymentTx.wait();
        alert('One-time payment successful!');
      }

      // Streaming payment via Superfluid
      if (paymentType === 'streaming' && selectedMethod === 'Superfluid') {
        const superfluidUser = sf.user({
          address: walletAddress,
          token: sf.tokens.fUSDCx.address, // Superfluid USDC token
        });

        const flowRate = calculateFlowRate(usdcAmount); // Function to calculate flow rate
        await superfluidUser.flow({
          recipient: kosmaPaymentsAddress,
          flowRate,
        });

        alert('Streaming payment initiated!');
      }
    } catch (error) {
      setErrorMessage('Payment failed. Please try again.');
      console.error('Error processing payment:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Ledger wallet connection
  const connectLedger = async () => {
    try {
      const transport = await TransportWebUSB.create();
      const ledger = new Ledger(transport);
      const result = await ledger.getAddress("44'/60'/0'/0/0");
      setWalletAddress(result.address);
      setLedgerConnected(true);
    } catch (error) {
      console.error('Error connecting to Ledger:', error);
      setErrorMessage('Failed to connect Ledger wallet.');
    }
  };

  // Handle amount and other field changes
  const handleChange = (setter) => (e) => {
    setter(e.target.value);
  };

  useEffect(() => {
    fetchExchangeRate(); // Fetch exchange rate on component load
  }, [fetchExchangeRate]);

  // Utility function to calculate Superfluid flow rate (example implementation)
  const calculateFlowRate = (usdcAmount) => {
    // Assuming the subscription is per second
    return usdcAmount.div(30 * 24 * 60 * 60); // Example flow rate for monthly payments
  };

  return (
    <div className="payment-form">
      <h2>Payment Form</h2>
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label>Amount (USDC):</label>
          <input
            type="number"
            value={amount}
            onChange={handleChange(setAmount)}
            required
            placeholder="Enter amount"
          />
        </div>

        <div className="form-group">
          <label>Payment Reason:</label>
          <input
            type="text"
            value={paymentReason}
            onChange={handleChange(setPaymentReason)}
            required
            placeholder="e.g., Tipping, Content Purchase"
          />
        </div>

        <div className="form-group">
          <label>Wallet Address:</label>
          <input
            type="text"
            value={walletAddress}
            onChange={handleChange(setWalletAddress)}
            required
            placeholder="Enter wallet address"
            disabled={ledgerConnected}
          />
        </div>

        <div className="form-group">
          <label>Payment Type:</label>
          <select
            value={paymentType}
            onChange={handleChange(setPaymentType)}
            required
          >
            <option value="one-time">One-time Payment</option>
            <option value="streaming">Streaming Payment</option>
          </select>
        </div>

        <div className="form-group">
          <label>Payment Method:</label>
          <select
            value={selectedMethod}
            onChange={handleChange(setSelectedMethod)}
            required
          >
            <option value="Circle USDC">Circle USDC</option>
            <option value="Superfluid">Superfluid</option>
          </select>
        </div>

        {usdToUsdcRate && (
          <p>1 USD ≈ {usdToUsdcRate} USDC</p>
        )}

        <button
          type="submit"
          onClick={handlePayment}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Submit Payment'}
        </button>

        {!ledgerConnected && (
          <button
            type="button"
            onClick={connectLedger}
            disabled={loading}
          >
            {loading ? 'Connecting Ledger...' : 'Connect Ledger Wallet'}
          </button>
        )}
      </form>
    </div>
  );
};

export default PaymentForm;
