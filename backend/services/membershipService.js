// Import necessary packages
const express = require("express");
const { ethers } = require("ethers");
const redis = require("redis");

// Initialize Redis client with connection error handling
const redisClient = redis.createClient();
redisClient.on("error", (err) => console.error("Redis connection error:", err));
redisClient.connect();

// ABI and environment variables
const contractABI = require("./abi/UnlockMemberships.json");
const { UNLOCK_CONTRACT_ADDRESS, INFURA_URL, PRIVATE_KEY, PORT = 3000 } = process.env;

// Initialize Ethers.js provider, signer, and contract instance
const provider = new ethers.JsonRpcProvider(INFURA_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(UNLOCK_CONTRACT_ADDRESS, contractABI, wallet);

// Helper functions for Redis caching
const getCache = async (key) => {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
};

const setCache = async (key, value, ttl = 3600) => {
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttl });
  } catch (error) {
    console.error("Redis set error:", error);
  }
};

// Membership service methods
const membershipService = {
  /**
   * @dev Handle membership purchase.
   */
  purchaseMembership: async (userAddress, membershipType, amount) => {
    if (!userAddress || !membershipType || !amount) {
      throw new Error("Invalid input parameters.");
    }
    try {
      const tx = await contract.purchaseMembership(userAddress, membershipType, {
        value: ethers.parseEther(amount.toString()),
      });
      await tx.wait();
      console.log(`Membership purchased: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      console.error("Error purchasing membership:", error);
      throw new Error("Membership purchase failed.");
    }
  },

  /**
   * @dev Verify if the user has a valid membership.
   */
  verifyMembership: async (userAddress) => {
    if (!userAddress) {
      throw new Error("User address is required.");
    }
    try {
      const cacheKey = `membership:${userAddress}`;
      const cachedStatus = await getCache(cacheKey);
      if (cachedStatus !== null) return cachedStatus;

      const hasMembership = await contract.isMember(userAddress);
      await setCache(cacheKey, hasMembership);
      return hasMembership;
    } catch (error) {
      console.error("Error verifying membership:", error);
      throw new Error("Membership verification failed.");
    }
  },

  /**
   * @dev Renew membership.
   */
  renewMembership: async (userAddress, amount) => {
    if (!userAddress || !amount) {
      throw new Error("Invalid input parameters.");
    }
    try {
      const tx = await contract.renewMembership(userAddress, {
        value: ethers.parseEther(amount.toString()),
      });
      await tx.wait();
      console.log(`Membership renewed: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      console.error("Error renewing membership:", error);
      throw new Error("Membership renewal failed.");
    }
  },

  /**
   * @dev Verify user access to premium content.
   */
  verifyAccess: async (userAddress, contentId) => {
    if (!userAddress || !contentId) {
      throw new Error("Invalid input parameters.");
    }
    try {
      const cacheKey = `access:${userAddress}:${contentId}`;
      const cachedAccess = await getCache(cacheKey);
      if (cachedAccess !== null) return cachedAccess;

      const hasAccess = await contract.hasAccess(userAddress, contentId);
      await setCache(cacheKey, hasAccess);
      return hasAccess;
    } catch (error) {
      console.error("Error verifying access:", error);
      throw new Error("Access verification failed.");
    }
  },
};

// Express server setup
const app = express();
app.use(express.json());

// Route to purchase membership
app.post("/membership/purchase", async (req, res) => {
  const { userAddress, membershipType, amount } = req.body;
  try {
    const txHash = await membershipService.purchaseMembership(userAddress, membershipType, amount);
    res.json({ success: true, txHash });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Route to verify membership
app.get("/membership/verify/:userAddress", async (req, res) => {
  const { userAddress } = req.params;
  try {
    const hasMembership = await membershipService.verifyMembership(userAddress);
    res.json({ success: true, hasMembership });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Route to renew membership
app.post("/membership/renew", async (req, res) => {
  const { userAddress, amount } = req.body;
  try {
    const txHash = await membershipService.renewMembership(userAddress, amount);
    res.json({ success: true, txHash });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Route to verify access to premium content
app.get("/membership/access/:userAddress/:contentId", async (req, res) => {
  const { userAddress, contentId } = req.params;
  try {
    const hasAccess = await membershipService.verifyAccess(userAddress, contentId);
    res.json({ success: true, hasAccess });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = membershipService;
