// Import necessary libraries and modules
const express = require('express');
const FlowNFT = require('./FlowNFT'); // Flow Blockchain SDK for NFT minting
const StoryProtocol = require('./StoryProtocol'); // Story Protocol for NFT licensing
const LayerZeroMessaging = require('./LayerZeroMessaging'); // LayerZero for cross-chain transfers
const SignProtocol = require('./SignProtocol'); // Sign Protocol for ownership verification
const NFT = require('./models/NFT'); // MongoDB model for NFTs
const { authenticateUser } = require('./middleware/auth'); // Middleware for user authentication
const rateLimit = require('express-rate-limit'); // Rate limiter for security

const router = express.Router();

// Apply rate limiting to prevent abuse of NFT functionalities
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.',
});

router.use(apiLimiter);

/**
 * Mint NFT
 * @route POST /nft/mint
 * @param {string} userId - User ID of the creator
 * @param {string} contentId - ID of the content to mint as NFT
 * @param {object} metadata - Metadata for the NFT
 */
router.post('/mint', authenticateUser, async (req, res) => {
    const { userId, contentId, metadata } = req.body;

    try {
        // Verify ownership using Sign Protocol
        const isOwner = await SignProtocol.verifyOwnership(userId, contentId);
        if (!isOwner) {
            return res.status(403).json({ message: 'Not authorized to mint this content as NFT' });
        }

        // Mint NFT on Flow Blockchain
        const nftData = await FlowNFT.mint(userId, contentId, metadata);
        
        // Save NFT details in the database
        const newNFT = new NFT({
            userId,
            contentId,
            tokenId: nftData.tokenId,
            metadata,
            createdAt: new Date(),
        });
        await newNFT.save();

        res.status(201).json({ message: 'NFT minted successfully', nft: newNFT });
    } catch (error) {
        console.error('Error minting NFT:', error);
        res.status(500).json({ message: 'Error minting NFT', error: error.message });
    }
});

/**
 * License NFT
 * @route POST /nft/license
 * @param {string} nftId - ID of the NFT to license
 * @param {object} licenseData - Licensing details
 */
router.post('/license', authenticateUser, async (req, res) => {
    const { nftId, licenseData } = req.body;

    try {
        // Fetch NFT details
        const nft = await NFT.findById(nftId);
        if (!nft) {
            return res.status(404).json({ message: 'NFT not found' });
        }

        // License NFT using Story Protocol
        await StoryProtocol.licenseNFT(nft.tokenId, licenseData);

        res.json({ message: 'NFT licensed successfully' });
    } catch (error) {
        console.error('Error licensing NFT:', error);
        res.status(500).json({ message: 'Error licensing NFT', error: error.message });
    }
});

/**
 * Transfer NFT
 * @route POST /nft/transfer
 * @param {string} nftId - ID of the NFT to transfer
 * @param {string} toAddress - Address to transfer the NFT to
 */
router.post('/transfer', authenticateUser, async (req, res) => {
    const { nftId, toAddress } = req.body;

    try {
        // Fetch NFT details
        const nft = await NFT.findById(nftId);
        if (!nft) {
            return res.status(404).json({ message: 'NFT not found' });
        }

        // Verify ownership using Sign Protocol
        const isOwner = await SignProtocol.verifyOwnership(nft.userId, nft.tokenId);
        if (!isOwner) {
            return res.status(403).json({ message: 'Not authorized to transfer this NFT' });
        }

        // Transfer NFT using LayerZeroMessaging for cross-chain transfer
        await LayerZeroMessaging.transfer(nft.tokenId, toAddress);

        res.json({ message: 'NFT transferred successfully' });
    } catch (error) {
        console.error('Error transferring NFT:', error);
        res.status(500).json({ message: 'Error transferring NFT', error: error.message });
    }
});

/**
 * Enforce Royalties during Sale
 * Middleware to enforce royalties for each sale transaction
 * Uses Story Protocol to check and apply royalties.
 */
const enforceRoyalties = async (req, res, next) => {
    const { nftId, salePrice } = req.body;

    try {
        const nft = await NFT.findById(nftId);
        if (!nft) {
            return res.status(404).json({ message: 'NFT not found' });
        }

        // Check royalty details via Story Protocol
        const royalties = await StoryProtocol.getRoyaltyDetails(nft.tokenId);
        if (royalties) {
            const royaltyAmount = (salePrice * royalties.rate) / 100;

            // Deduct royalty from sale and transfer to creator
            await StoryProtocol.enforceRoyaltyPayment(nft.userId, royaltyAmount);
        }

        next();
    } catch (error) {
        console.error('Error enforcing royalties:', error);
        res.status(500).json({ message: 'Error enforcing royalties', error: error.message });
    }
};

/**
 * Additional NFT Sale Route (example usage of enforceRoyalties)
 * @route POST /nft/sale
 * @param {string} nftId - ID of the NFT being sold
 * @param {number} salePrice - Sale price of the NFT
 * @param {string} buyerId - User ID of the buyer
 */
router.post('/sale', authenticateUser, enforceRoyalties, async (req, res) => {
    const { nftId, salePrice, buyerId } = req.body;

    try {
        // Transfer ownership to the buyer
        const nft = await NFT.findByIdAndUpdate(nftId, { userId: buyerId });

        // Record the sale transaction
        // (You can integrate other blockchain sales handling logic here)

        res.json({ message: 'NFT sold successfully', nft });
    } catch (error) {
        console.error('Error processing sale:', error);
        res.status(500).json({ message: 'Error processing sale', error: error.message });
    }
});

module.exports = router;
