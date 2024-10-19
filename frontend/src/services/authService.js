import axios from 'axios';

// Base URL for authentication-related API routes (adjust as per your backend)
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-api.com/auth';

const authService = {
  // 1. User Registration
  async register({ username, email, password, walletAddress }) {
    try {
      const response = await axios.post(`${API_URL}/register`, {
        username,
        email,
        password,
        walletAddress,
      });
      return response.data; // Return user data or success message
    } catch (error) {
      this.handleError(error, 'Registration failed.');
    }
  },

  // 2. Login Method
  async login({ identifier, password }) {
    try {
      const response = await axios.post(`${API_URL}/login`, {
        identifier, // Can be email or phone number
        password,
      });

      if (response.data.token) {
        this.storeToken(response.data.token);
      }
      return response.data; // Return user data or success message
    } catch (error) {
      this.handleError(error, 'Login failed.');
    }
  },

  // 3. Logout Method
  logout() {
    // Remove token from localStorage
    localStorage.removeItem('authToken');
  },

  // 4. Password Reset Method
  async resetPassword({ email }) {
    try {
      const response = await axios.post(`${API_URL}/reset-password`, { email });
      return response.data; // Return success message or reset link
    } catch (error) {
      this.handleError(error, 'Password reset failed.');
    }
  },

  // 5. Store JWT token securely in HttpOnly cookie or local storage
  storeToken(token) {
    try {
      localStorage.setItem('authToken', token);
      // Optionally send token to a secure cookie for HttpOnly storage on the backend
    } catch (error) {
      console.error('Failed to store token', error);
      throw new Error('Failed to store token. Please try again.');
    }
  },

  // 6. Get the currently stored authentication token (if available)
  getAuthToken() {
    return localStorage.getItem('authToken');
  },

  // 7. Check if the user is authenticated
  isAuthenticated() {
    const token = this.getAuthToken();
    if (!token) return false;

    // Optionally, check if the token is expired
    const decodedToken = this.decodeToken(token);
    if (decodedToken?.exp && decodedToken.exp * 1000 < Date.now()) {
      this.logout(); // Automatically log out if token has expired
      return false;
    }
    return true; // Return true if token exists and is valid
  },

  // 8. Decode JWT token (for checking expiration or user data)
  decodeToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode token', error);
      return null;
    }
  },

  // 9. Refresh Token Mechanism (Optional)
  async refreshToken() {
    try {
      const response = await axios.post(`${API_URL}/refresh-token`, {
        token: this.getAuthToken(),
      });

      if (response.data.token) {
        this.storeToken(response.data.token);
      }
      return response.data.token;
    } catch (error) {
      this.handleError(error, 'Token refresh failed.');
    }
  },

  // 10. Handle errors and show user-friendly messages
  handleError(error, fallbackMessage) {
    const message =
      error.response?.data?.message || fallbackMessage || 'An error occurred. Please try again.';
    throw new Error(message);
  },
};

export default authService;
