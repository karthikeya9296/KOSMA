// Import necessary libraries
import express from 'express';
import { ethers } from 'ethers';
import multer from 'multer';
import fs from 'fs';
import ipfsClient from 'ipfs-http-client';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import Bull from 'bull';
import Content from './models/Content'; // MongoDB model for content metadata
import FlowNFT from './FlowNFT'; // Flow NFT contract interactions
import StoryIntegration from './StoryIntegration'; // Story Integration contract interactions
import rateLimit from 'express-rate-limit';
import redis from 'redis';
import { roles } from './roles'; // Role definitions for access control
import { encrypt, decrypt } from './encryption'; // Encryption module for IPFS files

// Create a Redis client for caching
const cache = redis.createClient();

// Create a Bull queue for handling background tasks
const contentQueue = new Bull('content-queue');

// Initialize IPFS client
const ipfs = ipfsClient('https://ipfs.infura.io:5001'); // Use Infura IPFS API

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });

const router = express.Router();

// Rate limiting middleware for sensitive routes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per window
});
router.use(limiter);

// Middleware to authenticate JWT and authorize roles
const authorize = (requiredRole: string) => (req, res, next) => {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (roles[req.user.role] < roles[requiredRole]) {
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
};

// Middleware to handle errors
const errorHandler = (err, req, res, next) => {
    console.error(err);
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: 'Validation error', details: err.errors });
    }
    res.status(500).json({ message: 'Internal server error', error: err.message });
};

/**
 * Create new content and mint NFT
 * @route POST /content/create
 * @param {string} title - Title of the content
 * @param {string} description - Description of the content
 * @param {file} file - Content file to upload
 */
router.post('/create', 
    authorize('user'), // Ensure only authorized users can create content
    upload.single('file'), 
    [
        body('title').notEmpty().trim().escape(),
        body('description').notEmpty().trim().escape()
    ], 
    async (req, res, next) => {
        const { title, description } = req.body;
        const file = req.file;

        try {
            // Encrypt and upload file to IPFS in a background job
            contentQueue.add({ task: 'uploadIPFS', file, title, description, user: req.user });
            res.status(202).json({ message: 'Content creation in progress' });
        } catch (error) {
            next(error);
        }
    }
);

// Queue processing for IPFS uploads and NFT minting
contentQueue.process(async (job) => {
    const { file, title, description, user } = job.data;
    const fileBuffer = fs.readFileSync(file.path);
    
    // Encrypt file before uploading to IPFS
    const encryptedFile = encrypt(fileBuffer);
    
    const ipfsResult = await ipfs.add(encryptedFile);
    const ipfsHash = ipfsResult.path; // Get IPFS hash

    // Mint NFT using FlowNFT contract
    const nftResult = await FlowNFT.mintNFT(user.address, ipfsHash, title, description);

    // Save content metadata to MongoDB
    const content = new Content({
        title,
        description,
        ipfsHash,
        owner: user.address,
        nftId: nftResult.nftId // Assuming mintNFT returns an NFT ID
    });

    await content.save();
    console.log(`Content created successfully for user ${user.address}`);
});

/**
 * Update existing content
 * @route PUT /content/update/:id
 * @param {string} id - Content ID
 * @param {string} title - New title of the content
 * @param {string} description - New description of the content
 */
router.put('/update/:id', authorize('user'), async (req, res, next) => {
    const { id } = req.params;
    const { title, description } = req.body;

    try {
        // Check content ownership before updating
        const content = await Content.findById(id);
        if (content.owner !== req.user.address) {
            return res.status(403).json({ message: 'Unauthorized action' });
        }

        // Update content in MongoDB
        const updatedContent = await Content.findByIdAndUpdate(id, { title, description }, { new: true });
        if (!updatedContent) return res.status(404).json({ message: 'Content not found' });

        res.json({ message: 'Content updated successfully', content: updatedContent });
    } catch (error) {
        next(error);
    }
});

/**
 * Delete content
 * @route DELETE /content/delete/:id
 * @param {string} id - Content ID
 */
router.delete('/delete/:id', authorize('admin'), async (req, res, next) => {
    const { id } = req.params;

    try {
        // Check content ownership or admin access before deleting
        const content = await Content.findById(id);
        if (!content) return res.status(404).json({ message: 'Content not found' });

        // Optionally, revoke the NFT if needed
        await FlowNFT.revokeNFT(content.nftId); // Assuming revokeNFT is implemented in FlowNFT

        // Remove content from MongoDB
        await Content.findByIdAndDelete(id);

        res.json({ message: 'Content deleted successfully' });
    } catch (error) {
        next(error);
    }
});

/**
 * License content and manage royalties
 * @route POST /content/license/:id
 * @param {string} id - Content ID
 * @param {number} royaltyPercentage - Percentage of royalties for the creator
 */
router.post('/license/:id', authorize('user'), async (req, res, next) => {
    const { id } = req.params;
    const { royaltyPercentage } = req.body;

    try {
        // License content using StoryIntegration contract
        const licenseResult = await StoryIntegration.licenseContent(id, req.user.address, royaltyPercentage);

        res.json({ message: 'Content licensed successfully', licenseResult });
    } catch (error) {
        next(error);
    }
});

/**
 * Get content by ID (cached)
 * @route GET /content/:id
 * @param {string} id - Content ID
 */
router.get('/content/:id', async (req, res, next) => {
    const { id } = req.params;

    try {
        // Check Redis cache first
        cache.get(id, async (err, data) => {
            if (data) return res.json(JSON.parse(data));

            const content = await Content.findById(id);
            if (!content) return res.status(404).json({ message: 'Content not found' });

            // Cache content in Redis
            cache.set(id, JSON.stringify(content));
            res.json(content);
        });
    } catch (error) {
        next(error);
    }
});

// Error handling middleware
router.use(errorHandler);

// Export the router
export default router;
