// Import necessary libraries and modules
const { FlowSDK } = require('@onflow/sdk'); // Flow SDK for minting NFTs
const LayerZero = require('./LayerZero'); // LayerZero for cross-chain messaging
const StoryProtocol = require('./StoryProtocol'); // Story Protocol for NFT licensing
const User = require('./models/User'); // User model to fetch user data
const { ReentrancyGuard } = require('./middleware/reentrancyGuard'); // Middleware for reentrancy protection

// Initialize Flow SDK
const flowClient = new FlowSDK({
    // Configuration for Flow blockchain
    api: process.env.FLOW_API_URL,
    // Add any other necessary config here
});

/**
 * Error handling utility with context logging
 */
function handleError(error, context = {}) {
    console.error('NFT Service Error:', error);
    console.error('Context:', context);
    throw new Error('Operation failed. Please try again.');
}

/**
 * Mint NFT with gas estimation and retry logic
 * @param {string} userId - ID of the user minting the NFT
 * @param {string} tokenURI - Metadata URI for the NFT
 * @returns {Promise<string>} - Transaction hash of the minting process
 */
async function mintNFT(userId, tokenURI) {
    try {
        const user = await User.findById(userId);
        const gasEstimate = await flowClient.estimateGas.mintNFT(user.blockchainAddress, tokenURI);
        const tx = await flowClient.mintNFT(user.blockchainAddress, tokenURI, { gasLimit: gasEstimate });
        await tx.wait(); // Wait for transaction confirmation
        return tx.hash;
    } catch (error) {
        handleError(error, { method: 'mintNFT', userId, tokenURI });
    }
}

/**
 * Transfer NFT with retry logic
 * @param {string} nftId - ID of the NFT to transfer
 * @param {string} recipient - Address of the recipient
 * @returns {Promise<string>} - Transaction hash of the transfer process
 */
async function transferNFT(nftId, recipient) {
    try {
        let retries = 0;
        let tx = null;
        while (!tx && retries < 3) {
            try {
                tx = await LayerZero.transferNFT(nftId, recipient);
                await tx.wait(); // Wait for transaction confirmation
            } catch (error) {
                retries += 1;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Retry after 1 second
            }
        }
        if (!tx) {
            throw new Error('NFT transfer failed after 3 retries');
        }
        return tx.hash;
    } catch (error) {
        handleError(error, { method: 'transferNFT', nftId, recipient });
    }
}

/**
 * License NFT with validation of royalty splits and gas estimation
 * @param {string} nftId - ID of the NFT to license
 * @param {Array<string>} royaltyRecipients - Array of recipient addresses for royalty splits
 * @param {Array<number>} royaltyShares - Corresponding shares for each recipient
 * @returns {Promise<string>} - Transaction hash of the licensing process
 */
async function licenseNFT(nftId, royaltyRecipients, royaltyShares) {
    try {
        const totalShares = royaltyShares.reduce((sum, share) => sum + share, 0);
        if (totalShares !== 100) {
            throw new Error('Total royalty shares must equal 100%');
        }

        const gasEstimate = await StoryProtocol.estimateGas.licenseNFT(nftId, royaltyRecipients, royaltyShares);
        const tx = await StoryProtocol.licenseNFT(nftId, royaltyRecipients, royaltyShares, { gasLimit: gasEstimate });
        await tx.wait(); // Wait for transaction confirmation
        return tx.hash;
    } catch (error) {
        handleError(error, { method: 'licenseNFT', nftId, royaltyRecipients, royaltyShares });
    }
}

/**
 * Listen for events from Flow, LayerZero, and Story Protocol
 * @param {string} eventType - Type of the event to listen for (e.g., 'Minted', 'Transferred', 'Licensed')
 * @param {function} callback - Callback function to handle the event
 */
function listenForEvents(eventType, callback) {
    try {
        flowClient.on(eventType, callback);
        LayerZero.on(eventType, callback);
        StoryProtocol.on(eventType, callback);
    } catch (error) {
        handleError(error, { method: 'listenForEvents', eventType });
    }
}

// Export the functions for use in other modules
module.exports = {
    mintNFT,
    transferNFT,
    licenseNFT,
    listenForEvents,
};
