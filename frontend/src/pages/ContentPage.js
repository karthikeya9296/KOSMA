import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import FlowClient from '@onflow/fcl'; // Flow SDK for NFT minting
import StoryProtocol from 'story-protocol-js'; // Story Protocol for licensing and royalties
import XMTP from 'xmtp-js'; // XMTP for on-chain encrypted messaging
import LayerZeroMessaging from './LayerZeroMessaging'; // LayerZero for cross-chain interactions
import SuperfluidSDK from '@superfluid-finance/js-sdk'; // Superfluid for streaming payments
import OpenAI from 'openai-api'; // OpenAI for AI-driven content recommendations
import './ContentPage.css'; // Custom CSS for styling

const ContentPage = ({ contentId }) => {
  const [content, setContent] = useState(null);
  const [relatedContent, setRelatedContent] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [licenseOptions, setLicenseOptions] = useState([]);
  const [isMintingNFT, setIsMintingNFT] = useState(false);
  const [streamStatus, setStreamStatus] = useState(false);
  const [loading, setLoading] = useState({
    content: false,
    relatedContent: false,
    comments: false,
    transaction: false,
  });
  const [errorMessage, setErrorMessage] = useState('');

  const flowClient = new FlowClient();
  const storyProtocol = new StoryProtocol();
  const xmtp = new XMTP.Client(); // XMTP client for encrypted comments
  const openai = new OpenAI('YOUR_OPENAI_API_KEY'); // OpenAI API for recommendations
  const sf = new SuperfluidSDK.Framework({
    ethersProvider: new ethers.providers.Web3Provider(window.ethereum),
  });

  // Helper function to handle loading state
  const setLoadingState = (section, state) => {
    setLoading((prev) => ({ ...prev, [section]: state }));
  };

  // Centralized error handler
  const handleError = (message) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 3000); // Clear error message after 3 seconds
  };

  // Fetch content data (e.g., from a backend or on-chain)
  const fetchContentData = useCallback(async () => {
    setLoadingState('content', true);
    try {
      const response = await fetch(`/api/content/${contentId}`);
      const data = await response.json();
      setContent(data);

      const licenseOptions = await storyProtocol.getLicenseOptions(contentId);
      setLicenseOptions(licenseOptions);
    } catch (error) {
      handleError('Failed to load content.');
    } finally {
      setLoadingState('content', false);
    }
  }, [contentId, storyProtocol]);

  // Fetch related content using OpenAI's recommendation engine
  const fetchRelatedContent = useCallback(async () => {
    setLoadingState('relatedContent', true);
    try {
      const response = await openai.complete({
        engine: 'davinci-codex',
        prompt: `Suggest related content for this topic: ${content?.title}`,
        maxTokens: 100,
        n: 3,
        stop: ['\n'],
      });
      const recommendations = response.data.choices.map((choice) => choice.text.trim());
      setRelatedContent(recommendations);
    } catch (error) {
      handleError('Failed to load related content.');
    } finally {
      setLoadingState('relatedContent', false);
    }
  }, [content?.title, openai]);

  // Fetch on-chain comments
  const fetchComments = useCallback(async () => {
    setLoadingState('comments', true);
    try {
      const comments = await xmtp.fetchMessages(contentId);
      setComments(comments);
    } catch (error) {
      handleError('Failed to load comments.');
    } finally {
      setLoadingState('comments', false);
    }
  }, [contentId, xmtp]);

  // Handle adding a new comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setLoadingState('transaction', true);
    try {
      await xmtp.sendMessage(contentId, newComment);
      setNewComment('');
      fetchComments(); // Reload comments after adding
    } catch (error) {
      handleError('Failed to post comment.');
    } finally {
      setLoadingState('transaction', false);
    }
  };

  // Mint content as NFT on Flow blockchain
  const handleMintAsNFT = async () => {
    setIsMintingNFT(true);
    setLoadingState('transaction', true);
    try {
      await flowClient.mintNFT({
        contract: 'FlowNFT.sol',
        contentId,
        metadata: {
          title: content.title,
          description: content.description,
          creator: content.creator,
        },
      });
      alert('Content minted as an NFT!');
    } catch (error) {
      handleError('Failed to mint NFT.');
    } finally {
      setIsMintingNFT(false);
      setLoadingState('transaction', false);
    }
  };

  // License content via Story Protocol
  const handleLicenseContent = async (option) => {
    setLoadingState('transaction', true);
    try {
      await storyProtocol.applyForLicense({
        contentId,
        licenseType: option.type,
        terms: option.terms,
      });
      alert('Content licensed successfully!');
    } catch (error) {
      handleError('Failed to license content.');
    } finally {
      setLoadingState('transaction', false);
    }
  };

  // Handle Superfluid streaming payments
  const handleStreamPayment = async () => {
    setLoadingState('transaction', true);
    try {
      const user = sf.user({
        address: content.creator,
        token: 'fUSDCx', // Example Superfluid token
      });
      await user.flow({
        recipient: content.creator,
        flowRate: '1000000000', // Example flow rate
      });
      setStreamStatus(true);
      alert('Streaming payment initiated.');
    } catch (error) {
      handleError('Failed to start streaming payment.');
    } finally {
      setLoadingState('transaction', false);
    }
  };

  // Cross-chain content interaction with LayerZero
  const handleCrossChainInteraction = async (destinationChain) => {
    setLoadingState('transaction', true);
    try {
      await LayerZeroMessaging.sendMessage({
        contentId,
        message: 'Interacting with content from another chain',
        destinationChain,
      });
      alert('Interaction sent to another chain successfully.');
    } catch (error) {
      handleError('Failed to interact across chains.');
    } finally {
      setLoadingState('transaction', false);
    }
  };

  // Fetch content and related data on component mount
  useEffect(() => {
    fetchContentData();
    fetchRelatedContent();
    fetchComments();
  }, [fetchContentData, fetchRelatedContent, fetchComments]);

  return (
    <div className="content-page">
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {/* Main Content Display */}
      {loading.content ? (
        <p>Loading content...</p>
      ) : (
        content && (
          <div className="content-display">
            <h2>{content.title}</h2>
            <p>{content.description}</p>
            {content.type === 'image' ? <img src={content.mediaUrl} alt={content.title} /> : <video controls src={content.mediaUrl} />}
          </div>
        )
      )}

      {/* AI-Driven Related Content Recommendations */}
      <aside className="related-content">
        <h3>Related Content</h3>
        {loading.relatedContent ? (
          <p>Loading recommendations...</p>
        ) : (
          relatedContent.map((item, index) => <p key={index}>{item}</p>)
        )}
      </aside>

      {/* Comments Section */}
      <section className="comments-section">
        <h3>Comments</h3>
        {loading.comments ? (
          <p>Loading comments...</p>
        ) : (
          comments.map((comment, index) => <p key={index}>{comment}</p>)
        )}
        <textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button onClick={handleAddComment} disabled={loading.transaction || !newComment.trim()}>
          Post Comment
        </button>
      </section>

      {/* Licensing and NFT Minting Options */}
      <section className="licensing-nft-section">
        <h3>Licensing & NFT Options</h3>

        <div className="license-options">
          <h4>License This Content</h4>
          {licenseOptions.length > 0 ? (
            licenseOptions.map((option, index) => (
              <button key={index} onClick={() => handleLicenseContent(option)} disabled={loading.transaction}>
                License as {option.type} ({option.terms})
              </button>
            ))
          ) : (
            <p>Loading licensing options...</p>
          )}
        </div>

        <div className="nft-options">
          <h4>Mint as NFT</h4>
          <button onClick={handleMintAsNFT} disabled={isMintingNFT || loading.transaction}>
            {isMintingNFT ? 'Minting...' : 'Mint Content as NFT'}
          </button>
        </div>
      </section>

      {/* Superfluid Streaming Payments */}
      <section className="streaming-section">
        <h4>Streaming Payment</h4>
        <button onClick={handleStreamPayment} disabled={streamStatus || loading.transaction}>
          {streamStatus ? 'Streaming Active' : 'Start Streaming Payment'}
        </button>
      </section>

      {/* Cross-Chain Interactions */}
      <section className="cross-chain-section">
        <h4>Cross-Chain Interaction</h4>
        <button onClick={() => handleCrossChainInteraction('Ethereum')} disabled={loading.transaction}>
          Interact from Ethereum
        </button>
        <button onClick={() => handleCrossChainInteraction('Polygon')} disabled={loading.transaction}>
          Interact from Polygon
        </button>
      </section>
    </div>
  );
};

export default ContentPage;
