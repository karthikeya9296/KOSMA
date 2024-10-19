// Import necessary libraries and modules
const express = require('express');
const SignProtocol = require('./SignProtocol'); // Sign Protocol for attestations
const LitProtocol = require('./LitProtocol'); // Lit Protocol for encryption
const { authenticateUser } = require('./middleware/auth'); // Middleware for user authentication
const AccessControl = require('./middleware/accessControl'); // Middleware for access control
const Attestation = require('./models/Attestation'); // MongoDB model for attestations
const { ReentrancyGuard } = require('./middleware/reentrancyGuard'); // Middleware to prevent reentrancy

const router = express.Router();

/**
 * Create Attestation
 * @route POST /attestation/create
 * @param {string} contentId - ID of the content for which the attestation is created
 * @param {string} userId - User ID of the content creator
 */
router.post('/create', authenticateUser, AccessControl.isContentCreator, ReentrancyGuard, async (req, res) => {
    const { contentId } = req.body;

    try {
        // Create attestation using Sign Protocol
        const attestationData = await SignProtocol.createAttestation(req.user.id, contentId);

        // Save attestation in the database
        const newAttestation = new Attestation({
            userId: req.user.id,
            contentId,
            attestationData,
            createdAt: new Date(),
        });
        await newAttestation.save();

        res.status(201).json({ message: 'Attestation created successfully', attestation: newAttestation });
    } catch (error) {
        console.error('Error creating attestation:', error);
        res.status(500).json({ message: 'Error creating attestation', error: error.message });
    }
});

/**
 * Create Encrypted Attestation
 * @route POST /attestation/encrypted
 * @param {string} contentId - ID of the content for which the attestation is created
 * @param {object} attestationDetails - Details of the attestation
 */
router.post('/encrypted', authenticateUser, AccessControl.isContentCreator, ReentrancyGuard, async (req, res) => {
    const { contentId, attestationDetails } = req.body;

    try {
        // Encrypt attestation details using Lit Protocol
        const encryptedAttestation = await LitProtocol.encrypt(attestationDetails);

        // Create attestation using Sign Protocol
        const attestationData = await SignProtocol.createAttestation(req.user.id, contentId, encryptedAttestation);

        // Save encrypted attestation in the database
        const newAttestation = new Attestation({
            userId: req.user.id,
            contentId,
            attestationData,
            encrypted: true,
            createdAt: new Date(),
        });
        await newAttestation.save();

        res.status(201).json({ message: 'Encrypted attestation created successfully', attestation: newAttestation });
    } catch (error) {
        console.error('Error creating encrypted attestation:', error);
        res.status(500).json({ message: 'Error creating encrypted attestation', error: error.message });
    }
});

/**
 * Verify Attestation
 * @route POST /attestation/verify
 * @param {string} attestationId - ID of the attestation to verify
 */
router.post('/verify', async (req, res) => {
    const { attestationId } = req.body;

    try {
        // Fetch attestation details
        const attestation = await Attestation.findById(attestationId);
        if (!attestation) {
            return res.status(404).json({ message: 'Attestation not found' });
        }

        // Verify attestation using Sign Protocol
        const isValid = await SignProtocol.verifyAttestation(attestation.attestationData);

        res.json({ message: 'Attestation verification status', valid: isValid });
    } catch (error) {
        console.error('Error verifying attestation:', error);
        res.status(500).json({ message: 'Error verifying attestation', error: error.message });
    }
});

module.exports = router;
