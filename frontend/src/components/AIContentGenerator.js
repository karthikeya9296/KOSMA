import React, { useState } from 'react';
import { ethers } from 'ethers';
import OpenAI from 'openai-api'; // OpenAI API for content generation
import FlowClient from '@onflow/fcl'; // Flow SDK for NFT minting
import StoryProtocol from 'story-protocol-js'; // Story Protocol for content licensing
import { useLit } from './useLitProtocol'; // Custom hook for Lit Protocol encryption
import KosmaNFTABI from './abi/FlowNFT.json'; // KosmaNFT ABI for minting
import './AIContentGenerator.css'; // Assuming custom CSS for styling

const AIContentGenerator = ({ flowNFTAddress }) => {
  const [contentType, setContentType] = useState('text');
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [encryptedContent, setEncryptedContent] = useState(null);

  const { encryptData } = useLit(); // Custom Lit Protocol hook for encryption
  const flowClient = new FlowClient(); // Flow SDK client

  // OpenAI API setup
  const openai = new OpenAI('YOUR_OPENAI_API_KEY'); // Replace with your OpenAI API key

  // Function to handle AI content generation
  const handleGenerateContent = async () => {
    if (!prompt.trim()) {
      setErrorMessage('Prompt cannot be empty.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      // Call OpenAI API to generate content based on the prompt and content type
      const aiResponse = await openai.complete({
        engine: 'davinci-codex',
        prompt: `Generate a ${contentType} for the following prompt: ${prompt}`,
        maxTokens: contentType === 'text' ? 150 : 50, // Adjust tokens based on content type
        n: 1,
        stop: ['\n'],
      });

      const generated = aiResponse.data.choices[0].text.trim();
      setGeneratedContent(generated);

      // Encrypt content using Lit Protocol for secure access
      const encrypted = await encryptData(generated);
      setEncryptedContent(encrypted);
    } catch (error) {
      setErrorMessage('Failed to generate content. Please try again.');
      console.error('Error generating content:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to mint content as NFT on Flow Blockchain
  const handleMintAsNFT = async () => {
    try {
      setLoading(true);
      const metadata = {
        content: generatedContent,
        type: contentType,
        prompt,
      };

      const result = await flowClient.mintNFT({
        contract: flowNFTAddress,
        metadata,
      });

      if (result) {
        alert('Content successfully minted as an NFT on Flow blockchain.');
      }
    } catch (error) {
      setErrorMessage('Failed to mint NFT. Please try again.');
      console.error('Error minting NFT:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to license the generated content using Story Protocol
  const handleLicenseContent = async () => {
    try {
      setLoading(true);
      const storyProtocol = new StoryProtocol();

      // Register content for licensing
      const licenseResult = await storyProtocol.applyForLicense({
        contentId: generatedContent,
        type: contentType,
        terms: 'non-exclusive', // Example terms, can also offer 'exclusive'
      });

      alert('Content successfully licensed on Story Protocol.');
    } catch (error) {
      setErrorMessage('Failed to license content. Please try again.');
      console.error('Error licensing content:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-content-generator">
      <h2>AI Content Generator</h2>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <div className="form-group">
        <label>Select Content Type:</label>
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          disabled={loading}
        >
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="caption">Caption</option>
        </select>
      </div>

      <div className="form-group">
        <label>Enter Prompt:</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a prompt for AI to generate content..."
          disabled={loading}
        />
      </div>

      <button className="btn btn-primary" onClick={handleGenerateContent} disabled={loading || !prompt.trim()}>
        {loading ? 'Generating...' : 'Generate Content'}
      </button>

      {generatedContent && (
        <div className="generated-content-preview">
          <h4>Generated Content Preview</h4>
          {contentType === 'text' && <p>{generatedContent}</p>}
          {contentType === 'image' && <img src={generatedContent} alt="Generated AI Content" />}
          {contentType === 'caption' && <p><strong>Caption:</strong> {generatedContent}</p>}

          <div className="content-actions">
            <button className="btn btn-light" onClick={handleMintAsNFT} disabled={loading}>
              {loading ? 'Minting...' : 'Mint as NFT'}
            </button>
            <button className="btn btn-light" onClick={handleLicenseContent} disabled={loading}>
              {loading ? 'Licensing...' : 'License Content'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIContentGenerator;
