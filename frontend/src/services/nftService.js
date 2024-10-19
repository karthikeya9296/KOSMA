import axios from 'axios';
import FlowClient from '@onflow/fcl'; // Flow Blockchain SDK
import LayerZeroMessaging from './LayerZeroMessaging'; // LayerZero for cross-chain NFT transfers
import jwt_decode from 'jwt-decode'; // JWT decoding for token expiration checks

// Base URL for NFT-related API routes (adjust as per your backend)
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-api.com/nft';

// Helper function to get the authentication token
const getAuthToken = () => localStorage.getItem('authToken');

// Helper function to decode and check JWT token expiration
const isTokenExpired = (token) => {
  if (!token) return true;
  const decoded = jwt_decode(token);
  return decoded.exp * 1000 < Date.now(); // Checks if the token has expired
};

const nftService = {
  // 1. Mint NFT using Flow Blockchain (FlowNFT.sol)
  async mintNFT({ contentId, metadata, walletAddress }) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      const response = await axios.post(
        `${API_URL}/mint`,
        {
          contentId,
          metadata, // Metadata like title, description, etc.
          walletAddress,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`, // Attach token for authenticated requests
          },
        }
      );

      return response.data; // Return success message or minted NFT metadata
    } catch (error) {
      this.handleError(error, 'Failed to mint NFT.');
    }
  },

  // 2. Fetch/display user NFTs with optional caching
  async getUserNFTs(walletAddress, useCache = true) {
    try {
      const cacheKey = `nfts_${walletAddress}`;
      const cachedNFTs = sessionStorage.getItem(cacheKey);

      if (useCache && cachedNFTs) {
        return JSON.parse(cachedNFTs); // Return cached NFTs
      }

      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      const response = await axios.get(`${API_URL}/user-nfts`, {
        params: { walletAddress },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      sessionStorage.setItem(cacheKey, JSON.stringify(response.data)); // Cache the response
      return response.data; // Return the list of user-owned NFTs
    } catch (error) {
      this.handleError(error, 'Failed to fetch NFTs.');
    }
  },

  // 3. Transfer NFTs across chains using LayerZero (cross-chain support)
  async transferNFT({ nftId, fromChain, toChain, walletAddress }) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      // Use LayerZero for cross-chain NFT transfer
      const transferResponse = await LayerZeroMessaging.transferNFT({
        nftId,
        fromChain,
        toChain,
        userAddress: walletAddress,
        authToken, // Optional authentication token passed to LayerZero service if needed
      });

      return transferResponse; // Return transfer confirmation details
    } catch (error) {
      this.handleError(error, 'Failed to transfer NFT across chains.');
    }
  },

  // 4. Manage NFT Licensing using Story Protocol
  async manageNFTLicensing({ nftId, licenseTerms }) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      const response = await axios.post(
        `${API_URL}/nft-license`,
        {
          nftId,
          licenseTerms, // Example: { type: 'non-exclusive', duration: '1 year', price: '2 ETH' }
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return response.data; // Return licensing details or confirmation
    } catch (error) {
      this.handleError(error, 'Failed to manage NFT licensing.');
    }
  },

  // 5. Helper function to handle errors with logging and detailed fallback messages
  handleError(error, fallbackMessage) {
    const message = error.response?.data?.message || fallbackMessage || 'An error occurred. Please try again.';
    console.error(`Error: ${message}`, error); // Log the error to the console for debugging
    throw new Error(message);
  },
};

export default nftService;
