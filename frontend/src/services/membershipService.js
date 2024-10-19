import axios from 'axios';
import UnlockProtocol from '@unlock-protocol/unlock-js'; // Unlock Protocol for managing memberships

// Base URL for membership-related API routes (adjust as per your backend)
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-api.com/membership';

// Helper function to securely get the authentication token from localStorage
const getAuthToken = () => localStorage.getItem('authToken');

// Helper function to check if JWT token is expired
const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const decoded = JSON.parse(atob(token.split('.')[1])); // Decode the token
    return decoded.exp * 1000 < Date.now(); // Return true if token is expired
  } catch (error) {
    return true; // Return true if decoding fails (indicating an invalid token)
  }
};

// Centralized error handling to provide better user feedback
const handleError = (error, fallbackMessage) => {
  const message = error.response?.data?.message || fallbackMessage || 'An unexpected error occurred. Please try again.';
  console.error(`Error: ${message}`, error); // Log the error for debugging purposes
  throw new Error(message); // Throw the error to propagate it further
};

const membershipService = {
  // 1. Purchase Membership securely using Unlock Protocol and manage the blockchain transaction
  async purchaseMembership({ lockAddress, userAddress }) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      // Ensure the user is connected to the blockchain and use Unlock Protocol
      const unlock = new UnlockProtocol();
      const lock = await unlock.getLock(lockAddress); // Fetch the lock (membership) details for the specified tier

      // Execute the purchase of the membership via blockchain transaction
      const transaction = await lock.purchaseMembership({
        userAddress, // Ethereum or blockchain address of the user
        referrer: '', // Optional referrer address for rewards (if available)
      });

      // Send transaction details to the backend for further tracking and confirmation
      const response = await axios.post(`${API_URL}/purchase`, {
        transaction,
        userAddress,
        lockAddress,
      }, {
        headers: {
          Authorization: `Bearer ${authToken}`, // Attach the authentication token
        },
      });

      return response.data; // Return the confirmation from the backend
    } catch (error) {
      handleError(error, 'Failed to purchase membership.'); // Handle errors during the purchase
    }
  },

  // 2. Manage Membership (Renew, Upgrade, Cancel)
  async manageMembership({ action, lockAddress, userAddress }) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      // Perform the membership action, such as 'renew', 'upgrade', or 'cancel'
      const response = await axios.post(`${API_URL}/manage`, {
        action, // Action type, e.g., 'renew', 'upgrade', 'cancel'
        lockAddress,
        userAddress,
      }, {
        headers: {
          Authorization: `Bearer ${authToken}`, // Ensure the request is authenticated
        },
      });

      return response.data; // Return the result of the membership management action
    } catch (error) {
      handleError(error, `Failed to ${action} membership.`); // Handle errors for the specific action
    }
  },

  // 3. Fetch available membership tiers and benefits
  async getMembershipTiers() {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      // Fetch available membership tiers (e.g., Silver, Gold, Platinum) and their respective benefits
      const response = await axios.get(`${API_URL}/tiers`, {
        headers: {
          Authorization: `Bearer ${authToken}`, // Secure the request with the authentication token
        },
      });

      return response.data; // Return the list of membership tiers and their benefits
    } catch (error) {
      handleError(error, 'Failed to fetch membership tiers.'); // Handle errors while fetching the tiers
    }
  },

  // 4. Verify the user's membership status (active or inactive)
  async verifyMembershipStatus(userAddress) {
    try {
      const authToken = getAuthToken();
      if (isTokenExpired(authToken)) throw new Error('Session expired. Please log in again.');

      // Verify the user's membership status (active/inactive) by querying the backend
      const response = await axios.get(`${API_URL}/status`, {
        params: { userAddress }, // Pass the user's blockchain address
        headers: {
          Authorization: `Bearer ${authToken}`, // Attach the authentication token
        },
      });

      return response.data; // Return the membership status of the user (active/inactive)
    } catch (error) {
      handleError(error, 'Failed to verify membership status.'); // Handle errors during membership verification
    }
  },
};

export default membershipService;
