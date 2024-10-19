import React, { useState } from 'react';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'; // LedgerJS for blockchain wallet login
import Ledger from '@ledgerhq/hw-app-eth'; // LedgerJS Ethereum integration
import { useLit } from './useLitProtocol'; // Custom hook for encryption with Lit Protocol
import './Login.css'; // Assuming custom CSS for login styling

const Login = ({ onLogin }) => {
  const [identifier, setIdentifier] = useState(''); // This handles both email and phone number
  const [password, setPassword] = useState('');
  const [ledgerConnected, setLedgerConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState({ email: false, ledger: false });
  const [errorMessage, setErrorMessage] = useState('');

  const { encryptData } = useLit(); // Custom hook for encryption with Lit Protocol

  // Helper function for setting loading states
  const setLoadingState = (type, state) => {
    setLoading((prev) => ({ ...prev, [type]: state }));
  };

  // Function to validate if the identifier is an email or phone number
  const isEmail = (input) => /\S+@\S+\.\S+/.test(input);
  const isPhoneNumber = (input) => /^\+?[1-9]\d{1,14}$/.test(input); // E.164 phone number format validation

  // Handle email/phone number and password login
  const handleLogin = async () => {
    setLoadingState('email', true);
    try {
      if (!identifier || !password) {
        throw new Error('Email/Phone number and password cannot be empty.');
      }

      if (!isEmail(identifier) && !isPhoneNumber(identifier)) {
        throw new Error('Please enter a valid email or phone number.');
      }

      // Encrypt password before sending it to the server
      const encryptedPassword = await encryptData(password);

      // Simulated API request to login with email/phone number and encrypted password
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier, // Can be email or phone number
          password: encryptedPassword,
        }),
      });

      if (!response.ok) {
        throw new Error('Invalid login credentials');
      }

      const userData = await response.json();
      onLogin(userData); // Handle successful login

    } catch (error) {
      setErrorMessage(error.message || 'Login failed. Please check your email/phone number or password.');
    } finally {
      setLoadingState('email', false);
    }
  };

  // Handle Ledger wallet login
  const handleLedgerLogin = async () => {
    setLoadingState('ledger', true);
    try {
      // Connect to Ledger using WebUSB
      const transport = await TransportWebUSB.create();
      const ledger = new Ledger(transport);
      const result = await ledger.getAddress("44'/60'/0'/0/0"); // Ethereum address derivation path

      setWalletAddress(result.address);
      setLedgerConnected(true);

      // Simulate API request for Ledger-based login with wallet address
      const response = await fetch('/api/login-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: result.address }),
      });

      if (!response.ok) {
        throw new Error('Ledger login failed.');
      }

      const userData = await response.json();
      onLogin(userData); // Handle successful login

    } catch (error) {
      setErrorMessage(error.message || 'Failed to connect Ledger. Please try again.');
    } finally {
      setLoadingState('ledger', false);
    }
  };

  return (
    <div className="login-page">
      <h2>Login to Kosma</h2>
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {/* Email/Phone Number and Password Login */}
      <div className="login-section">
        <h3>Login with Email or Phone</h3>
        <div className="form-group">
          <label htmlFor="identifier">Email or Phone:</label>
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading.email}
            placeholder="Enter your email or phone number"
            aria-label="Email or Phone"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading.email}
            placeholder="Enter your password"
            aria-label="Password"
            required
          />
        </div>
        <button
          onClick={handleLogin}
          disabled={loading.email || !identifier || !password}
          className="btn-primary"
          aria-busy={loading.email}
        >
          {loading.email ? 'Logging in...' : 'Login'}
        </button>
        <p>
          <a href="/forgot-password" className="forgot-password-link">Forgot Password?</a>
        </p>
      </div>

      {/* Blockchain Wallet Login */}
      <div className="login-section">
        <h3>Login with Ledger</h3>
        <button
          onClick={handleLedgerLogin}
          disabled={loading.ledger || ledgerConnected}
          className="btn-primary"
          aria-busy={loading.ledger}
        >
          {loading.ledger ? 'Connecting Ledger...' : ledgerConnected ? 'Ledger Connected' : 'Connect Wallet'}
        </button>
        {ledgerConnected && <p>Wallet Address: {walletAddress}</p>}
      </div>

      {/* Visual security indicators */}
      <div className="security-info">
        <p>Your login details are encrypted and secure using Lit Protocol.</p>
        <p>Blockchain transactions are protected by Ledger for enhanced security.</p>
      </div>
    </div>
  );
};

export default Login;
