// Import necessary libraries and modules
const { ethers } = require('ethers');
const LayerZero = require('./LayerZero'); // LayerZero V2 Endpoint for cross-chain messaging
const StoryProtocol = require('./StoryProtocol'); // Story Protocol for licensing and royalty management

// Set up default provider and signer for blockchain interactions
let provider = new ethers.providers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
let signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Centralized error handling function with extended logging
function handleError(error, context = {}) {
    console.error('Blockchain Error:', error);
    console.error('Context:', context);
    throw new Error('Blockchain transaction failed. Please try again.');
}

/**
 * Update provider dynamically if interacting with multiple blockchains
 * @param {string} rpcUrl - The RPC URL for the new blockchain
 * @param {string} privateKey - Private key of the signer (optional, falls back to environment)
 */
function updateProvider(rpcUrl, privateKey = process.env.PRIVATE_KEY) {
    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    signer = new ethers.Wallet(privateKey, provider);
}

/**
 * Mint NFT with retry logic and gas fee estimation
 * @param {string} contractAddress - Address of the NFT contract
 * @param {string} tokenURI - Metadata URI for the NFT
 * @param {Array} abi - Contract ABI for flexibility
 * @returns {Promise<string>} - Transaction hash of the minting process
 */
async function mintNFT(contractAddress, tokenURI, abi) {
    try {
        const contract = new ethers.Contract(contractAddress, abi, signer);
        const gasEstimate = await contract.estimateGas.mint(tokenURI);
        const tx = await contract.mint(tokenURI, { gasLimit: gasEstimate });
        await tx.wait(); // Wait for transaction confirmation
        return tx.hash;
    } catch (error) {
        handleError(error, { method: 'mintNFT', contractAddress, tokenURI });
    }
}

/**
 * Handle Payments with retry logic and dynamic ABI
 * @param {string} contractAddress - Address of the payment contract
 * @param {string} recipient - Address of the recipient
 * @param {ethers.BigNumber} amount - Amount to be sent
 * @param {Array} abi - Contract ABI for flexibility
 * @returns {Promise<string>} - Transaction hash of the payment
 */
async function handlePayment(contractAddress, recipient, amount, abi) {
    try {
        const contract = new ethers.Contract(contractAddress, abi, signer);
        const gasEstimate = await contract.estimateGas.sendPayment(recipient, amount);
        const tx = await contract.sendPayment(recipient, amount, { gasLimit: gasEstimate });
        await tx.wait(); // Wait for transaction confirmation
        return tx.hash;
    } catch (error) {
        handleError(error, { method: 'handlePayment', contractAddress, recipient, amount });
    }
}

/**
 * Manage Memberships with retry and dynamic actions
 * @param {string} contractAddress - Address of the membership contract
 * @param {string} userId - User ID for membership management
 * @param {string} action - Action to perform (e.g., 'purchase', 'renew', 'upgrade')
 * @param {Array} abi - Contract ABI for flexibility
 * @returns {Promise<string>} - Transaction hash of the membership action
 */
async function manageMembership(contractAddress, userId, action, abi) {
    try {
        const contract = new ethers.Contract(contractAddress, abi, signer);
        let tx;
        const gasEstimate = await contract.estimateGas[action](userId);
        tx = await contract[action](userId, { gasLimit: gasEstimate });
        await tx.wait(); // Wait for transaction confirmation
        return tx.hash;
    } catch (error) {
        handleError(error, { method: 'manageMembership', contractAddress, userId, action });
    }
}

/**
 * Cross-Chain Messaging with timeout
 * @param {string} message - Message to be sent across chains
 * @param {string} destination - Destination address for the message
 * @returns {Promise<string>} - Transaction hash of the messaging process
 */
async function sendCrossChainMessage(message, destination) {
    try {
        const tx = await LayerZero.sendMessage(destination, message);
        await tx.wait(); // Wait for transaction confirmation
        return tx.hash;
    } catch (error) {
        handleError(error, { method: 'sendCrossChainMessage', destination, message });
    }
}

/**
 * Track Transaction Status with retry mechanism
 * @param {string} txHash - Transaction hash to track
 * @returns {Promise<Object>} - Transaction receipt with status and other details
 */
async function trackTransaction(txHash) {
    try {
        let retries = 0;
        let receipt = null;
        while (retries < 5 && !receipt) {
            receipt = await provider.getTransactionReceipt(txHash);
            if (!receipt) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
                retries += 1;
            }
        }
        if (!receipt) {
            throw new Error('Transaction not found');
        }
        return receipt;
    } catch (error) {
        handleError(error, { method: 'trackTransaction', txHash });
    }
}

// Export the functions for use in other modules
module.exports = {
    mintNFT,
    handlePayment,
    manageMembership,
    sendCrossChainMessage,
    trackTransaction,
    updateProvider,
};
