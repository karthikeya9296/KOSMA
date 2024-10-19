// Import necessary libraries and modules
const { ethers } = require('ethers');
const SignProtocol = require('./SignProtocol'); // Sign Protocol for attestation management
const LitProtocol = require('./LitProtocol'); // Lit Protocol for encryption
const User = require('./models/User'); // User model to fetch user data

// Set up provider for blockchain interactions
const provider = new ethers.providers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

/**
 * Create Attestation with input validation and gas estimation
 * @param {string} creatorId - ID of the content creator
 * @param {string} contentId - ID of the content for which attestation is created
 * @param {string} licenseTerms - Terms of the license associated with the content
 * @returns {Promise<string>} - Transaction hash of the attestation creation
 */
async function createAttestation(creatorId, contentId, licenseTerms) {
    try {
        // Input validation
        if (!creatorId || !contentId || !licenseTerms) {
            throw new Error('Invalid input parameters');
        }

        const creator = await User.findById(creatorId);
        if (!creator) throw new Error('Creator not found');

        const attestationData = {
            creator: creator.blockchainAddress,
            contentId,
            licenseTerms,
        };

        // Gas estimation for creating attestation
        const gasEstimate = await SignProtocol.estimateGas.createAttestation(attestationData);

        const tx = await SignProtocol.createAttestation(attestationData, { gasLimit: gasEstimate });
        await tx.wait(); // Wait for transaction confirmation
        return tx.hash;
    } catch (error) {
        console.error('Error creating attestation:', error);
        throw new Error('Attestation creation failed');
    }
}

/**
 * Verify Attestation with enhanced error logging
 * @param {string} attestationId - ID of the attestation to verify
 * @returns {Promise<boolean>} - True if the attestation is valid, false otherwise
 */
async function verifyAttestation(attestationId) {
    try {
        if (!attestationId) {
            throw new Error('Invalid attestation ID');
        }

        const isValid = await SignProtocol.verifyAttestation(attestationId);
        return isValid;
    } catch (error) {
        console.error('Error verifying attestation:', error, { attestationId });
        throw new Error('Attestation verification failed');
    }
}

/**
 * Create Encrypted Attestation with error handling and gas estimation
 * @param {string} creatorId - ID of the content creator
 * @param {string} contentId - ID of the content for which encrypted attestation is created
 * @param {string} licenseTerms - Terms of the license associated with the content
 * @returns {Promise<string>} - Transaction hash of the encrypted attestation creation
 */
async function createEncryptedAttestation(creatorId, contentId, licenseTerms) {
    try {
        if (!creatorId || !contentId || !licenseTerms) {
            throw new Error('Invalid input parameters');
        }

        const creator = await User.findById(creatorId);
        if (!creator) throw new Error('Creator not found');

        // Encrypt attestation data using Lit Protocol
        const encryptedData = await LitProtocol.encryptData({
            creator: creator.blockchainAddress,
            contentId,
            licenseTerms,
        });

        // Estimate gas for encrypted attestation creation
        const gasEstimate = await SignProtocol.estimateGas.createAttestation(encryptedData);

        const tx = await SignProtocol.createAttestation(encryptedData, { gasLimit: gasEstimate });
        await tx.wait(); // Wait for transaction confirmation
        return tx.hash;
    } catch (error) {
        console.error('Error creating encrypted attestation:', error);
        throw new Error('Encrypted attestation creation failed');
    }
}

/**
 * Dispute Attestation with batch processing and retry logic
 * @param {string} attestationId - ID of the attestation to dispute
 * @param {string} disputeDetails - Details of the dispute
 * @returns {Promise<string>} - Transaction hash of the dispute resolution
 */
async function disputeAttestation(attestationId, disputeDetails) {
    try {
        if (!attestationId || !disputeDetails) {
            throw new Error('Invalid input parameters');
        }

        let retries = 0;
        let tx = null;
        while (!tx && retries < 3) {
            try {
                // Estimate gas for raising a dispute
                const gasEstimate = await SignProtocol.estimateGas.raiseDispute(attestationId, disputeDetails);

                tx = await SignProtocol.raiseDispute(attestationId, disputeDetails, { gasLimit: gasEstimate });
                await tx.wait(); // Wait for transaction confirmation
            } catch (error) {
                retries += 1;
                console.error(`Retry ${retries}: Error disputing attestation`, error);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Retry after 1 second
            }
        }

        if (!tx) {
            throw new Error('Dispute resolution failed after 3 retries');
        }

        return tx.hash;
    } catch (error) {
        console.error('Error disputing attestation:', error);
        throw new Error('Dispute resolution failed');
    }
}

// Export the functions for use in other modules
module.exports = {
    createAttestation,
    verifyAttestation,
    createEncryptedAttestation,
    disputeAttestation,
};
