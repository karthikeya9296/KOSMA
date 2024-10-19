// Import necessary libraries and modules
const express = require('express');
const { Circle } = require('circle-sdk'); // Circle API for USDC payments
const { SuperfluidSDK } = require('@superfluid-finance/sdk-core'); // Superfluid SDK for streaming payments
const LedgerJS = require('ledger-js'); // LedgerJS for secure payment authorization
const speakeasy = require('speakeasy'); // 2FA
const redis = require('redis'); // Redis for caching
const rateLimit = require('express-rate-limit'); // Rate limiting
const User = require('./models/User'); // MongoDB model for users
const Payment = require('./models/Payment'); // MongoDB model for payment records
const { authenticateUser } = require('./middleware/auth'); // Middleware for user authentication

const router = express.Router();
const redisClient = redis.createClient();

// Rate limiter to avoid API abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests, please try again later.',
});

// Use rate limiting for all payment routes
router.use(apiLimiter);

// Middleware to validate payment amounts
const validateAmount = (req, res, next) => {
    const { amount } = req.body;
    if (amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
    }
    next();
};

// Check if user has sufficient balance
const checkBalance = async (userId, amount) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    if (user.balance < amount) {
        throw new Error('Insufficient funds');
    }
};

// Cache transaction result for performance optimization
const cacheTransaction = (transactionId, transactionData) => {
    redisClient.setex(transactionId, 3600, JSON.stringify(transactionData)); // Cache for 1 hour
};

const getCachedTransaction = async (transactionId) => {
    return new Promise((resolve, reject) => {
        redisClient.get(transactionId, (err, data) => {
            if (err) reject(err);
            resolve(data ? JSON.parse(data) : null);
        });
    });
};

// Custom error classes
class PaymentError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PaymentError';
    }
}

class AuthorizationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthorizationError';
    }
}

class InsufficientFundsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InsufficientFundsError';
    }
}

// Rollback transaction in case of failure
const rollbackTransaction = async (paymentRecord) => {
    try {
        // Reverse transaction in Circle API (if supported)
        await Circle.reverseTransaction(paymentRecord.transactionId);

        // Update payment record to reflect failed status
        paymentRecord.status = 'failed';
        await paymentRecord.save();
    } catch (err) {
        console.error('Error rolling back transaction:', err);
    }
};

/**
 * Deposit Funds
 * @route POST /payment/deposit
 * @param {string} userId - User ID
 * @param {number} amount - Amount in USDC to deposit
 */
router.post('/deposit', authenticateUser, validateAmount, async (req, res) => {
    const { userId, amount } = req.body;

    try {
        const transactionId = await Circle.getPendingTransactionId(userId);

        // Check if transaction is cached
        const cachedTransaction = await getCachedTransaction(transactionId);
        if (cachedTransaction) {
            return res.json({ message: 'Transaction retrieved from cache', transaction: cachedTransaction });
        }

        // Process deposit via Circle API
        const transaction = await Circle.deposit(userId, amount);
        cacheTransaction(transaction.id, transaction);

        // Record payment in the database
        const paymentRecord = new Payment({
            userId,
            amount,
            type: 'deposit',
            transactionId: transaction.id,
            status: 'pending',
            createdAt: new Date(),
        });
        await paymentRecord.save();

        res.status(201).json({ message: 'Funds deposited successfully', transaction });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error depositing funds', error: error.message });
    }
});

/**
 * Purchase Content
 * @route POST /payment/purchase
 * @param {string} userId - User ID
 * @param {string} contentId - Content ID
 * @param {number} amount - Amount in USDC
 * @param {string} token - 2FA token
 */
router.post('/purchase', authenticateUser, validateAmount, async (req, res) => {
    const { userId, contentId, amount, token } = req.body;

    try {
        // Check balance
        await checkBalance(userId, amount);

        // Verify 2FA token
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token,
        });

        if (!verified) return res.status(403).json({ message: 'Invalid 2FA token' });

        // Authorize payment with LedgerJS
        const isAuthorized = await LedgerJS.authorizePayment(userId, amount);
        if (!isAuthorized) return res.status(403).json({ message: 'Payment authorization failed' });

        // Process purchase via Circle API
        const transaction = await Circle.purchase(userId, contentId, amount);

        // Record payment in the database
        const paymentRecord = new Payment({
            userId,
            contentId,
            amount,
            type: 'purchase',
            transactionId: transaction.id,
            status: 'completed',
            createdAt: new Date(),
        });
        await paymentRecord.save();

        res.status(201).json({ message: 'Content purchased successfully', transaction });
    } catch (error) {
        console.error('Error processing purchase', error);
        await rollbackTransaction(paymentRecord);
        res.status(500).json({ message: 'Error processing purchase, transaction rolled back', error: error.message });
    }
});

/**
 * Tip Content Creator
 * @route POST /payment/tip
 * @param {string} userId - User ID
 * @param {string} creatorId - Creator's User ID
 * @param {number} amount - Amount in USDC to tip
 */
router.post('/tip', authenticateUser, validateAmount, async (req, res) => {
    const { userId, creatorId, amount } = req.body;

    try {
        // Check balance
        await checkBalance(userId, amount);

        // Authorize payment with LedgerJS
        const isAuthorized = await LedgerJS.authorizePayment(userId, amount);
        if (!isAuthorized) return res.status(403).json({ message: 'Payment authorization failed' });

        // Process tip via Circle API
        const transaction = await Circle.tip(userId, creatorId, amount);

        // Record payment in the database
        const paymentRecord = new Payment({
            userId,
            creatorId,
            amount,
            type: 'tip',
            transactionId: transaction.id,
            createdAt: new Date(),
        });
        await paymentRecord.save();

        res.status(201).json({ message: 'Tip sent successfully', transaction });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error sending tip', error: error.message });
    }
});

/**
 * Batch Tipping
 * @route POST /payment/batchTip
 * @param {string} userId - User ID
 * @param {Array} tips - Array of { creatorId, amount }
 */
router.post('/batchTip', authenticateUser, async (req, res) => {
    const { userId, tips } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        let totalAmount = 0;
        tips.forEach(tip => totalAmount += tip.amount);

        // Check if the user has sufficient balance
        await checkBalance(userId, totalAmount);

        // Process tips in batch
        const transactions = [];
        for (const tip of tips) {
            const transaction = await Circle.tip(userId, tip.creatorId, tip.amount);
            transactions.push(transaction);

            // Record each tip in the database
            const paymentRecord = new Payment({
                userId,
                creatorId: tip.creatorId,
                amount: tip.amount,
                type: 'tip',
                transactionId: transaction.id,
                createdAt: new Date(),
            });
            await paymentRecord.save();
        }

        res.status(201).json({ message: 'Tips sent successfully', transactions });
    } catch (error) {
        console.error('Error processing batch tip', error);
        res.status(500).json({ message: 'Error processing batch tip', error: error.message });
    }
});

/**
 * Set Up Streaming Payments
 * @route POST /payment/stream
 * @param {string} userId - User ID
 * @param {string} creatorId - Creator's User ID
 * @param {number} flowRate - Flow rate for streaming payments
 */
router.post('/stream', authenticateUser, async (req, res) => {
    const { userId, creatorId, flowRate } = req.body;

    try {
        // Initialize Superfluid framework
        const sf = new SuperfluidSDK.Framework();
        await sf.initialize();

        // Load user account
        const user = await User.findById(userId);
        const creator = await User.findById(creatorId);
        if (!user || !creator) return res.status(404).json({ message: 'User or creator not found' });

        // Set up streaming payment
        const createFlowOperation = sf.cfa.createFlow({
            sender: user.walletAddress,
            receiver: creator.walletAddress,
            flowRate, // Flow rate in USDC per second
            superToken: sf.tokens.usdcx.address
        });

        // Execute the transaction on-chain
        await createFlowOperation.exec(user.signer);

        res.status(201).json({ message: 'Streaming payment set up successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error setting up streaming payment', error: error.message });
    }
});

// Webhook handling for Circle payment updates
router.post('/payment/webhook', async (req, res) => {
    try {
        const event = req.body;

        if (event.type === 'payment_completed') {
            const { transactionId, userId, amount } = event.data;

            // Update payment record in the database
            await Payment.updateOne({ transactionId }, { status: 'completed' });

            // Update user's balance in the database
            const user = await User.findById(userId);
            user.balance += amount;
            await user.save();

            return res.status(200).json({ message: 'Payment completed' });
        }

        res.status(200).json({ message: 'Webhook received' });
    } catch (error) {
        console.error('Error processing webhook', error);
        res.status(500).json({ message: 'Error processing webhook', error: error.message });
    }
});

// Use the error handler middleware
router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

module.exports = router;
