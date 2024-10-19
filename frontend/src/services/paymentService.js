import axios from 'axios';
import { ethers } from 'ethers';
import SuperfluidSDK from '@superfluid-finance/js-sdk'; // Superfluid SDK for streaming payments
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'; // LedgerJS for secure transaction authorization
import Ledger from '@ledgerhq/hw-app-eth'; // LedgerJS for signing Ethereum-based payments

// Base URL for payment-related API routes (adjust as per your backend)
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-api.com/payment';

// Helper function to get the authentication token securely
const getAuthToken = () => localStorage.getItem('authToken');

// Helper function to check token expiration (JWT decoding)
const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const decoded = JSON.parse(atob(token.split('.')[1]));
    return decoded.exp * 1000 < Date.now(); // Check expiration time
  } catch (error) {
    return true; // Return true if decoding fails (indicates an invalid token)
  }
};

// Centralized error handling with logging
const handleError = (error, fallbackMessage) => {
  const message = error.response?.data?.message || fallbackMessage || 'An error occurred. Please try again.';
  console.error(`Error: ${message}`, error); // Log the error for debugging
  throw new Error(message); // Throw error to propagate it
};

const paymentService = {
  // 1. Make a one-time payment using Circle USDC for tipping or content purchases
  async makeOneTimePayment({ recipientAddress, amount }) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      const response = await axios.post(
        `${API_URL}/one-time-payment`,
        { recipientAddress, amount },
        {
          headers: {
            Authorization: `Bearer ${authToken}`, // Secure API calls with a valid token
          },
        }
      );

      return response.data; // Return success message or transaction details
    } catch (error) {
      handleError(error, 'Failed to process the payment.');
    }
  },

  // 2. Initiate streaming payments using Superfluid (e.g., for subscriptions)
  async startStreamingPayment({ recipientAddress, flowRate, tokenAddress }) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      // Initialize Superfluid SDK
      const sf = new SuperfluidSDK.Framework({
        ethers: new ethers.providers.Web3Provider(window.ethereum), // Ensure Ethereum provider is connected
      });
      await sf.initialize();

      // Create a new Superfluid user
      const user = sf.user({
        address: recipientAddress,
        token: tokenAddress, // Superfluid token (e.g., fUSDCx)
      });

      // Start streaming payment
      const result = await user.flow({
        recipient: recipientAddress,
        flowRate, // Flow rate in wei/second (e.g., "1000000000" for 1 token per second)
      });

      return result; // Return streaming payment details
    } catch (error) {
      handleError(error, 'Failed to start the streaming payment.');
    }
  },

  // 3. View transaction/payment history
  async getTransactionHistory() {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      const response = await axios.get(`${API_URL}/transaction-history`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      return response.data; // Return list of transactions
    } catch (error) {
      handleError(error, 'Failed to retrieve transaction history.');
    }
  },

  // 4. Secure payment authorization using Ledger wallet
  async authorizePaymentWithLedger({ recipientAddress, amount, tokenAddress }) {
    try {
      const transport = await TransportWebUSB.create();
      const ledger = new Ledger(transport);

      // Get Ethereum wallet address from Ledger
      const { address } = await ledger.getAddress("44'/60'/0'/0/0");

      // Build transaction details
      const transaction = {
        to: recipientAddress,
        value: ethers.utils.parseEther(amount), // Convert amount to wei
        gasPrice: ethers.utils.parseUnits('20', 'gwei'), // Optional gas price
        chainId: 1, // Ethereum mainnet chain ID
      };

      // Sign transaction using Ledger wallet
      const signedTx = await ledger.signTransaction("44'/60'/0'/0/0", transaction);

      // Broadcast signed transaction via backend
      const response = await axios.post(
        `${API_URL}/broadcast-transaction`,
        { signedTx, tokenAddress },
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`, // Attach token for authentication
          },
        }
      );

      return response.data; // Return transaction confirmation
    } catch (error) {
      handleError(error, 'Failed to authorize payment with Ledger.');
    }
  },
};

export default paymentService;
