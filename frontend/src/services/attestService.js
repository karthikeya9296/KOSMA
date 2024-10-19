import axios from 'axios';
import SignProtocol from '@sign-protocol/sign'; // Sign Protocol for managing attestations
import { useLit } from './useLitProtocol'; // Custom hook for encryption using Lit Protocol

// Base URL for attestation-related API routes (adjust as per your backend)
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-api.com/attest';

// Helper function to securely get the authentication token
const getAuthToken = () => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found. Please log in.');
  }
  return token;
};

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
const getAuthHeaders = () => {
  const authToken = getAuthToken();
  if (isTokenExpired(authToken)) {
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

const attestService = {
  // 1. Create an attestation for a user action (e.g., liking content, licensing content)
  async createAttestation({ action, contentId, userAddress }) {
    try {
      const headers = getAuthHeaders();
      // Use Sign Protocol to create the attestation
      const attestation = await SignProtocol.createAttestation({
        action, // Example: 'like', 'license'
        contentId,
        userAddress, // The address of the user performing the action
      });

      // Store the attestation in the backend (optional)
      const response = await axios.post(
        `${API_URL}/create-attestation`,
        {
          attestation,
          contentId,
          userAddress,
        },
        { headers }
      );

      return response.data; // Return the created attestation data
    } catch (error) {
      handleError(error, 'Failed to create attestation.');
    }
  },

  // 2. Verify an attestation on-chain
  async verifyAttestation({ attestationId, contentId, userAddress }) {
    try {
      const headers = getAuthHeaders();
      // Use Sign Protocol to verify the attestation on-chain
      const isValid = await SignProtocol.verifyAttestation({
        attestationId,
        contentId,
        userAddress, // Address of the user who made the attestation
      });

      return isValid; // Return true if the attestation is valid
    } catch (error) {
      handleError(error, 'Failed to verify attestation.');
    }
  },

  // 3. Create encrypted attestations using Lit Protocol for sensitive actions
  async createEncryptedAttestation({ action, contentId, userAddress, sensitiveData }) {
    try {
      const headers = getAuthHeaders();
      // Use Lit Protocol to encrypt sensitive data
      const { encryptData } = useLit();
      const encryptedData = await encryptData(sensitiveData);

      // Create the attestation with encrypted sensitive data
      const attestation = await SignProtocol.createAttestation({
        action,
        contentId,
        userAddress,
        data: encryptedData, // Include encrypted sensitive data
      });

      // Optionally, store the encrypted attestation in the backend
      const response = await axios.post(
        `${API_URL}/create-attestation`,
        {
          attestation,
          contentId,
          userAddress,
        },
        { headers }
      );

      return response.data; // Return the created attestation data
    } catch (error) {
      handleError(error, 'Failed to create encrypted attestation.');
    }
  },

  // 4. Fetch Attestations for Content
  async fetchAttestations(contentId) {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API_URL}/attestations/${contentId}`, {
        headers,
      });
      return response.data; // Return the list of attestations related to the content
    } catch (error) {
      handleError(error, 'Failed to fetch attestations.');
    }
  },
};

export default attestService;
