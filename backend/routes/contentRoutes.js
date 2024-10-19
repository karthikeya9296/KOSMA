// Import necessary libraries and modules
const express = require('express');
const { body, validationResult } = require('express-validator');
const Content = require('./models/Content'); // MongoDB model for content metadata
const SignProtocol = require('./SignProtocol'); // Import Sign Protocol for ownership verification
const StoryProtocol = require('./StoryProtocol'); // Import Story Protocol for content metadata and licensing
const { encryptMetadata } = require('./encryption'); // Import encryption utility
const rateLimit = require('express-rate-limit');
const redis = require('redis');
const client = redis.createClient();

const router = express.Router();

// Rate limiter to prevent abuse
const createContentLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // limit each IP to 100 requests per window
    message: 'Too many content creation requests, please try again later.'
});

// Validation middleware
const validateContentCreation = [
    body('title').isString().notEmpty().withMessage('Title is required and must be a string'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('owner').isString().notEmpty().withMessage('Owner address is required'),
    body('metadata').isObject().withMessage('Metadata should be an object'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// Middleware to verify ownership
const verifyOwnership = async (req, res, next) => {
    try {
        const content = await Content.findById(req.params.id);
        if (!content) {
            return res.status(404).json({ message: 'Content not found' });
        }
        const isOwner = await SignProtocol.verifyOwnership(content.owner, req.user.address);
        if (!isOwner) {
            return res.status(403).json({ message: 'Not authorized to modify this content' });
        }
        req.content = content;  // Store content in request object for further use
        next();
    } catch (error) {
        next(error);
    }
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'production' ? {} : err
    });
};

// Create new content
router.post('/v1/content/create', createContentLimiter, validateContentCreation, async (req, res, next) => {
    const { title, description, owner, metadata } = req.body;

    try {
        // Encrypt metadata before saving
        const encryptedMetadata = await encryptMetadata(metadata);

        // Create new content entry
        const newContent = new Content({
            title,
            description,
            owner,
            metadata: encryptedMetadata,
            createdAt: new Date(),
        });

        await newContent.save();
        res.status(201).json({ message: 'Content created successfully', content: newContent });
    } catch (error) {
        next(error);
    }
});

// Update existing content
router.put('/v1/content/update/:id', verifyOwnership, async (req, res, next) => {
    const { title, description, metadata } = req.body;

    try {
        // Encrypt new metadata
        const encryptedMetadata = await encryptMetadata(metadata);

        // Update content
        const content = req.content;
        content.title = title;
        content.description = description;
        content.metadata = encryptedMetadata;
        await content.save();

        res.json({ message: 'Content updated successfully', content });
    } catch (error) {
        next(error);
    }
});

// Delete content
router.delete('/v1/content/delete/:id', verifyOwnership, async (req, res, next) => {
    try {
        const content = req.content;

        // Revoke licensing using Story Protocol
        try {
            await StoryProtocol.revokeLicense(content.id); // Assuming revokeLicense is implemented
        } catch (error) {
            console.error('Failed to revoke license:', error); // Log error if revocation fails
        }

        // Delete content from database
        await Content.findByIdAndDelete(content._id);
        res.json({ message: 'Content deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// Fetch content with caching and pagination
router.get('/v1/content/fetch', async (req, res, next) => {
    const { tag, category, page = 1, limit = 10 } = req.query;
    const cacheKey = `content:${tag || ''}:${category || ''}:${page}:${limit}`;

    // Check Redis cache first
    client.get(cacheKey, async (err, cachedData) => {
        if (err) return next(err);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        try {
            const query = {};
            if (tag) query.tag = tag;
            if (category) query.category = category;

            const contents = await Content.find(query)
                .skip((page - 1) * limit)
                .limit(parseInt(limit));

            // Store result in Redis cache
            client.setex(cacheKey, 3600, JSON.stringify(contents)); // Cache for 1 hour
            res.json(contents);
        } catch (error) {
            next(error);
        }
    });
});

// Use the error handler middleware
router.use(errorHandler);

module.exports = router;
