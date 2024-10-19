import axios from 'axios';

// Base URL for Story Protocol-related API routes (adjust as per your backend)
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-api.com/story';

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

const storyService = {
  // 1. License Content as NFTs via Story Protocol
  async licenseContent({ contentId, licenseTerms, royaltyPercentage }) {
    try {
      const response = await axios.post(
        `${API_URL}/license`,
        {
          contentId,
          licenseTerms, // Example: { type: 'non-exclusive', duration: '1 year', price: '2 ETH' }
          royaltyPercentage, // Royalty percentage that the creator receives from licensing
        },
        { headers: authHeaders() }
      );

      return response.data; // Return the confirmation of the licensing process
    } catch (error) {
      handleError(error, 'Failed to license content.'); // Handle errors during content licensing
    }
  },

  // 2. Fetch Royalty Earnings for Licensed Content
  async getRoyaltyEarnings(contentId) {
    try {
      const response = await axios.get(`${API_URL}/royalties/${contentId}`, {
        headers: authHeaders(),
      });

      return response.data; // Return the royalty earnings data
    } catch (error) {
      handleError(error, 'Failed to fetch royalty earnings.'); // Handle errors in fetching royalties
    }
  },

  // 3. Handle Disputes Related to Licensing or Ownership
  async submitDispute({ contentId, disputeDetails }) {
    try {
      const response = await axios.post(
        `${API_URL}/dispute`,
        {
          contentId,
          disputeDetails, // Detailed description of the dispute, e.g., licensing, ownership, etc.
        },
        { headers: authHeaders() }
      );

      return response.data; // Return the confirmation of dispute submission
    } catch (error) {
      handleError(error, 'Failed to submit dispute.'); // Handle errors during dispute submission
    }
  },

  // 4. Fetch All Disputes Related to a Content Item
  async getDisputes(contentId) {
    try {
      const response = await axios.get(`${API_URL}/disputes/${contentId}`, {
        headers: authHeaders(),
      });

      return response.data; // Return the list of disputes
    } catch (error) {
      handleError(error, 'Failed to fetch disputes.'); // Handle errors during dispute fetching
    }
  },
};

export default storyService;
