import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import UnlockProtocol from '@unlock-protocol/unlock-js'; // Unlock Protocol for memberships
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'; // Ledger Transport for secure transactions
import Ledger from '@ledgerhq/hw-app-eth'; // LedgerJS for profile security integration
import { useNotifications } from './Notification'; // Notification component for alerts
import './MembershipPage.css'; // Custom CSS for Membership page styling

const MembershipPage = () => {
  const [memberships, setMemberships] = useState([]);
  const [activeMembership, setActiveMembership] = useState(null);
  const [exclusiveContent, setExclusiveContent] = useState([]);
  const [ledgerConnected, setLedgerConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState({ memberships: false, content: false, ledger: false });
  const [errorMessage, setErrorMessage] = useState('');

  const unlock = new UnlockProtocol();
  const { notifySuccess, notifyError, notifyInfo } = useNotifications(); // Notifications

  // Helper function to handle loading state
  const setLoadingState = (section, state) => {
    setLoading((prev) => ({ ...prev, [section]: state }));
  };

  // Fetch available membership tiers from Unlock Protocol
  const fetchMemberships = async () => {
    setLoadingState('memberships', true);
    try {
      // Replace with your Unlock lock addresses for Silver, Gold, Platinum tiers
      const lockAddresses = [
        { name: 'Silver', address: 'YOUR_SILVER_LOCK_ADDRESS' },
        { name: 'Gold', address: 'YOUR_GOLD_LOCK_ADDRESS' },
        { name: 'Platinum', address: 'YOUR_PLATINUM_LOCK_ADDRESS' },
      ];

      const membershipDetails = await Promise.all(
        lockAddresses.map(async (tier) => {
          const lock = await unlock.getLock(tier.address);
          return { ...tier, price: ethers.utils.formatEther(lock.keyPrice), duration: lock.expirationDuration };
        })
      );

      setMemberships(membershipDetails);
    } catch (error) {
      setErrorMessage('Failed to load membership tiers.');
    } finally {
      setLoadingState('memberships', false);
    }
  };

  // Fetch user's active membership from Unlock Protocol
  const fetchActiveMembership = async () => {
    if (!walletAddress) return;
    setLoadingState('memberships', true);
    try {
      const activeMembership = await unlock.getKeyByAddress(walletAddress);
      setActiveMembership(activeMembership);
    } catch (error) {
      setErrorMessage('Failed to load active membership.');
    } finally {
      setLoadingState('memberships', false);
    }
  };

  // Fetch exclusive content available to members
  const fetchExclusiveContent = async () => {
    if (!activeMembership) return;
    setLoadingState('content', true);
    try {
      const exclusiveResponse = await fetch('/api/exclusive-content', {
        headers: { Authorization: `Bearer ${activeMembership.token}` },
      });
      const content = await exclusiveResponse.json();
      setExclusiveContent(content);
    } catch (error) {
      setErrorMessage('Failed to load exclusive content.');
    } finally {
      setLoadingState('content', false);
    }
  };

  // Connect Ledger Wallet
  const connectLedgerWallet = async () => {
    setLoadingState('ledger', true);
    try {
      const transport = await TransportWebUSB.create();
      const ledger = new Ledger(transport);
      const result = await ledger.getAddress("44'/60'/0'/0/0");

      setWalletAddress(result.address);
      setLedgerConnected(true);
      notifySuccess('Ledger wallet connected.');
    } catch (error) {
      setErrorMessage('Failed to connect Ledger wallet.');
    } finally {
      setLoadingState('ledger', false);
    }
  };

  // Purchase or renew a membership
  const handleMembershipPurchase = async (lockAddress) => {
    setLoadingState('memberships', true);
    try {
      const lock = await unlock.getLock(lockAddress);
      await lock.purchaseMembership({ from: walletAddress });
      notifySuccess('Membership purchased successfully.');
      fetchActiveMembership();
    } catch (error) {
      setErrorMessage('Failed to purchase or renew membership.');
    } finally {
      setLoadingState('memberships', false);
    }
  };

  // Check for membership expiration and send alert
  useEffect(() => {
    if (activeMembership && new Date(activeMembership.expiration * 1000) - new Date() < 7 * 24 * 60 * 60 * 1000) {
      notifyInfo('Your membership is expiring soon. Consider renewing.');
    }
  }, [activeMembership]);

  // Fetch membership details and content on component mount
  useEffect(() => {
    fetchMemberships();
    fetchActiveMembership();
  }, [walletAddress]);

  useEffect(() => {
    fetchExclusiveContent();
  }, [activeMembership]);

  return (
    <div className="membership-page">
      <header className="membership-header">
        <h2>Manage Your Membership</h2>
        <button className="btn btn-primary" onClick={connectLedgerWallet} disabled={ledgerConnected || loading.ledger}>
          {ledgerConnected ? 'Ledger Connected' : 'Connect to Ledger'}
        </button>
      </header>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <section className="membership-tiers">
        <h3>Available Membership Tiers</h3>
        <div className="tier-cards">
          {loading.memberships ? (
            <p>Loading membership tiers...</p>
          ) : (
            memberships.map((tier) => (
              <div key={tier.name} className="tier-card">
                <h4>{tier.name} Membership</h4>
                <p>Price: {tier.price} ETH</p>
                <p>Duration: {tier.duration / (60 * 60 * 24)} days</p>
                <button className="btn btn-light" onClick={() => handleMembershipPurchase(tier.address)}>
                  {activeMembership?.lock === tier.address ? 'Renew' : 'Purchase'}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="exclusive-content-section">
        <h3>Exclusive Content for Members</h3>
        {loading.content ? (
          <p>Loading exclusive content...</p>
        ) : exclusiveContent.length > 0 ? (
          <div className="exclusive-content">
            {exclusiveContent.map((content, index) => (
              <div key={index} className="exclusive-item">
                <h4>{content.title}</h4>
                <p>{content.description}</p>
                {content.type === 'image' && <img src={content.mediaUrl} alt={content.title} />}
                {content.type === 'video' && <video controls src={content.mediaUrl}></video>}
              </div>
            ))}
          </div>
        ) : (
          <p>No exclusive content available.</p>
        )}
      </section>

      <footer className="membership-footer">
        <p>Your current membership: {activeMembership ? `${activeMembership.lock} (Expires: ${new Date(activeMembership.expiration * 1000).toLocaleDateString()})` : 'None'}</p>
      </footer>
    </div>
  );
};

export default MembershipPage;
