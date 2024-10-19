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
};
