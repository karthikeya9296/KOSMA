import axios from 'axios';

// Base URL for AI-related API routes (adjust as per your backend)
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-api.com/ai';

// OpenAI API URLs
const OPENAI_API_URL = 'https://api.openai.com/v1/completions';
const DALL_E_API_URL = 'https://api.openai.com/v1/images/generations';

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
const authHeaders = () => {
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

const aiService = {
  // 1. Generate Creative Content using AI (text based on user prompts)
  async generateContent({ prompt, model = 'text-davinci-003', maxTokens = 100 }) {
    try {
      const headers = {
        'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`, // Use your OpenAI API key
        'Content-Type': 'application/json',
      };

      // Send the prompt to OpenAI API to generate content
      const response = await axios.post(
        OPENAI_API_URL,
        {
          model,
          prompt,
          max_tokens: maxTokens, // Set maximum tokens for the AI response
        },
        { headers }
      );

      return response.data; // Return the AI-generated content (text)
    } catch (error) {
      handleError(error, 'Failed to generate AI content.');
    }
  },

  // 2. Edit AI-generated content before posting or minting as an NFT
  async editGeneratedContent({ contentId, editedContent }) {
    try {
      const headers = authHeaders();
      // Save the edited content before posting or minting as an NFT
      const response = await axios.post(
        `${API_URL}/edit-content`,
        {
          contentId,
          editedContent,
        },
        { headers }
      );

      return response.data; // Return confirmation of the saved content
    } catch (error) {
      handleError(error, 'Failed to edit AI-generated content.');
    }
  },

  // 3. Categorize AI-generated content and suggest tags to increase engagement
  async categorizeContent({ content }) {
    try {
      const headers = authHeaders();
      // Send the AI-generated content to the backend for categorization and tag suggestions
      const response = await axios.post(
        `${API_URL}/categorize`,
        {
          content, // The generated content to be categorized and tagged
        },
        { headers }
      );

      return response.data; // Return categories and suggested tags for the content
    } catch (error) {
      handleError(error, 'Failed to categorize and suggest tags for AI-generated content.');
    }
  },

  // 4. Generate Image Content using OpenAI's DALL-E
  async generateImage({ prompt, size = '1024x1024' }) {
    try {
      const headers = {
        'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await axios.post(
        DALL_E_API_URL,
        {
          prompt,
          n: 1, // Number of images to generate
          size,
        },
        { headers }
      );

      return response.data; // Return the generated image URL
    } catch (error) {
      handleError(error, 'Failed to generate image.');
    }
  },

  // 5. Fetch AI-generated content history for user reference
  async fetchGeneratedContentHistory() {
    try {
      const headers = authHeaders();
      const response = await axios.get(`${API_URL}/history`, { headers });
      return response.data; // Return the user's AI-generated content history
    } catch (error) {
      handleError(error, 'Failed to fetch content generation history.');
    }
  },
};

export default aiService;
