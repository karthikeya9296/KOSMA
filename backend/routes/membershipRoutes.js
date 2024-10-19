// membershipRoutes.js

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const Membership = require('../models/Membership'); // Assuming Mongoose model for Membership
const { validateToken, validateWalletOwnership } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const logger = require('../utils/logger');
const Redis = require('ioredis');

const redis = new Redis(); // Assuming Redis is running and connected for caching

// Rate Limiting
const standardRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: "Too many requests from this IP, please try again later.",
});

// Validation Schema
const purchaseSchema = Joi.object({
  walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  membershipType: Joi.string().valid('basic', 'premium', 'vip').required()
});

// Membership Purchase Route
router.post('/purchase', validateToken, validateWalletOwnership, standardRateLimiter, async (req, res) => {
  const { error } = purchaseSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { walletAddress, membershipType } = req.body;

  try {
    // Caching mechanism
    const cacheKey = `membership-${walletAddress}-${membershipType}`;
    const cachedMembership = await redis.get(cacheKey);

    if (cachedMembership) {
      return res.status(200).json({ message: 'Membership information retrieved from cache.', data: JSON.parse(cachedMembership) });
    }

    // Assume there's a smart contract interaction here using ethers.js
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const membershipContract = new ethers.Contract(process.env.UNLOCK_CONTRACT_ADDRESS, UnlockMembershipABI, wallet);

    // Purchase Membership on Blockchain
    const txn = await membershipContract.purchaseMembership(walletAddress, membershipType, {
      gasLimit: parseInt(process.env.GAS_LIMIT) || 500000,
    });

    // Wait for the transaction to be mined
    const receipt = await txn.wait();

    if (receipt.status === 1) {
      // Save to DB and Cache
      const membership = new Membership({
        walletAddress,
        membershipType,
        transactionHash: receipt.transactionHash,
      });

      await membership.save();
      await redis.setex(cacheKey, 3600, JSON.stringify(membership)); // Cache for 1 hour

      res.status(201).json({ message: 'Membership purchased successfully', data: membership });
    } else {
      throw new Error('Transaction failed');
    }
  } catch (error) {
    logger.error('Error purchasing membership:', error);
    res.status(500).json({ error: 'Error occurred while purchasing membership.' });
  }
});

// Subscription Management Routes
// Renew Membership
router.post('/renew', validateToken, standardRateLimiter, async (req, res) => {
  const { walletAddress, membershipType } = req.body;
  
  try {
    const membership = await Membership.findOne({ walletAddress, membershipType });

    if (!membership) {
      return res.status(404).json({ error: 'Membership not found.' });
    }

    // Blockchain renewal logic here
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const membershipContract = new ethers.Contract(process.env.UNLOCK_CONTRACT_ADDRESS, UnlockMembershipABI, wallet);

    const txn = await membershipContract.renewMembership(walletAddress, {
      gasLimit: parseInt(process.env.GAS_LIMIT) || 500000,
    });

    const receipt = await txn.wait();

    if (receipt.status === 1) {
      res.status(200).json({ message: 'Membership renewed successfully.' });
    } else {
      throw new Error('Transaction failed');
    }
  } catch (error) {
    logger.error('Error renewing membership:', error);
    res.status(500).json({ error: 'Error occurred while renewing membership.' });
  }
});

// Verify Membership Route
router.get('/verify/:walletAddress/:membershipType', validateToken, standardRateLimiter, async (req, res) => {
  const { walletAddress, membershipType } = req.params;

  try {
    // Check in cache first
    const cacheKey = `membership-${walletAddress}-${membershipType}`;
    const cachedStatus = await redis.get(cacheKey);

    if (cachedStatus) {
      return res.status(200).json({ message: 'Membership status retrieved from cache.', data: JSON.parse(cachedStatus) });
    }

    // Blockchain verification logic
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const membershipContract = new ethers.Contract(process.env.UNLOCK_CONTRACT_ADDRESS, UnlockMembershipABI, provider);

    const isMember = await membershipContract.isMember(walletAddress, membershipType);

    await redis.setex(cacheKey, 3600, JSON.stringify(isMember)); // Cache for 1 hour

    res.status(200).json({ walletAddress, membershipType, isMember });
  } catch (error) {
    logger.error('Error verifying membership:', error);
    res.status(500).json({ error: 'Error occurred while verifying membership.' });
  }
});

// Pagination for Memberships
router.get('/memberships', validateToken, async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  try {
    const memberships = await Membership.find()
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Membership.countDocuments();
    res.status(200).json({
      memberships,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    logger.error('Error fetching memberships:', error);
    res.status(500).json({ error: 'Error occurred while fetching memberships.' });
  }
});

// Global Error Handler Middleware
router.use((err, req, res, next) => {
  logger.error(err.message);
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = router;
