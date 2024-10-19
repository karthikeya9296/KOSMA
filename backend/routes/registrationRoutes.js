// Import necessary libraries and modules
const express = require('express');
const bcrypt = require('bcrypt'); // For password hashing
const { generateBlockchainAddress } = require('./blockchain'); // Function to generate blockchain address
const { authenticateUser } = require('./middleware/auth'); // Middleware for user authentication
const User = require('./models/User'); // MongoDB model for users
const LedgerJS = require('ledger-js'); // LedgerJS for secure address generation through Ledger devices

const router = express.Router();

/**
 * User Registration
 * @route POST /registration
 * @param {string} name - User's name
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @param {boolean} useLedger - Optional flag to use Ledger device for blockchain address generation
 */
router.post('/', async (req, res) => {
    const { name, email, password, useLedger } = req.body;

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a blockchain address
        let blockchainAddress;
        if (useLedger) {
            blockchainAddress = await generateLedgerAddress(); // Use Ledger for secure address creation
        } else {
            blockchainAddress = await generateBlockchainAddress(); // Generate a standard blockchain address
        }

        // Create a new user record
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            blockchainAddress,
            createdAt: new Date(),
        });
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully', userId: newUser._id });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Error registering user', error: error.message });
    }
});

/**
 * Generate Blockchain Address
 * @returns {Promise<string>} - A promise that resolves to a new blockchain address
 */
async function generateBlockchainAddress() {
    // Example using ethers.js to generate a new blockchain address
    const { ethers } = require('ethers');
    const wallet = ethers.Wallet.createRandom();
    return wallet.address;
}

/**
 * Generate Blockchain Address via Ledger
 * @returns {Promise<string>} - A promise that resolves to a blockchain address generated via Ledger device
 */
async function generateLedgerAddress() {
    // Example logic to generate blockchain address using LedgerJS (depends on device setup)
    const ledger = new LedgerJS();
    const address = await ledger.getAddress();
    return address;
}

// Export the router
module.exports = router;
