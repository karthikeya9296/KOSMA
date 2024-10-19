import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useNotifications } from './Notification'; // Notification component for managing preferences
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'; // Ledger Transport for securing privacy controls
import Ledger from '@ledgerhq/hw-app-eth'; // LedgerJS for privacy settings
import { useLit } from './useLitProtocol'; // Custom Lit Protocol hook for encryption
import './SettingsPage.css'; // Custom CSS for styling

const SettingsPage = () => {
  const [profile, setProfile] = useState({ name: '', email: '', bio: '' });
  const [privacySettings, setPrivacySettings] = useState({ showEmail: false, showBio: true });
  const [notificationPrefs, setNotificationPrefs] = useState({ newsletter: true, productUpdates: false });
  const [ledgerConnected, setLedgerConnected] = useState(false);
  const [loading, setLoading] = useState({ profile: false, privacy: false, notifications: false, ledger: false });
  const [errorMessage, setErrorMessage] = useState('');

  const { notifySuccess, notifyError } = useNotifications(); // Notifications for managing preferences
  const { encryptData } = useLit(); // Custom Lit Protocol hook for encryption

  // Helper function to handle loading state
  const setLoadingState = (section, state) => setLoading((prev) => ({ ...prev, [section]: state }));

  // Handle profile updates with encryption using Lit Protocol
  const handleProfileUpdate = async () => {
    setLoadingState('profile', true);
    try {
      // Encrypt sensitive data before sending it to the server
      const encryptedEmail = await encryptData(profile.email);

      // Mocked server request
      await fetch('/api/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, email: encryptedEmail }),
      });

      notifySuccess('Profile updated successfully.');
    } catch (error) {
      setErrorMessage('Failed to update profile.');
      notifyError('Profile update failed.');
    } finally {
      setLoadingState('profile', false);
    }
  };

  // Handle privacy settings with Ledger integration for secure control
  const connectLedgerForPrivacy = async () => {
    setLoadingState('ledger', true);
    try {
      const transport = await TransportWebUSB.create();
      const ledger = new Ledger(transport);
      const result = await ledger.getAddress("44'/60'/0'/0/0"); // Ethereum Ledger address derivation path

      setLedgerConnected(true);
      notifySuccess('Ledger connected for privacy settings.');
    } catch (error) {
      setErrorMessage('Failed to connect Ledger for privacy settings.');
      notifyError('Ledger connection failed.');
    } finally {
      setLoadingState('ledger', false);
    }
  };

  const handlePrivacySettingsUpdate = async () => {
    if (!ledgerConnected) {
      setErrorMessage('Ledger is required to secure privacy settings.');
      notifyError('Ledger connection required.');
      return;
    }

    setLoadingState('privacy', true);
    try {
      // Mocked server request for updating privacy settings
      await fetch('/api/update-privacy-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(privacySettings),
      });

      notifySuccess('Privacy settings updated successfully.');
    } catch (error) {
      setErrorMessage('Failed to update privacy settings.');
      notifyError('Privacy settings update failed.');
    } finally {
      setLoadingState('privacy', false);
    }
  };

  // Handle notification preferences update
  const handleNotificationUpdate = async () => {
    setLoadingState('notifications', true);
    try {
      // Mocked server request for updating notification preferences
      await fetch('/api/update-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationPrefs),
      });

      notifySuccess('Notification preferences updated successfully.');
    } catch (error) {
      setErrorMessage('Failed to update notification preferences.');
      notifyError('Notification update failed.');
    } finally {
      setLoadingState('notifications', false);
    }
  };

  return (
    <div className="settings-page">
      <h2>Settings</h2>
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {/* Profile Settings */}
      <section className="profile-settings">
        <h3>Profile Settings</h3>
        <div className="form-group">
          <label>Name:</label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            disabled={loading.profile}
          />
        </div>
        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            disabled={loading.profile}
          />
        </div>
        <div className="form-group">
          <label>Bio:</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            disabled={loading.profile}
          />
        </div>
        <button onClick={handleProfileUpdate} disabled={loading.profile}>
          {loading.profile ? 'Updating...' : 'Update Profile'}
        </button>
      </section>

      {/* Privacy Settings */}
      <section className="privacy-settings">
        <h3>Privacy Settings</h3>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={privacySettings.showEmail}
              onChange={(e) => setPrivacySettings({ ...privacySettings, showEmail: e.target.checked })}
              disabled={loading.privacy}
            />
            Show Email
          </label>
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={privacySettings.showBio}
              onChange={(e) => setPrivacySettings({ ...privacySettings, showBio: e.target.checked })}
              disabled={loading.privacy}
            />
            Show Bio
          </label>
        </div>
        <button onClick={connectLedgerForPrivacy} disabled={ledgerConnected || loading.ledger}>
          {ledgerConnected ? 'Ledger Connected' : 'Connect Ledger for Privacy'}
        </button>
        <button onClick={handlePrivacySettingsUpdate} disabled={loading.privacy || !ledgerConnected}>
          {loading.privacy ? 'Updating...' : 'Update Privacy Settings'}
        </button>
      </section>

      {/* Notification Preferences */}
      <section className="notification-settings">
        <h3>Notification Preferences</h3>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={notificationPrefs.newsletter}
              onChange={(e) => setNotificationPrefs({ ...notificationPrefs, newsletter: e.target.checked })}
              disabled={loading.notifications}
            />
            Subscribe to Newsletter
          </label>
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={notificationPrefs.productUpdates}
              onChange={(e) => setNotificationPrefs({ ...notificationPrefs, productUpdates: e.target.checked })}
              disabled={loading.notifications}
            />
            Receive Product Updates
          </label>
        </div>
        <button onClick={handleNotificationUpdate} disabled={loading.notifications}>
          {loading.notifications ? 'Updating...' : 'Update Notification Preferences'}
        </button>
      </section>

      {/* Logout Button */}
      <section className="logout-section">
        <h3>Logout</h3>
        <button onClick={() => alert('Logged out')} className="btn btn-danger" disabled={loading.profile || loading.privacy || loading.notifications}>
          Logout
        </button>
      </section>
    </div>
  );
};

export default SettingsPage;
