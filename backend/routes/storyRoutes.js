// Import necessary libraries and modules
const express = require('express');
const StoryProtocol = require('./StoryProtocol'); // Story Protocol for licensing and royalties
const SignProtocol = require('./SignProtocol'); // Sign Protocol for ownership verification
const { encryptAgreement } = require('./encryption'); // Encryption utility using Lit Protocol
const Content = require('./models/Content'); // MongoDB model for content
const Royalty = require('./models/Royalty'); // MongoDB model for royalty records
const Dispute = require('./models/Dispute'); // MongoDB model for disputes
const { authenticateUser } = require('./middleware/auth'); // Middleware for user authentication
const rateLimit = require('express-rate-limit'); // Rate limiter to secure API
const SuperfluidSDK = require('@superfluid-finance/sdk-core'); // Superfluid for royalty streaming

const router = express.Router();

// Apply rate limiting to protect the API from abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.',
});

router.use(apiLimiter);

/**
 * Create License
 * @route POST /story/license
 * @param {string} contentId - ID of the content to license
 * @param {object} licenseDetails - Licensing details (e.g., terms, type)
 */
router.post('/license', authenticateUser, async (req, res) => {
    const { contentId, licenseDetails } = req.body;

    try {
        // Verify ownership using Sign Protocol
        const content = await Content.findById(contentId);
        if (!content) return res.status(404).json({ message: 'Content not found' });

        const isOwner = await SignProtocol.verifyOwnership(content.owner, req.user.address);
        if (!isOwner) {
            return res.status(403).json({ message: 'Not authorized to create a license for this content' });
        }

        // Encrypt the licensing agreement using Lit Protocol
        const encryptedAgreement = encryptAgreement(licenseDetails);

        // Create license using Story Protocol
        await StoryProtocol.createLicense(contentId, encryptedAgreement);

        res.status(201).json({ message: 'License created successfully' });
    } catch (error) {
        console.error('Error creating license:', error);
        res.status(500).json({ message: 'Error creating license', error: error.message });
    }
});

/**
 * Manage Royalties
 * @route POST /story/royalties
 * @param {string} contentId - ID of the content for which to set royalties
 * @param {number} royaltyRate - Royalty rate to set (as a percentage)
 */
router.post('/royalties', authenticateUser, async (req, res) => {
    const { contentId, royaltyRate } = req.body;

    try {
        // Verify ownership using Sign Protocol
        const content = await Content.findById(contentId);
        if (!content) return res.status(404).json({ message: 'Content not found' });

        const isOwner = await SignProtocol.verifyOwnership(content.owner, req.user.address);
        if (!isOwner) {
            return res.status(403).json({ message: 'Not authorized to set royalties for this content' });
        }

        // Validate royalty rate
        if (royaltyRate <= 0 || royaltyRate > 100) {
            return res.status(400).json({ message: 'Invalid royalty rate. Must be between 1% and 100%' });
        }

        // Save royalty details in the database
        const royaltyRecord = new Royalty({
            contentId,
            royaltyRate,
            createdAt: new Date(),
        });
        await royaltyRecord.save();

        res.status(201).json({ message: 'Royalty rate set successfully', royalty: royaltyRecord });
    } catch (error) {
        console.error('Error setting royalties:', error);
        res.status(500).json({ message: 'Error setting royalties', error: error.message });
    }
});

/**
 * Stream Royalties
 * @route POST /story/stream-royalties
 * @param {string} contentId - ID of the content for royalty streaming
 * @param {number} flowRate - Flow rate for royalty streaming
 */
router.post('/stream-royalties', authenticateUser, async (req, res) => {
    const { contentId, flowRate } = req.body;

    try {
        // Verify ownership using Sign Protocol
        const content = await Content.findById(contentId);
        if (!content) return res.status(404).json({ message: 'Content not found' });

        const isOwner = await SignProtocol.verifyOwnership(content.owner, req.user.address);
        if (!isOwner) {
            return res.status(403).json({ message: 'Not authorized to stream royalties for this content' });
        }

        // Initialize Superfluid framework for royalty streaming
        const sf = new SuperfluidSDK.Framework();
        await sf.initialize();

        // Stream royalties using Superfluid
        const stream = await sf.cfa.createFlow({
            sender: req.user.walletAddress,
            receiver: content.ownerWalletAddress,
            flowRate, // Flow rate for royalty distribution
            superToken: sf.tokens.usdcx.address,
        });

        res.status(201).json({ message: 'Royalties streaming started successfully', stream });
    } catch (error) {
        console.error('Error streaming royalties:', error);
        res.status(500).json({ message: 'Error streaming royalties', error: error.message });
    }
});

/**
 * Raise Dispute
 * @route POST /story/dispute
 * @param {string} contentId - ID of the content in dispute
 * @param {string} reason - Reason for the dispute
 */
router.post('/dispute', authenticateUser, async (req, res) => {
    const { contentId, reason } = req.body;

    try {
        // Fetch content details
        const content = await Content.findById(contentId);
        if (!content) return res.status(404).json({ message: 'Content not found' });

        // Validate dispute reason
        if (!reason || reason.length < 10) {
            return res.status(400).json({ message: 'Dispute reason must be at least 10 characters long' });
        }

        // Create a dispute record
        const disputeRecord = new Dispute({
            contentId,
            userId: req.user.id,
            reason,
            createdAt: new Date(),
        });
        await disputeRecord.save();

        // Log the dispute on Story Protocol for dispute resolution
        await StoryProtocol.raiseDispute(contentId, req.user.id, reason);

        res.status(201).json({ message: 'Dispute raised successfully', dispute: disputeRecord });
    } catch (error) {
        console.error('Error raising dispute:', error);
        res.status(500).json({ message: 'Error raising dispute', error: error.message });
    }
});

module.exports = router;
