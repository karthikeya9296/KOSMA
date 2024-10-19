import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import FlowClient from '@onflow/fcl'; // Flow SDK for displaying owned NFTs
import StoryProtocol from 'story-protocol-js'; // Story Protocol for licensing and royalty details
import UnlockProtocol from '@unlock-protocol/unlock-js'; // Unlock Protocol for membership management
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'; // Ledger Transport for Ledger integration
import Ledger from '@ledgerhq/hw-app-eth'; // LedgerJS for profile security integration
import LayerZeroMessaging from './LayerZeroMessaging'; // LayerZero Messaging for cross-chain NFT transfer
import './ProfilePage.css'; // Custom CSS for profile page styling

const ProfilePage = () => {
  const [userContent, setUserContent] = useState([]);
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [membershipDetails, setMembershipDetails] = useState(null);
  const [royaltyEarnings, setRoyaltyEarnings] = useState(0);
  const [ledgerConnected, setLedgerConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [profilePicture, setProfilePicture] = useState('/path/to/default-avatar.png');
  const [loading, setLoading] = useState({
    content: false,
    nfts: false,
    membership: false,
    ledger: false,
    transfer: false,
    profilePicture: false,
  });
  const [errorMessage, setErrorMessage] = useState('');

  const flowClient = new FlowClient();
  const storyProtocol = new StoryProtocol();
  const unlock = new UnlockProtocol();

  // Unified loading state handler
  const setLoadingState = (section, state) => {
    setLoading((prev) => ({ ...prev, [section]: state }));
  };

  // Fetch user-generated content
  const fetchUserContent = async () => {
    setLoadingState('content', true);
    try {
      const contentResponse = await fetch('/api/user-content');
      const contentData = await contentResponse.json();
      setUserContent(contentData);

      // Fetch royalties for licensed content via Story Protocol
      const royalties = await storyProtocol.getUserRoyalties(walletAddress);
      setRoyaltyEarnings(royalties.totalEarnings);
    } catch (error) {
      setErrorMessage('Failed to load user content.');
    } finally {
      setLoadingState('content', false);
    }
  };

  // Fetch owned NFTs from Flow blockchain
  const fetchOwnedNFTs = async () => {
    setLoadingState('nfts', true);
    try {
      const nftResponse = await flowClient.query({
        cadence: 'get_user_nfts()', // Replace with actual cadence query
        args: [walletAddress],
      });
      setOwnedNFTs(nftResponse);
    } catch (error) {
      setErrorMessage('Failed to load NFTs.');
    } finally {
      setLoadingState('nfts', false);
    }
  };

  // Fetch membership details using Unlock Protocol
  const fetchMembershipDetails = async () => {
    setLoadingState('membership', true);
    try {
      const lockAddress = 'YOUR_UNLOCK_LOCK_ADDRESS'; // Replace with your Unlock Protocol lock address
      const lock = await unlock.getLock(lockAddress);
      const keyDetails = await lock.getKeyByAddress(walletAddress);

      setMembershipDetails(keyDetails);
    } catch (error) {
      setErrorMessage('Failed to load membership details.');
    } finally {
      setLoadingState('membership', false);
    }
  };

  // Connect Ledger Wallet
  const connectLedgerWallet = async () => {
    setLoadingState('ledger', true);
    try {
      const transport = await TransportWebUSB.create();
      const ledger = new Ledger(transport);
      const result = await ledger.getAddress("44'/60'/0'/0/0"); // Ethereum Ledger address derivation path

      setWalletAddress(result.address);
      setLedgerConnected(true);
    } catch (error) {
      setErrorMessage('Failed to connect Ledger wallet.');
    } finally {
      setLoadingState('ledger', false);
    }
  };

  // Transfer NFTs across chains using LayerZero Messaging
  const handleNFTTransfer = async (nftId, destinationChain) => {
    setLoadingState('transfer', true);
    try {
      const transferResult = await LayerZeroMessaging.transferNFT({
        nftId,
        fromChain: 'Flow',
        toChain: destinationChain,
        userAddress: walletAddress,
      });
      alert('NFT transferred successfully!');
    } catch (error) {
      setErrorMessage('Failed to transfer NFT.');
    } finally {
      setLoadingState('transfer', false);
    }
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setLoadingState('profilePicture', true);
      try {
        // Simulate profile picture upload
        const formData = new FormData();
        formData.append('profilePicture', file);

        // Replace this with the actual API call
        const response = await fetch('/api/upload-profile-picture', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setProfilePicture(data.imageUrl); // Update the profile picture with the new image URL
        } else {
          throw new Error('Failed to upload profile picture.');
        }
      } catch (error) {
        setErrorMessage('Failed to upload profile picture.');
      } finally {
        setLoadingState('profilePicture', false);
      }
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    if (walletAddress) {
      fetchUserContent();
      fetchOwnedNFTs();
      fetchMembershipDetails();
    }
  }, [walletAddress]);

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="profile-info">
          <img src={profilePicture} alt="User Avatar" className="user-avatar" />
          <h2>Username</h2>
          <p>User bio goes here...</p>
          <input type="file" onChange={handleProfilePictureUpload} disabled={loading.profilePicture} />
        </div>
        <div className="profile-security">
          <button
            className="btn btn-primary"
            onClick={connectLedgerWallet}
            disabled={ledgerConnected || loading.ledger}
          >
            {ledgerConnected ? 'Ledger Connected' : loading.ledger ? 'Connecting...' : 'Connect to Ledger'}
          </button>
        </div>
      </header>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <div className="profile-content">
        <section className="user-content-section">
          <h3>User-Generated Content</h3>
          {loading.content ? (
            <p>Loading content...</p>
          ) : (
            <div className="content-list">
              {userContent.map((content, index) => (
                <div key={index} className="content-item">
                  <h4>{content.title}</h4>
                  <p>{content.description}</p>
                  <p>Licensed: {content.licensed ? 'Yes' : 'No'}</p>
                  <p>Royalties Earned: {content.royalties} ETH</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="nft-section">
          <h3>Owned NFTs</h3>
          {loading.nfts ? (
            <p>Loading NFTs...</p>
          ) : (
            <div className="nft-gallery">
              {ownedNFTs.map((nft, index) => (
                <div key={index} className="nft-item">
                  <img src={nft.image} alt={nft.name} />
                  <p>{nft.name}</p>
                  <button onClick={() => handleNFTTransfer(nft.id, 'Ethereum')} disabled={loading.transfer}>
                    {loading.transfer ? 'Transferring...' : 'Transfer to Ethereum'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="membership-section">
          <h3>Membership Information</h3>
          {loading.membership ? (
            <p>Loading membership details...</p>
          ) : membershipDetails ? (
            <div className="membership-details">
              <p>Status: {membershipDetails.active ? 'Active' : 'Inactive'}</p>
              <p>Benefits: {membershipDetails.benefits.join(', ')}</p>
              <p>Renewal Date: {new Date(membershipDetails.expiration * 1000).toLocaleDateString()}</p>
              <button className="btn btn-light">Renew Membership</button>
            </div>
          ) : (
            <p>No active membership</p>
          )}
        </section>

        <section className="royalty-section">
          <h3>Royalty Earnings</h3>
          <p>Total Royalties Earned: {royaltyEarnings} ETH</p>
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;
