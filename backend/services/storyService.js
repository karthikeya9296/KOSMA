// Import necessary libraries and modules
const StoryProtocol = require('./StoryProtocol'); // Story Protocol for licensing and royalty management
const Superfluid = require('./Superfluid'); // Superfluid for royalty streaming
const User = require('./models/User'); // User model to fetch user data
const { validateInputs, validateRoyalties } = require('./validators'); // Input validation utility
const { ReentrancyGuard } = require('./middleware/reentrancyGuard'); // Middleware for reentrancy protection

/**
 * Create License with input validation and gas estimation
 * @param {string} creatorId - ID of the content creator
 * @param {string} contentId - ID of the content to be licensed
 * @param {Array<string>} licenseeAddresses - Array of addresses for licensees
 * @param {Array<number>} royaltyShares - Corresponding shares for each licensee
 * @returns {Promise<string>} - Transaction hash of the license creation
 */
async function createLicense(creatorId, contentId, licenseeAddresses, royaltyShares) {
    try {
        // Input validation
        validateInputs({ creatorId, contentId, licenseeAddresses, royaltyShares });
        validateRoyalties(royaltyShares);

        const creator = await User.findById(creatorId);
        
        // Estimate gas for the license creation
        const gasEstimate = await StoryProtocol.estimateGas.createLicense(creator.blockchainAddress, contentId, licenseeAddresses, royaltyShares);

        // Create license
        const tx = await StoryProtocol.createLicense(creator.blockchainAddress, contentId, licenseeAddresses, royaltyShares, { gasLimit: gasEstimate });
        await tx.wait(); // Wait for the transaction to be confirmed on-chain
        
        return tx.hash;
    } catch (error) {
        console.error('Error creating license:', error);
        throw new Error('License creation failed');
    }
}

/**
 * Manage Royalties with retry logic and batch processing
 * @param {string} contentId - ID of the licensed content
 * @param {number} amount - Amount to be distributed as royalties
 * @returns {Promise<string>} - Transaction hash of the royalty distribution
 */
async function manageRoyalties(contentId, amount) {
    try {
        let retries = 0;
        let tx = null;
        while (!tx && retries < 3) {
            try {
                // Batch processing for royalties
                const tx = await Superfluid.batchDistributeRoyalties(contentId, amount);
                await tx.wait(); // Wait for transaction confirmation
            } catch (error) {
                retries += 1;
                console.error(`Retry ${retries}: Error managing royalties`, error);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
            }
        }
        
        if (!tx) {
            throw new Error('Royalty distribution failed after 3 retries');
        }
        
        return tx.hash;
    } catch (error) {
        console.error('Error managing royalties:', error);
        throw new Error('Royalty management failed');
    }
}

/**
 * Handle Dispute with input validation and enhanced error logging
 * @param {string} disputeId - ID of the dispute to be resolved
 * @param {string} resolution - Resolution details for the dispute
 * @returns {Promise<string>} - Transaction hash of the dispute resolution
 */
async function handleDispute(disputeId, resolution) {
    try {
        // Validate inputs
        validateInputs({ disputeId, resolution });

        // Resolve the dispute
        const tx = await StoryProtocol.resolveDispute(disputeId, resolution);
        await tx.wait(); // Wait for transaction confirmation
        
        return tx.hash;
    } catch (error) {
        console.error('Error handling dispute:', error);
        throw new Error('Dispute resolution failed');
    }
}

// Export the functions for use in other modules
module.exports = {
    createLicense,
    manageRoyalties,
    handleDispute,
};
