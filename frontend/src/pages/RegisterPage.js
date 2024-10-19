import React, { useState } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';

const RegisterPage = () => {
  // State to manage form inputs and blockchain address
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [blockchainAddress, setBlockchainAddress] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Handle form field changes
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Function to validate the password based on the given requirements
  const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return passwordRegex.test(password);
  };

  // Function to validate the username: case-sensitive, only letters and numbers
  const validateUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    return usernameRegex.test(username);
  };

  // Form validation
  const validateForm = () => {
    let newErrors = {};
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (!validateUsername(formData.username)) {
      newErrors.username = 'Username can only contain letters and numbers';
    }

    if (!formData.email) newErrors.email = 'Email is required';
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters long, contain one uppercase letter, one lowercase letter, one number, and one special character.';
    }
    
    return newErrors;
  };

  // Function to generate a unique blockchain address using Ethers.js
  const generateBlockchainAddress = () => {
    const wallet = ethers.Wallet.createRandom();
    setBlockchainAddress(wallet.address); // Store the generated address
    return wallet.address;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      // Generate blockchain address for the user
      const userBlockchainAddress = generateBlockchainAddress();

      // Prepare data for API request
      const registerData = {
        ...formData,
        blockchainAddress: userBlockchainAddress,
      };

      // Make the API call to the backend /auth/register endpoint
      const response = await axios.post('/auth/register', registerData);

      // Store the blockchain address in the frontend state and show success message
      if (response.status === 200) {
        setSuccessMessage('Registration successful!');
        // Optionally, you could store the blockchain address in localStorage or other storage
      }
    } catch (error) {
      setErrors({ submit: 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <h2>Register for Kosma</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
          {errors.username && <p className="error">{errors.username}</p>}
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          {errors.email && <p className="error">{errors.email}</p>}
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          {errors.password && <p className="error">{errors.password}</p>}
        </div>

        <div className="form-group">
          <button type="submit" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </div>

        {errors.submit && <p className="error">{errors.submit}</p>}
        {successMessage && <p className="success">{successMessage}</p>}
      </form>

      {blockchainAddress && (
        <div className="blockchain-address">
          <p>Your unique blockchain address:</p>
          <strong>{blockchainAddress}</strong>
        </div>
      )}
    </div>
  );
};

export default RegisterPage;
