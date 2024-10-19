// Import necessary libraries and modules
const express = require('express');
const LayerZero = require('./LayerZero'); // LayerZero V2 for cross-chain messaging and asset transfer
const { encryptMessage, decryptMessage } = require('./encryption'); // Encryption utility with Lit Protocol
const { authenticateUser } = require('./middleware/auth'); // Middleware for user authentication
const Message = require('./models/Message'); // MongoDB model for messages
const NFT = require('./models/NFT'); // MongoDB model for NFTs
const rateLimit = require('express-rate-limit'); // Rate limiting for security
const DecentralizedOracle = require('./DecentralizedOracle'); // Oracle service for data verification

const router = express.Router();

// Rate limiting to prevent abuse of omnichain features
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.',
});

router.use(apiLimiter);

/**
 * Send Cross-Chain Message
 * @route POST /omnichain/send-message
 * @param {string} recipientAddress - Address of the recipient on the target blockchain
 * @param {string} messageContent - Content of the message to send
 * @param {string} targetChain - The blockchain to send the message to
 */
router.post('/send-message', authenticateUser, async (req, res) => {
    const { recipientAddress, messageContent, targetChain } = req.body;

    try {
        // Encrypt the message using Lit Protocol
        const encryptedMessage = encryptMessage(messageContent);

        // Verify the recipient address and target chain using a decentralized oracle
        const isValidRecipient = await DecentralizedOracle.verifyAddress(recipientAddress, targetChain);
        if (!isValidRecipient) {
            return res.status(400).json({ message: 'Invalid recipient address or target chain' });
        }

        // Send the message using LayerZero V2
        const transaction = await LayerZero.sendMessage(recipientAddress, encryptedMessage, targetChain);

        // Save the message record in the database
        const messageRecord = new Message({
            sender: req.user.id,
            recipient: recipientAddress,
            content: encryptedMessage,
            targetChain,
            transactionId: transaction.id,
            createdAt: new Date(),
        });
        await messageRecord.save();

        res.status(201).json({ message: 'Message sent successfully', transaction });
    } catch (error) {
        console.error('Error sending cross-chain message:', error);
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
});

/**
 * NFT Cross-Chain Transfer
 * @route POST /omnichain/transfer-nft
 * @param {string} nftId - ID of the NFT to transfer
 * @param {string} recipientAddress - Address to transfer the NFT to on the target blockchain
 * @param {string} targetChain - The blockchain to transfer the NFT to
 */
router.post('/transfer-nft', authenticateUser, async (req, res) => {
    const { nftId, recipientAddress, targetChain } = req.body;

    try {
        // Fetch NFT details from the database
        const nft = await NFT.findById(nftId);
        if (!nft) {
            return res.status(404).json({ message: 'NFT not found' });
        }

        // Validate recipient address and target chain using decentralized oracle services
        const isValidTransfer = await DecentralizedOracle.verifyAddress(recipientAddress, targetChain);
        if (!isValidTransfer) {
            return res.status(400).json({ message: 'Invalid recipient address or target chain' });
        }

        // Transfer the NFT using LayerZero V2 for cross-chain interaction
        const transaction = await LayerZero.transferNFT(nft.tokenId, recipientAddress, targetChain);

        res.status(201).json({ message: 'NFT transferred successfully', transaction });
    } catch (error) {
        console.error('Error transferring NFT cross-chain:', error);
        res.status(500).json({ message: 'Error transferring NFT', error: error.message });
    }
});

/**
 * Receive Cross-Chain Messages
 * @route POST /omnichain/receive-message
 * This endpoint is called by LayerZero V2 when a message is received.
 */
router.post('/receive-message', async (req, res) => {
    const { sender, encryptedMessage, sourceChain } = req.body;

    try {
        // Decrypt the message using Lit Protocol
        const decryptedMessage = decryptMessage(encryptedMessage);

        // Verify the sender and message using decentralized oracle services
        const isValidMessage = await DecentralizedOracle.verifyMessage(sender, sourceChain);
        if (!isValidMessage) {
            return res.status(400).json({ message: 'Invalid message or untrusted sender' });
        }

        // Handle the received message (e.g., notify the user)
        console.log(`Message from ${sender} on ${sourceChain}: ${decryptedMessage}`);

        res.status(200).json({ message: 'Message received and verified successfully' });
    } catch (error) {
        console.error('Error receiving cross-chain message:', error);
        res.status(500).json({ message: 'Error receiving message', error: error.message });
    }
});

module.exports = router;
