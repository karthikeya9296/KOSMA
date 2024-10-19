import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import OpenAI from 'openai-api'; // OpenAI API for AI-powered content suggestions
import FlowClient from '@onflow/fcl'; // Flow SDK for sports-related content
import StoryProtocol from 'story-protocol-js'; // Story Protocol for content licensing
import { connectWallet, checkWalletConnection } from '../utils/wallet'; // Utility functions to connect/check wallet
import './HomePage.css'; // Custom CSS for styling

const HomePage = () => {
  const [walletAddress, setWalletAddress] = useState('');
  const [trendingContent, setTrendingContent] = useState([]);
  const [recommendedCreators, setRecommendedCreators] = useState([]);
  const [sportsContent, setSportsContent] = useState([]);
  const [personalizedSuggestions, setPersonalizedSuggestions] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const flowClient = new FlowClient();
  const storyProtocol = new StoryProtocol();
  const openai = new OpenAI('YOUR_OPENAI_API_KEY'); // OpenAI API key for content suggestions

  // Connect the wallet
  const handleConnectWallet = async () => {
    try {
      const address = await connectWallet();
      setWalletAddress(address);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage('Failed to connect wallet. Please try again.');
    }
  };

  // Fetch content from the backend (GraphQL or REST API)
  const fetchContent = useCallback(async () => {
    setLoadingContent(true);
    setErrorMessage('');
    try {
      const [trendingResponse, recommendedResponse, sportsResponse] = await Promise.all([
        fetch('/api/trending-content'),
        fetch('/api/recommended-creators'),
        flowClient.query({
          cadence: 'get_sports_content()', // Query sports content on Flow
        }),
      ]);

      setTrendingContent(await trendingResponse.json());
      setRecommendedCreators(await recommendedResponse.json());
      setSportsContent(sportsResponse);
    } catch (error) {
      setErrorMessage('Failed to fetch content. Please try again.');
    } finally {
      setLoadingContent(false);
    }
  }, [flowClient]);

  // Fetch personalized content suggestions using OpenAI API
  const fetchAIContentSuggestions = async () => {
    setLoadingSuggestions(true);
    setErrorMessage('');
    try {
      const response = await openai.complete({
        engine: 'davinci-codex',
        prompt: `Generate personalized content suggestions based on user preferences.`,
        maxTokens: 150,
        n: 3,
        stop: ['\n'],
      });
      const suggestions = response.data.choices.map((choice) => choice.text.trim());
      setPersonalizedSuggestions(suggestions);
    } catch (error) {
      setErrorMessage('Failed to fetch AI content suggestions.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Use Story Protocol to check content licensing opportunities
  const handleContentLicensing = async (contentId) => {
    try {
      const licenseDetails = await storyProtocol.getLicenseDetails(contentId);
      alert(`This content can earn you ${licenseDetails.estimatedEarnings} ETH by licensing!`);
    } catch (error) {
      setErrorMessage('Failed to retrieve licensing details.');
    }
  };

  // Check wallet connection on page load
  useEffect(() => {
    const checkWallet = async () => {
      const address = await checkWalletConnection();
      if (address) {
        setWalletAddress(address);
      }
    };
    checkWallet();
    fetchContent();
  }, [fetchContent]);

  return (
    <div className="home-page">
      <header className="header">
        <h1>Welcome to Kosma</h1>
        {!walletAddress ? (
          <button className="btn btn-primary" onClick={handleConnectWallet}>
            Connect Wallet
          </button>
        ) : (
          <p>Wallet connected: {walletAddress}</p>
        )}
      </header>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {/* Loading content state */}
      {loadingContent ? (
        <p>Loading content...</p>
      ) : (
        <>
          {/* Trending Content Section */}
          <section className="content-section trending-content">
            <h2>Trending Content</h2>
            <div className="content-feed">
              {trendingContent.map((content, index) => (
                <div key={index} className="content-item">
                  <h3>{content.title}</h3>
                  <p>{content.description}</p>
                  <button onClick={() => handleContentLicensing(content.id)}>Check Licensing</button>
                </div>
              ))}
            </div>
          </section>

          {/* Recommended Creators Section */}
          <section className="content-section recommended-creators">
            <h2>Recommended Creators</h2>
            <div className="creators-feed">
              {recommendedCreators.map((creator, index) => (
                <div key={index} className="creator-item">
                  <h3>{creator.name}</h3>
                  <p>{creator.bio}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Sports Content Section - Flow Integration */}
          <section className="content-section sports-content">
            <h2>Sports Content</h2>
            <div className="content-feed">
              {sportsContent.map((content, index) => (
                <div key={index} className="content-item">
                  <h3>{content.title}</h3>
                  <p>{content.description}</p>
                  <button>Engage with Content</button>
                </div>
              ))}
            </div>
          </section>

          {/* Personalized Content Suggestions */}
          <section className="content-section ai-suggestions">
            <h2>Personalized Content Suggestions</h2>
            <button className="btn btn-light" onClick={fetchAIContentSuggestions} disabled={loadingSuggestions}>
              {loadingSuggestions ? 'Fetching Suggestions...' : 'Get AI Suggestions'}
            </button>
            {personalizedSuggestions.length > 0 && (
              <div className="suggestions-list">
                {personalizedSuggestions.map((suggestion, index) => (
                  <p key={index}>{suggestion}</p>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Sidebar with Categories/Filters */}
      <aside className="sidebar">
        <h3>Categories</h3>
        <ul>
          <li>Art</li>
          <li>Music</li>
          <li>Sports</li>
          <li>Technology</li>
        </ul>

        <h3>Filters</h3>
        <ul>
          <li>Most Liked</li>
          <li>Most Commented</li>
          <li>Recently Added</li>
        </ul>
      </aside>
    </div>
  );
};

export default HomePage;
