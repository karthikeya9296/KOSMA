// Import necessary libraries and modules
const { ethers } = require('ethers');
const express = require('express');
const jwt = require('jsonwebtoken'); // For user authentication
const LayerZero = require('./LayerZero'); // LayerZero for omnichain messaging
const NFTContract = require('./NFTContract'); // NFT contract for handling NFT operations
const User = require('./models/User'); // User model to fetch user data

// Set up provider for blockchain interactions
const provider = new ethers.providers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Initialize Express app for UI and API
const app = express();
app.use(express.json());

// JWT Secret for Authentication
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Rate limiting configuration
const transferRequestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 60 seconds
const MAX_REQUESTS_PER_WINDOW = 5; // Max requests per minute

function rateLimitCheck(address) {
    const now = Date.now();
    if (!transferRequestCounts.has(address)) {
        transferRequestCounts.set(address, []);
    }

    const timestamps = transferRequestCounts.get(address).filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
        throw new Error('Rate limit exceeded. Try again later.');
    }

    timestamps.push(now);
    transferRequestCounts.set(address, timestamps);
}

// Retry logic with exponential backoff
async function retryTransaction(txFunction, maxRetries = 3, delay = 2000) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            return await txFunction();
        } catch (error) {
            attempts++;
            if (attempts === maxRetries) throw new Error(`Transaction failed after ${attempts} attempts: ${error.message}`);
            console.log(`Retry attempt ${attempts}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Middleware for user authentication
function authenticateToken(req, res, next) {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Initiate Cross-Chain NFT Transfer
async function initiateNFTTransfer(destChainId, to, tokenId, maxGasFee) {
    try {
        rateLimitCheck(signer.address);

        // Validate gas fee input
        if (!ethers.utils.isHexString(maxGasFee)) {
            throw new Error('Invalid gas fee value.');
        }

        const gasFee = ethers.utils.parseEther(maxGasFee.toString()); // Ensure BigNumber precision for gas fee

        const tx = await retryTransaction(() =>
            NFTContract.initiateTransfer(destChainId, to, tokenId, gasFee, { value: gasFee })
        );

        console.log(`NFT transfer initiated. Transaction hash: ${tx.hash}`);
        await tx.wait(); // Wait for the transaction to complete
        console.log('NFT transfer completed.');
        return tx;
    } catch (error) {
        console.error(`Error initiating NFT transfer: ${error.message}`);
        throw error;
    }
}

// Handle receiving cross-chain messages
async function lzReceive(srcChainId, payload, signature) {
    try {
        // Verify the signature
        const recoveredSigner = ethers.utils.verifyMessage(payload, signature);
        const isAdmin = await NFTContract.hasRole(ethers.utils.id('ADMIN_ROLE'), recoveredSigner);

        if (!isAdmin) throw new Error("Unauthorized signer for the message");

        // Decode the payload
        const { owner, to, tokenId } = ethers.utils.defaultAbiCoder.decode(['address', 'address', 'uint256'], payload);

        // Validate the decoded data
        if (!ethers.utils.isAddress(to)) throw new Error('Invalid recipient address.');
        if (!Number.isInteger(tokenId) || tokenId <= 0) throw new Error('Invalid token ID.');

        // Process the cross-chain message and mint the NFT on the new chain
        const tx = await NFTContract.lzReceive(srcChainId, payload, signature);
        await tx.wait(); // Wait for the transaction to complete
        console.log(`Cross-chain NFT transfer completed for token ${tokenId}`);
        return tx;
    } catch (error) {
        console.error(`Error processing cross-chain message: ${error.message}`);
        throw error;
    }
}

// Monitor contract events for cross-chain messaging
async function monitorEvents() {
    try {
        NFTContract.on("TransferInitiated", async (from, to, tokenId, destChainId) => {
            try {
                console.log({
                    event: 'TransferInitiated',
                    from,
                    to,
                    tokenId,
                    destChainId,
                    timestamp: new Date().toISOString(),
                });
            } catch (error) {
                console.error(`Error handling TransferInitiated event: ${error.message}`);
            }
        });

        NFTContract.on("TransferCompleted", async (owner, tokenId, srcChainId) => {
            try {
                console.log({
                    event: 'TransferCompleted',
                    owner,
                    tokenId,
                    srcChainId,
                    timestamp: new Date().toISOString(),
                });
            } catch (error) {
                console.error(`Error handling TransferCompleted event: ${error.message}`);
            }
        });
    } catch (error) {
        console.error(`Error monitoring contract events: ${error.message}`);
        throw error;
    }
}

// API endpoints for consumer-facing UI
app.post('/api/transfer-nft', authenticateToken, async (req, res) => {
    try {
        const { destChainId, to, tokenId, maxGasFee } = req.body;
        const tx = await initiateNFTTransfer(destChainId, to, tokenId, maxGasFee);
        res.json({ transactionHash: tx.hash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/receive-message', authenticateToken, async (req, res) => {
    try {
        const { srcChainId, payload, signature } = req.body;
        const tx = await lzReceive(srcChainId, payload, signature);
        res.json({ transactionHash: tx.hash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve static files (e.g., React frontend)
app.use(express.static('public'));

// User login endpoint (for generating JWT)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    // Here you should verify the username and password with your user database
    const user = await User.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    monitorEvents();
});

// Export functions for testing and external use
module.exports = {
    initiateNFTTransfer,
    lzReceive,
    rateLimitCheck,
    retryTransaction,
    monitorEvents,
};
