import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Ledger from '@ledgerhq/hw-app-eth';
import { setWalletConnected, setWalletDisconnected } from '../redux/actions/walletActions'; 
import { useNotifications } from '../hooks/useNotifications'; // Custom hook for notifications

const LedgerConnect = () => {
  const [ledgerConnected, setLedgerConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const dispatch = useDispatch();
  const { notifySuccess, notifyError, notifyInfo } = useNotifications(); 
  const walletState = useSelector((state) => state.wallet);

  // Reconnect ledger wallet on reload
  const reconnectLedgerWallet = useCallback(async () => {
    const isConnected = sessionStorage.getItem('ledgerConnected');
    const savedAddress = sessionStorage.getItem('ledgerWalletAddress');
    if (isConnected && savedAddress) {
      try {
        setWalletAddress(savedAddress);
        setLedgerConnected(true);
        dispatch(setWalletConnected(savedAddress));
      } catch (error) {
        console.error('Error reconnecting Ledger wallet:', error);
      }
    }
  }, [dispatch]);

  // Handle Ledger wallet connection
  const connectLedgerWallet = async () => {
    try {
      // Check for WebUSB support
      if (!window.navigator.usb) {
        setErrorMessage('WebUSB is not supported by your browser. Please use Chrome or Edge.');
        return;
      }

      setLoading(true);
      setErrorMessage('');
      notifyInfo('Connecting to Ledger...');

      const transport = await TransportWebUSB.create();
      notifyInfo('Awaiting approval on your Ledger device...');

      const ledger = new Ledger(transport);
      const result = await ledger.getAddress("44'/60'/0'/0/0");

      setWalletAddress(result.address);
      setLedgerConnected(true);
      dispatch(setWalletConnected(result.address));
      notifySuccess('Ledger wallet connected!');

      // Save the session state
      sessionStorage.setItem('ledgerConnected', true);
      sessionStorage.setItem('ledgerWalletAddress', result.address);
    } catch (error) {
      setErrorMessage('Failed to connect Ledger wallet. Please try again.');
      notifyError('Error connecting Ledger wallet.');
      console.error('Error connecting Ledger wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Ledger wallet disconnection
  const disconnectLedgerWallet = () => {
    setLedgerConnected(false);
    setWalletAddress('');
    dispatch(setWalletDisconnected());
    sessionStorage.removeItem('ledgerConnected');
    sessionStorage.removeItem('ledgerWalletAddress');
    notifySuccess('Ledger wallet disconnected.');
  };

  // Reconnect the Ledger wallet automatically if previously connected
  useEffect(() => {
    reconnectLedgerWallet();
  }, [reconnectLedgerWallet]);

  return (
    <div className="ledger-connect">
      <h2>Ledger Wallet Connection</h2>

      {/* Info section for first-time users */}
      <div className="info-section">
        <h4>How to Set Up Ledger Wallet</h4>
        <ol>
          <li>Ensure your Ledger device is connected to your computer.</li>
          <li>Open the Ethereum app on your Ledger device.</li>
          <li>Click the "Connect Ledger Wallet" button below to initiate the connection.</li>
          <li>Approve the connection request on your Ledger device.</li>
        </ol>
      </div>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <div className="wallet-status">
        {ledgerConnected ? (
          <div>
            <p>Status: <strong>Connected</strong> ✅</p>
            <p>Wallet Address: {walletAddress} (Ledger)</p>
            <button
              className="btn btn-danger"
              onClick={disconnectLedgerWallet}
              disabled={loading}
            >
              {loading ? 'Disconnecting...' : 'Disconnect Wallet'}
            </button>
          </div>
        ) : (
          <div>
            <p>Status: <strong>Disconnected</strong> ❌</p>
            <button
              className="btn btn-primary"
              onClick={connectLedgerWallet}
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect Ledger Wallet'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LedgerConnect;
