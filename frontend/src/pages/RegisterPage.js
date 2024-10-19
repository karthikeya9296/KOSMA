import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import zxcvbn from 'zxcvbn'; // For password strength meter
import ReCAPTCHA from 'react-google-recaptcha'; // For CAPTCHA

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    securityQuestion: '',
    securityAnswer: '',
    agreeTerms: false,
  });
  const [blockchainAddress, setBlockchainAddress] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0); // For rate limiting
  const [enable2FA, setEnable2FA] = useState(false); // For optional 2FA

  // CSRF Token handling using Axios Interceptor
  useEffect(() => {
    axios.interceptors.request.use((config) => {
      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      config.headers['X-CSRF-Token'] = csrfToken;
      return config;
    }, (error) => {
      return Promise.reject(error);
    });
  }, []);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });

    if (name === 'password') {
      const strength = zxcvbn(value);
      setPasswordStrength(strength.score);
    }
  };

  // Validate password strength
  const suggestStrongPassword = (score) => {
    if (score < 3) {
      return 'Your password is too weak. Try including more characters, symbols, and numbers.';
    }
    return '';
  };

  // Validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle CAPTCHA verification
  const onCaptchaVerify = (value) => {
    setCaptchaVerified(true); // In a real app, send the value to backend for verification
  };

  // Check username availability
  const checkUsernameAvailability = async (username) => {
    try {
      const response = await axios.get(`/auth/check-username?username=${username}`);
      if (!response.data.available) {
        setErrors((prevErrors) => ({ ...prevErrors, username: 'Username is already taken' }));
      } else {
        setErrors((prevErrors) => ({ ...prevErrors, username: '' }));
      }
    } catch (error) {
      setErrors((prevErrors) => ({ ...prevErrors, username: 'Error checking username availability' }));
    }
  };

  // Check email availability
  const checkEmailAvailability = async (email) => {
    try {
      const response = await axios.get(`/auth/check-email?email=${email}`);
      if (!response.data.available) {
        setErrors((prevErrors) => ({ ...prevErrors, email: 'Email is already in use' }));
      } else {
        setErrors((prevErrors) => ({ ...prevErrors, email: '' }));
      }
    } catch (error) {
      setErrors((prevErrors) => ({ ...prevErrors, email: 'Error checking email availability' }));
    }
  };

  // Validate form inputs
  const validateForm = () => {
    let newErrors = {};

    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (!/^[a-zA-Z0-9]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters and numbers';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (passwordStrength < 3) {
      newErrors.password = suggestStrongPassword(passwordStrength);
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.securityQuestion || !formData.securityAnswer) {
      newErrors.securityQuestion = 'Security question and answer are required';
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the Terms of Service and Privacy Policy';
    }

    if (!captchaVerified) {
      newErrors.captcha = 'Please verify that you are not a robot';
    }

    return newErrors;
  };

  // Generate unique blockchain address using Ethers.js
  const generateBlockchainAddress = () => {
    const wallet = ethers.Wallet.createRandom();
    setBlockchainAddress(wallet.address); // Store the generated address
    return wallet.address;
  };

  // Handle form submission with Rate Limiting
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (attemptCount >= 5) {
      setErrors({ submit: 'Too many attempts, please try again later.' });
      return;
    }

    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setAttemptCount((prev) => prev + 1); // Increment attempt count
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccessMessage('');
    setAttemptCount(0); // Reset attempt count on success

    try {
      // Generate blockchain address for the user
      const userBlockchainAddress = generateBlockchainAddress();

      // Prepare data for API request
      const registerData = {
        ...formData,
        blockchainAddress: userBlockchainAddress,
      };

      // Make the API call to the backend /auth/register endpoint
      const response = await axios.post('/auth/register', registerData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        setSuccessMessage('Registration successful! Please verify your email.');
      }
    } catch (error) {
      setErrors({ submit: 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Toggle 2FA setup (optional after registration)
  const handle2FASetup = () => {
    setEnable2FA(!enable2FA);
  };

  return (
    <div className="register-page">
      <h2>Register for Kosma</h2>
      <form onSubmit={handleSubmit}>

        {/* Username Field */}
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            onBlur={() => checkUsernameAvailability(formData.username)}
            required
          />
          {errors.username && <p className="error">{errors.username}</p>}
        </div>

        {/* Email Field */}
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            onBlur={() => checkEmailAvailability(formData.email)}
            required
          />
          {errors.email && <p className="error">{errors.email}</p>}
        </div>

        {/* Password Field */}
        <div className="form-group">
          <label>Password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete={navigator.userAgent.includes('Android') || navigator.userAgent.includes('iPhone') ? 'off' : 'new-password'} // Password autofill for Android/iOS
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
          <p>Password Strength: {passwordStrength >= 3 ? 'Strong' : 'Weak'}</p>
          {errors.password && <p className="error">{errors.password}</p>}
        </div>

        {/* Confirm Password Field */}
        <div className="form-group">
          <label>Confirm Password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
          {errors.confirmPassword && <p className="error">{errors.confirmPassword}</p>}
        </div>

        {/* Security Question Field */}
        <div className="form-group">
          <label>Security Question</label>
          <select
            name="securityQuestion"
            value={formData.securityQuestion}
            onChange={handleChange}
            required
          >
            <option value="">Select a question</option>
            <option value="nickname">What was your childhood nickname?</option>
            <option value="pet">What is the name of your first pet?</option>
            <option value="mother">What is your mother’s maiden name?</option>
          </select>
          <input
            type="text"
            name="securityAnswer"
            placeholder="Your answer"
            value={formData.securityAnswer}
            onChange={handleChange}
            required
          />
          {errors.securityQuestion && <p className="error">{errors.securityQuestion}</p>}
        </div>

        {/* CAPTCHA */}
        <div className="form-group">
          <ReCAPTCHA sitekey="your-site-key" onChange={onCaptchaVerify} />
          {errors.captcha && <p className="error">{errors.captcha}</p>}
        </div>

        {/* Terms of Service */}
        <div className="form-group">
          <input
            type="checkbox"
            name="agreeTerms"
            checked={formData.agreeTerms}
            onChange={handleChange}
            required
          />
          <label>
            I agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>
          </label>
          {errors.agreeTerms && <p className="error">{errors.agreeTerms}</p>}
        </div>

        {/* Submit Button */}
        <div className="form-group">
          <button type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Register'}
          </button>
        </div>

        {errors.submit && <p className="error">{errors.submit}</p>}
        {successMessage && <p className="success">{successMessage}</p>}
      </form>

      {/* Blockchain Address Explanation */}
      {blockchainAddress && (
        <div className="blockchain-address">
          <p>Your unique blockchain address:</p>
          <strong>{blockchainAddress}</strong>
          <small>
            This address uniquely identifies you on the Kosma platform, ensuring security and privacy.
          </small>
        </div>
      )}

      {/* Optional 2FA Setup */}
      <div className="form-group">
        <button onClick={handle2FASetup}>
          {enable2FA ? 'Disable Two-Factor Authentication (2FA)' : 'Enable Two-Factor Authentication (2FA)'}
        </button>
        {enable2FA && <p>2FA enabled. Follow the setup instructions sent to your email.</p>}
      </div>
    </div>
  );
};

export default RegisterPage;
