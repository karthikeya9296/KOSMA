// Import necessary libraries and modules
const { ethers } = require('ethers');
const CircleAPI = require('./CircleAPI'); // Circle API for USDC payments
const Superfluid = require('./Superfluid'); // Superfluid for streaming payments
const { ReentrancyGuard } = require('./middleware/reentrancyGuard'); // Middleware for reentrancy protection
const LedgerJS = require('ledger-js'); // LedgerJS for secure payment authorization
const User = require('./models/User'); // User model to fetch user data

// Set up provider for blockchain interactions
const provider = new ethers.providers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

/**
 * Enhanced Error Handling Function
 */
function handleError(error, context = {}) {
    console.error('Payment Service Error:', error);
    console.error('Context:', context);
    throw new Error('Payment operation failed. Please try again.');
}

/**
 * Deposit USDC
 * @param {string} userId - ID of the user making the deposit
 * @param {number} amount - Amount of USDC to deposit
 * @returns {Promise<string>} - Transaction hash of the deposit
 */
async function depositUSDC(userId, amount) {
    try {
        const user = await User.findById(userId);
        const tx = await CircleAPI.deposit(user.blockchainAddress, amount);
        return tx;
    } catch (error) {
        handleError(error, { method: 'depositUSDC', userId, amount });
    }
}

/**
 * Approve USDC for a specific contract
 * @param {string} contractAddress - Address of the contract to approve
 * @param {number} amount - Amount of USDC to approve
 * @returns {Promise<string>} - Transaction hash of the approval
 */
async function approveUSDC(contractAddress, amount) {
    try {
        const gasEstimate = await CircleAPI.estimateGas.approve(contractAddress, amount);
        const tx = await CircleAPI.approve(contractAddress, amount, { gasLimit: gasEstimate });
        return tx;
    } catch (error) {
        handleError(error, { method: 'approveUSDC', contractAddress, amount });
    }
}

/**
 * Transfer USDC to another user with Ledger support
 * @param {string} recipient - Address of the recipient
 * @param {number} amount - Amount of USDC to transfer
 * @param {boolean} useLedger - Flag to use Ledger for secure authorization
 * @returns {Promise<string>} - Transaction hash of the transfer
 */
async function transferUSDC(recipient, amount, useLedger = false) {
    try {
        let tx;
        if (useLedger) {
            const ledger = new LedgerJS();
            tx = await ledger.signAndSendPayment(recipient, amount);
        } else {
            tx = await CircleAPI.transfer(recipient, amount);
        }
        return tx;
    } catch (error) {
        handleError(error, { method: 'transferUSDC', recipient, amount });
    }
}

/**
 * Start Streaming Payment with retry logic
 * @param {string} recipient - Address of the recipient
 * @param {number} amountPerSecond - Amount of USDC to stream per second
 * @returns {Promise<string>} - Transaction hash of the streaming setup
 */
async function startStreamingPayment(recipient, amountPerSecond) {
    try {
        let retries = 0;
        let tx = null;
        while (!tx && retries < 3) {
            try {
                tx = await Superfluid.createStream(recipient, amountPerSecond);
            } catch (err) {
                retries += 1;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Retry after 1 second
            }
        }
        if (!tx) {
            throw new Error('Streaming payment setup failed after 3 retries.');
        }
        return tx;
    } catch (error) {
        handleError(error, { method: 'startStreamingPayment', recipient, amountPerSecond });
    }
}

/**
 * Cancel Streaming Payment
 * @param {string} streamId - ID of the stream to cancel
 * @returns {Promise<string>} - Transaction hash of the stream cancellation
 */
async function cancelStreamingPayment(streamId) {
    try {
        const tx = await Superfluid.cancelStream(streamId);
        return tx;
    } catch (error) {
        handleError(error, { method: 'cancelStreamingPayment', streamId });
    }
}

/**
 * Process Refund with extended handling for blockchain interactions
 * @param {string} transactionId - ID of the transaction to refund
 * @returns {Promise<string>} - Transaction hash of the refund
 */
async function processRefund(transactionId) {
    try {
        const tx = await CircleAPI.refund(transactionId);
        return tx;
    } catch (error) {
        handleError(error, { method: 'processRefund', transactionId });
    }
}

// Export the functions for use in other modules
module.exports = {
    depositUSDC,
    approveUSDC,
    transferUSDC,
    startStreamingPayment,
    cancelStreamingPayment,
    processRefund,
};
