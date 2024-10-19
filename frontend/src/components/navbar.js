import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom'; // React Router for navigation
import { ethers } from 'ethers';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'; // Ledger connection
import Ledger from '@ledgerhq/hw-app-eth'; // Ethereum app on Ledger
import Web3Modal from 'web3modal'; // Web3Modal for non-Ledger wallets

const Navbar = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [ledgerConnected, setLedgerConnected] = useState(false);
  const [loading, setLoading] = useState(false); // Loading state during wallet connection
  const [errorMessage, setErrorMessage] = useState(''); // Error message for UI feedback

  // Initialize Web3Modal for non-Ledger wallets, using useMemo to optimize performance
  const web3Modal = useMemo(() => new Web3Modal({
    cacheProvider: true, // Remember wallet connections across sessions
    providerOptions: {}, // Add additional wallet providers here if needed
  }), []);

  // Check if wallet is connected when the component mounts, and restore session
  useEffect(() => {
    const connected = localStorage.getItem('walletConnected');
    if (connected) {
      setWalletConnected(true);
      setUserAddress(localStorage.getItem('userAddress'));
    }
  }, []);

  // Function to connect Ledger wallet, using useCallback to prevent unnecessary re-renders
  const connectLedgerWallet = useCallback(async () => {
    try {
      setLoading(true); // Display loading spinner during connection
      setErrorMessage(''); // Clear previous error messages

      const transport = await TransportWebUSB.create();
      const ledger = new Ledger(transport);
      const result = await ledger.getAddress("44'/60'/0'/0/0"); // Ethereum Ledger address derivation path
      const userAddress = result.address;

      // Update the state with the connected address
      setLedgerConnected(true);
      setUserAddress(userAddress);
      setWalletConnected(true);

      // Persist the wallet connection in localStorage
      localStorage.setItem('walletConnected', true);
      localStorage.setItem('userAddress', userAddress);
    } catch (error) {
      setErrorMessage('Failed to connect Ledger wallet. Please ensure your device is connected and unlocked.');
      console.error('Error connecting Ledger wallet:', error);
    } finally {
      setLoading(false); // Stop the loading spinner
    }
  }, []);

  // Function to connect non-Ledger wallets using Web3Modal
  const connectWeb3Wallet = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const instance = await web3Modal.connect();
      const web3Provider = new ethers.providers.Web3Provider(instance);
      const signer = web3Provider.getSigner();
      const userAddress = await signer.getAddress();

      // Update the state with the connected address
      setUserAddress(userAddress);
      setWalletConnected(true);

      // Persist the wallet connection in localStorage
      localStorage.setItem('walletConnected', true);
      localStorage.setItem('userAddress', userAddress);
    } catch (error) {
      setErrorMessage('Failed to connect wallet. Please try again.');
      console.error('Error connecting Web3 wallet:', error);
    } finally {
      setLoading(false); // Stop the loading spinner
    }
  }, [web3Modal]);

  // Function to disconnect wallet and clear session
  const disconnectWallet = () => {
    setWalletConnected(false);
    setLedgerConnected(false);
    setUserAddress('');
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('userAddress');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">
          Kosma
        </Link>

        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <Link className="nav-link" to="/">Home</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/profile">Profile</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/membership">Membership</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/royalties">Royalties</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/notifications">Notifications</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/settings">Settings</Link>
            </li>
          </ul>

          <div className="d-flex align-items-center">
            {loading && <span className="spinner-border" role="status" aria-hidden="true"></span>}
            {errorMessage && <p className="text-danger ms-2">{errorMessage}</p>}

            {walletConnected ? (
              <div className="connected-info">
                <span className="user-name">{userAddress}</span>
                <button className="btn btn-danger ms-3" onClick={disconnectWallet}>Disconnect</button>
              </div>
            ) : (
              <div className="wallet-connect-buttons">
                <button className="btn btn-primary" onClick={connectLedgerWallet} disabled={loading}>
                  {loading ? 'Connecting Ledger...' : 'Connect Ledger Wallet'}
                </button>
                <button className="btn btn-secondary ms-2" onClick={connectWeb3Wallet} disabled={loading}>
                  {loading ? 'Connecting Wallet...' : 'Connect Other Wallets'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
