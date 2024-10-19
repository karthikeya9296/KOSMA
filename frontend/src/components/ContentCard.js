import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { FlowClient } from '@onflow/fcl'; 
import StoryProtocol from 'story-protocol-js'; 
import SignProtocol from 'sign-protocol-js'; 
import XMTP from 'xmtp-js'; 

const ContentCard = ({ content }) => {
  const { id, title, description, creator, mediaUrl, mediaType, viewCount } = content;

  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [licensingInfo, setLicensingInfo] = useState(null);
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);
  const [likeError, setLikeError] = useState('');
  const [commentError, setCommentError] = useState('');
  const [licenseError, setLicenseError] = useState('');
  const [mintError, setMintError] = useState('');

  const flowClient = new FlowClient(); 
  const xmtpClient = new XMTP.Client(); 

  useEffect(() => {
    async function loadContentData() {
      try {
        const likes = await fetchLikesFromBackend(id); 
        const comments = await fetchCommentsFromBackend(id); 

        setLikeCount(likes);
        setComments(comments);
      } catch (error) {
        setLikeError('Failed to load content data.');
      }
    }
    loadContentData();
  }, [id]);

  const handleLike = useCallback(async () => {
    try {
      setLikeLoading(true);
      setLikeError('');

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const likeAttestation = await SignProtocol.createAttestation(signer, { contentId: id, action: 'like' });

      if (likeAttestation) {
        setLikeCount((prevCount) => prevCount + 1);
        setIsLiked(true);
      }
    } catch (error) {
      setLikeError('Failed to like content.');
    } finally {
      setLikeLoading(false);
    }
  }, [id]);

  const handleAddComment = useCallback(async () => {
    try {
      setCommentLoading(true);
      setCommentError('');
      if (!newComment.trim()) return;

      const commentPayload = {
        contentId: id,
        message: newComment,
        timestamp: Date.now(),
      };

      await xmtpClient.sendMessage(creator, commentPayload);

      setComments((prevComments) => [...prevComments, commentPayload]);
      setNewComment('');
    } catch (error) {
      setCommentError('Failed to post comment.');
    } finally {
      setCommentLoading(false);
    }
  }, [newComment, id, creator]);

  const handleLicenseContent = useCallback(async () => {
    try {
      setLicenseLoading(true);
      setLicenseError('');
      const storyProtocol = new StoryProtocol();
      const license = await storyProtocol.applyForLicense(id);
      setLicensingInfo(license);
    } catch (error) {
      setLicenseError('Failed to license content.');
    } finally {
      setLicenseLoading(false);
    }
  }, [id]);

  const handleMintAsNFT = useCallback(async () => {
    try {
      setMintLoading(true);
      setMintError('');

      const result = await flowClient.mintNFT({
        contentId: id,
        metadata: { title, description, creator, mediaUrl },
      });

      if (result) {
        alert('Content successfully minted as an NFT.');
      }
    } catch (error) {
      setMintError('Failed to mint NFT.');
    } finally {
      setMintLoading(false);
    }
  }, [id, title, description, creator, mediaUrl]);

  return (
    <div className="content-card">
      {mediaType === 'image' ? (
        <img src={mediaUrl} alt={title} className="content-image" />
      ) : (
        <video controls src={mediaUrl} className="content-video" />
      )}
      
      <div className="content-details">
        <h3>{title}</h3>
        <p>{description}</p>
        <p>Created by: {creator}</p>
        <p>Views: {viewCount}</p>

        <div className="content-actions">
          <button
            className={`btn ${isLiked ? 'btn-success' : 'btn-light'}`}
            onClick={handleLike}
            disabled={isLiked || likeLoading}
          >
            {isLiked ? 'Liked' : 'Like'} ({likeCount})
          </button>
          <button className="btn btn-light" onClick={handleAddComment} disabled={commentLoading}>
            Comment
          </button>
          <button className="btn btn-light" onClick={handleLicenseContent} disabled={licenseLoading}>
            License Content
          </button>
          <button className="btn btn-light" onClick={handleMintAsNFT} disabled={mintLoading}>
            Mint as NFT
          </button>
        </div>

        {likeLoading || commentLoading || licenseLoading || mintLoading ? <p>Loading...</p> : null}
        {likeError || commentError || licenseError || mintError ? <p className="error-message">{likeError || commentError || licenseError || mintError}</p> : null}

        <div className="comments-section">
          <h4>Comments</h4>
          <ul>
            {comments.map((comment, index) => (
              <li key={index}>{comment.message}</li>
            ))}
          </ul>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            disabled={commentLoading}
          />
          <button className="btn btn-primary" onClick={handleAddComment} disabled={commentLoading || !newComment.trim()}>
            Post Comment
          </button>
        </div>

        {licensingInfo && (
          <div className="licensing-info">
            <h4>License Information</h4>
            <p>License Status: {licensingInfo.status}</p>
            <p>Price: {licensingInfo.price} ETH</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentCard;
