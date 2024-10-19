// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SignAttestations is ReentrancyGuard, AccessControl {
    using ECDSA for bytes32;

    // Define roles
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // Nonces for replay protection
    mapping(address => uint256) public nonces;

    // Structure to hold attestation data
    struct Attestation {
        address owner;
        bytes32 contentHash; // Store as bytes32 hash instead of string for gas optimization
        bytes32 encryptedData; // Store the bytes32 hash of the encrypted data reference (IPFS URL)
        bool exists;
    }

    // Mapping to store attestations by their ID
    mapping(uint256 => Attestation) private attestations;
    uint256 private attestationCount;

    // Events
    event AttestationCreated(uint256 indexed attestationId, address indexed owner, bytes32 contentHash);
    event AttestationUpdated(uint256 indexed attestationId, bytes32 newContentHash, bytes32 newEncryptedData);
    event AttestationRevoked(uint256 indexed attestationId);
    event AttestationDecrypted(uint256 indexed attestationId, address indexed requester);
    event KeyShared(uint256 attestationId, address indexed recipient, bytes encryptedKey);

    // Constructor
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender); // Admin has all roles
        _setupRole(MANAGER_ROLE, msg.sender); // Manager role to manage attesters
        _setupRole(ATTESTER_ROLE, msg.sender); // Initial attester role to contract creator
    }

    // Modifier to check if the caller is an attester
    modifier onlyAttester() {
        require(hasRole(ATTESTER_ROLE, msg.sender), "Caller is not an attester");
        _;
    }

    // Modifier to check if the attestation exists
    modifier attestationExists(uint256 attestationId) {
        require(attestations[attestationId].exists, "Attestation does not exist");
        _;
    }

    // Function to create a new attestation
    function createAttestation(bytes32 contentHash, bytes32 encryptedData) external onlyAttester {
        attestationCount++;
        attestations[attestationCount] = Attestation(msg.sender, contentHash, encryptedData, true);
        emit AttestationCreated(attestationCount, msg.sender, contentHash);
    }

    // Batch function to create multiple attestations
    function batchCreateAttestations(bytes32[] calldata contentHashes, bytes32[] calldata encryptedData) external onlyAttester {
        require(contentHashes.length == encryptedData.length, "Array lengths mismatch");
        for (uint256 i = 0; i < contentHashes.length; i++) {
            attestationCount++;
            attestations[attestationCount] = Attestation(msg.sender, contentHashes[i], encryptedData[i], true);
            emit AttestationCreated(attestationCount, msg.sender, contentHashes[i]);
        }
    }

    // Function to update an existing attestation
    function updateAttestation(uint256 attestationId, bytes32 newContentHash, bytes32 newEncryptedData)
        external
        onlyAttester
        attestationExists(attestationId)
    {
        Attestation storage attestation = attestations[attestationId];
        require(attestation.owner == msg.sender, "Caller is not the owner");

        attestation.contentHash = newContentHash;
        attestation.encryptedData = newEncryptedData;
        emit AttestationUpdated(attestationId, newContentHash, newEncryptedData);
    }

    // Function to revoke an attestation
    function revokeAttestation(uint256 attestationId) external onlyAttester attestationExists(attestationId) {
        Attestation storage attestation = attestations[attestationId];
        require(attestation.owner == msg.sender, "Caller is not the owner");

        delete attestations[attestationId];
        emit AttestationRevoked(attestationId);
    }

    // Function to transfer ownership of an attestation
    function transferOwnership(uint256 attestationId, address newOwner) external attestationExists(attestationId) {
        Attestation storage attestation = attestations[attestationId];
        require(attestation.owner == msg.sender, "Caller is not the owner");

        attestation.owner = newOwner;
    }

    // Function to decrypt an attestation (simulate decryption)
    function decryptAttestation(uint256 attestationId) external attestationExists(attestationId) {
        emit AttestationDecrypted(attestationId, msg.sender);
        // Decryption logic can be handled off-chain using the emitted event and a shared key
    }

    // Function to share a decryption key (simulate key sharing)
    function shareDecryptionKey(uint256 attestationId, address recipient, bytes memory encryptedKey)
        external
        attestationExists(attestationId)
    {
        Attestation storage attestation = attestations[attestationId];
        require(attestation.owner == msg.sender, "Only the owner can share decryption keys");

        emit KeyShared(attestationId, recipient, encryptedKey);
    }

    // Function to verify user identity using signature and nonce (replay protection)
    function verifyIdentity(address user, bytes memory signature, uint256 nonce, uint256 expiration)
        external view returns (bool)
    {
        require(nonce == nonces[user], "Invalid nonce");
        require(block.timestamp <= expiration, "Signature expired");

        bytes32 messageHash = keccak256(abi.encodePacked(user, nonce, expiration));
        address recoveredAddress = messageHash.toEthSignedMessageHash().recover(signature);
        return recoveredAddress == user;
    }

    // Function to update a user's nonce (for replay protection)
    function updateNonce(address user) external {
        nonces[user]++;
    }

    // Function to add an attester role
    function addAttester(address account) external onlyRole(MANAGER_ROLE) {
        grantRole(ATTESTER_ROLE, account);
    }

    // Function to remove an attester role
    function removeAttester(address account) external onlyRole(MANAGER_ROLE) {
        revokeRole(ATTESTER_ROLE, account);
    }

    // Function to get attestation details
    function getAttestation(uint256 attestationId) external view attestationExists(attestationId) returns (Attestation memory) {
        return attestations[attestationId];
    }
}
