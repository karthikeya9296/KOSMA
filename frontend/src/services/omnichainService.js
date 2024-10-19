import axios from 'axios';
import LayerZeroMessaging from './LayerZeroMessaging'; // LayerZero SDK for cross-chain interactions

// Base URL for cross-chain-related API routes (adjust as per your backend)
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-api.com/omnichain';

// Helper function to securely get the authentication token
const getAuthToken = () => localStorage.getItem('authToken');

// Helper function to securely check JWT token expiration
const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const decoded = JSON.parse(atob(token.split('.')[1]));
    return decoded.exp * 1000 < Date.now(); // Check if the token is expired based on its `exp` field
  } catch (error) {
    console.error('Token decoding failed:', error);
    return true; // Return true if decoding fails, assuming an invalid or expired token
  }
};

// Function to get headers with the authorization token
const authHeaders = () => {
  const authToken = getAuthToken();
  if (!authToken || isTokenExpired(authToken)) {
    throw new Error('Session expired. Please log in again.');
  }

  return {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
};

// Centralized error handling with logging and user-friendly messages
const handleError = (error, fallbackMessage) => {
  const message = error.response?.data?.message || fallbackMessage || 'An unexpected error occurred. Please try again.';
  console.error(`Error: ${message}`, error); // Log the error for debugging
  throw new Error(message); // Throw the error to propagate it further
};

// Helper to ensure interaction with LayerZero is properly formatted and errors are handled
const interactWithLayerZero = async (action, params) => {
  try {
    return await LayerZeroMessaging[action](params); // Dynamically call LayerZero methods based on action
  } catch (error) {
    handleError(error, `Failed to ${action} with LayerZero.`);
  }
};

// Function to cache history to reduce redundant requests
const getCachedHistory = (walletAddress) => {
  const cachedHistory = sessionStorage.getItem(`crossChainHistory_${walletAddress}`);
  return cachedHistory ? JSON.parse(cachedHistory) : null;
};

const omnichainService = {
  // 1. Cross-Chain NFT Transfer via LayerZero
  async transferNFT({ nftId, fromChain, toChain, walletAddress }) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      // Use a helper for LayerZero interactions to ensure proper error handling
      const transferResponse = await interactWithLayerZero('transferNFT', {
        nftId,
        fromChain,
        toChain,
        userAddress: walletAddress,
      });

      // Optionally, send the transfer details to the backend for tracking
      const response = await axios.post(`${API_URL}/transfer-nft`, {
        nftId,
        fromChain,
        toChain,
        walletAddress,
        transferDetails: transferResponse, // Transfer confirmation data from LayerZero
      }, {
        headers: authHeaders(),
      });

      return response.data; // Return confirmation from the backend or LayerZero
    } catch (error) {
      handleError(error, 'Failed to transfer NFT across chains.');
    }
  },

  // 2. Cross-Chain Messaging via LayerZero
  async sendCrossChainMessage({ message, fromChain, toChain, walletAddress }) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      // Use the helper for LayerZero interactions
      const messageResponse = await interactWithLayerZero('sendMessage', {
        message,
        fromChain,
        toChain,
        userAddress: walletAddress,
      });

      // Optionally, send the message details to the backend for tracking
      const response = await axios.post(`${API_URL}/send-message`, {
        message,
        fromChain,
        toChain,
        walletAddress,
        messageDetails: messageResponse, // Confirmation from LayerZero
      }, {
        headers: authHeaders(),
      });

      return response.data; // Return message confirmation from the backend or LayerZero
    } catch (error) {
      handleError(error, 'Failed to send cross-chain message.');
    }
  },

  // 3. View Cross-Chain Interaction History with caching
  async getCrossChainHistory(walletAddress) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      const cachedHistory = getCachedHistory(walletAddress);
      if (cachedHistory) return cachedHistory; // Return cached history if available

      // Fetch the cross-chain interaction history from the backend
      const response = await axios.get(`${API_URL}/cross-chain-history`, {
        params: { walletAddress },
        headers: authHeaders(),
      });

      // Cache the history for future use
      sessionStorage.setItem(`crossChainHistory_${walletAddress}`, JSON.stringify(response.data));

      return response.data; // Return the history of cross-chain interactions
    } catch (error) {
      handleError(error, 'Failed to retrieve cross-chain interaction history.');
    }
  },

  // 4. Generic method to handle any future cross-chain operations with LayerZero
  async handleLayerZeroAction(action, params) {
    try {
      const result = await interactWithLayerZero(action, params);
      return result;
    } catch (error) {
      handleError(error, `Failed to complete ${action}.`);
    }
  },
};

export default omnichainService;
