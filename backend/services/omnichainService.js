// Import necessary libraries and modules
const { ethers } = require('ethers');
const LayerZero = require('./LayerZero'); // LayerZero for omnichain messaging
const NFTContract = require('./NFTContract'); // NFT contract for handling NFT operations
const User = require('./models/User'); // User model to fetch user data

// Set up provider for blockchain interactions
const provider = new ethers.providers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

/**
 * Send Cross-Chain Message with retry logic and gas fee estimation
 * @param {string} targetChain - The target blockchain to send the message to
 * @param {string} message - The message to send
 * @returns {Promise<string>} - Transaction hash of the message sending
 */
async function sendCrossChainMessage(targetChain, message) {
    try {
        // Estimate gas fee for sending message
        const gasEstimate = await LayerZero.estimateGas.sendMessage(targetChain, message);

        let retries = 0;
        let tx = null;
        while (!tx && retries < 3) {
            try {
                tx = await LayerZero.sendMessage(targetChain, message, { gasLimit: gasEstimate });
                await tx.wait(); // Wait for transaction confirmation
            } catch (error) {
                retries += 1;
                console.error(`Retry ${retries}: Error sending cross-chain message`, error);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Retry after 1 second
            }
        }

        if (!tx) {
            throw new Error('Cross-chain message sending failed after 3 retries');
        }

        return tx.hash;
    } catch (error) {
        console.error('Error sending cross-chain message:', error);
        throw new Error('Cross-chain message sending failed');
    }
}

/**
 * Receive Cross-Chain Message with optional encryption and real-time event listener
 * @param {string} sourceChain - The source blockchain from which the message is received
 * @param {string} message - The message received
 * @returns {Promise<void>}
 */
async function receiveCrossChainMessage(sourceChain, message) {
    try {
        // Decrypt the message if encryption is applied (optional)
        // const decryptedMessage = decryptMessage(message);

        console.log(`Received message from ${sourceChain}:`, message);
        // Add logic to handle the message based on its content, e.g., process NFT transfers, licenses, etc.

        // Optionally trigger event listeners to notify the system or users in real-time
    } catch (error) {
        console.error('Error receiving cross-chain message:', error);
        throw new Error('Cross-chain message receiving failed');
    }
}

/**
 * Verify Received Message with nonce management
 * @param {string} message - The message to verify
 * @param {number} nonce - The nonce to prevent replay attacks
 * @returns {Promise<boolean>} - True if the message is valid, false otherwise
 */
async function verifyMessage(message, nonce) {
    try {
        const isValid = await LayerZero.verifyMessage(message, nonce);
        return isValid;
    } catch (error) {
        console.error('Error verifying message:', error);
        throw new Error('Message verification failed');
    }
}

/**
 * Transfer NFT Cross-Chain with gas estimation and batch processing
 * @param {string} nftId - ID of the NFT to transfer
 * @param {string} targetChain - The target blockchain to transfer the NFT to
 * @returns {Promise<string>} - Transaction hash of the NFT transfer
 */
async function transferNFTCrossChain(nftId, targetChain) {
    try {
        const user = await User.findOne({ blockchainAddress: signer.address });
        if (!user) throw new Error('User not found');

        // Estimate gas fees for locking and minting
        const gasLock = await NFTContract.estimateGas.lockNFT(nftId, user.blockchainAddress);
        const gasMint = await LayerZero.estimateGas.mintNFT(nftId, targetChain, user.blockchainAddress);

        // Lock the NFT on the source chain
        const txLock = await NFTContract.lockNFT(nftId, user.blockchainAddress, { gasLimit: gasLock });
        await txLock.wait(); // Wait for transaction confirmation

        // Mint the NFT on the target chain
        const txMint = await LayerZero.mintNFT(nftId, targetChain, user.blockchainAddress, { gasLimit: gasMint });
        await txMint.wait(); // Wait for transaction confirmation

        return txMint.hash;
    } catch (error) {
        console.error('Error transferring NFT cross-chain:', error);
        throw new Error('NFT cross-chain transfer failed');
    }
}

// Export the functions for use in other modules
module.exports = {
    sendCrossChainMessage,
    receiveCrossChainMessage,
    verifyMessage,
    transferNFTCrossChain,
=======
const { ethers } = require('ethers');
const LayerZeroEndpoint = require('@layerzerolabs/LayerZeroEndpoint');

// Load your compiled LayerZeroMessaging.sol contract ABI and address
const LayerZeroMessagingABI = require('./abi/LayerZeroMessaging.json');
const contractAddress = "YOUR_CONTRACT_ADDRESS"; // Deployed LayerZeroMessaging.sol contract address

// Load provider and signer (Wallet)
const provider = new ethers.providers.JsonRpcProvider("RPC_PROVIDER_URL"); // RPC provider (Infura, Alchemy, etc.)
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider); // Replace with your private key

// Create contract instance
const layerZeroMessagingContract = new ethers.Contract(contractAddress, LayerZeroMessagingABI, signer);

// LayerZero Endpoint address and SDK initialization
const endpointAddress = 'LAYERZERO_ENDPOINT_ADDRESS'; // Replace with actual LayerZero endpoint address
const layerZeroEndpoint = new LayerZeroEndpoint(endpointAddress);

// Event listener for cross-chain events
const eventEmitter = layerZeroMessagingContract.connect(provider);

// Dynamic rate-limiting mechanism
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
            layerZeroMessagingContract.initiateTransfer(destChainId, to, tokenId, gasFee, { value: gasFee })
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
        const isAdmin = await layerZeroMessagingContract.hasRole(ethers.utils.id('ADMIN_ROLE'), recoveredSigner);

        if (!isAdmin) throw new Error("Unauthorized signer for the message");

        // Decode the payload
        const { owner, to, tokenId } = ethers.utils.defaultAbiCoder.decode(['address', 'address', 'uint256'], payload);

        // Validate the decoded data
        if (!ethers.utils.isAddress(to)) throw new Error('Invalid recipient address.');
        if (!Number.isInteger(tokenId) || tokenId <= 0) throw new Error('Invalid token ID.');

        // Process the cross-chain message and mint the NFT on the new chain
        const tx = await layerZeroMessagingContract.lzReceive(srcChainId, payload, signature);
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
        eventEmitter.on("TransferInitiated", async (from, to, tokenId, destChainId) => {
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

        eventEmitter.on("TransferCompleted", async (owner, tokenId, srcChainId) => {
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

        eventEmitter.on("FailedTransfer", async (owner, tokenId, srcChainId, reason) => {
            try {
                console.error({
                    event: 'FailedTransfer',
                    owner,
                    tokenId,
                    srcChainId,
                    reason,
                    timestamp: new Date().toISOString(),
                });
            } catch (error) {
                console.error(`Error handling FailedTransfer event: ${error.message}`);
            }
        });
    } catch (error) {
        console.error(`Error monitoring contract events: ${error.message}`);
        throw error;
    }
}

// Verify Cross-Chain Messages (Authenticity check)
async function verifyMessage(message, signature) {
    try {
        const recoveredSigner = ethers.utils.verifyMessage(message, signature);
        const isAdmin = await layerZeroMessagingContract.hasRole(ethers.utils.id('ADMIN_ROLE'), recoveredSigner);
        if (!isAdmin) throw new Error('Message verification failed: unauthorized signer');
        return isAdmin;
    } catch (error) {
        console.error(`Message verification failed: ${error.message}`);
        return false;
    }
}

// Start the omnichain service
async function startService() {
    console.log("Starting Omnichain Service for cross-chain messaging and NFT transfers...");
    await monitorEvents();
}

// Export functions
module.exports = {
    initiateNFTTransfer,
    lzReceive,
    verifyMessage,
    startService,
>>>>>>> origin/main
};
