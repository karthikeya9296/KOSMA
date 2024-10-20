// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@signprotocol/sign-sdk.sol"; // Import Sign Protocol SDK for attestations

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
        bytes32 contentHash; // Store as bytes32 hash for gas optimization
        bytes32 encryptedData; // Store encrypted data as bytes32 reference (e.g., IPFS URL)
        bool exists;
    }

    // Mapping to store attestations by their ID
    mapping(uint256 => Attestation) private attestations;
    uint256 private attestationCount;

    // Sign Protocol schema hooks
    bytes32 public constant SCHEMA_ID = keccak256("KOSMA-ATTESTATION-SCHEMA");

    // Events
    event AttestationCreated(uint256 indexed attestationId, address indexed owner, bytes32 contentHash);
    event AttestationUpdated(uint256 indexed attestationId, bytes32 newContentHash, bytes32 newEncryptedData);
    event AttestationRevoked(uint256 indexed attestationId);
    event AttestationDecrypted(uint256 indexed attestationId, address indexed requester);
    event KeyShared(uint256 attestationId, address indexed recipient, bytes encryptedKey);
    event SchemaHookTriggered(bytes32 indexed schemaId, address attester);

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

        // Trigger Schema Hook using Sign Protocol SDK
        SignProtocol.triggerSchemaHook(SCHEMA_ID, msg.sender);
        emit SchemaHookTriggered(SCHEMA_ID, msg.sender);
    }

    // Batch function to create multiple attestations
    function batchCreateAttestations(bytes32[] calldata contentHashes, bytes32[] calldata encryptedData) external onlyAttester {
        require(contentHashes.length == encryptedData.length, "Array lengths mismatch");
        for (uint256 i = 0; i < contentHashes.length; i++) {
            attestationCount++;
            attestations[attestationCount] = Attestation(msg.sender, contentHashes[i], encryptedData[i], true);
            emit AttestationCreated(attestationCount, msg.sender, contentHashes[i]);

            // Trigger Schema Hook using Sign Protocol SDK
            SignProtocol.triggerSchemaHook(SCHEMA_ID, msg.sender);
            emit SchemaHookTriggered(SCHEMA_ID, msg.sender);
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

    // Schema hook for whitelisting attesters
    function addAttester(address account) external onlyRole(MANAGER_ROLE) {
        grantRole(ATTESTER_ROLE, account);

        // Trigger Schema Hook using Sign Protocol SDK for whitelist
        SignProtocol.triggerSchemaHook(SCHEMA_ID, account);
        emit SchemaHookTriggered(SCHEMA_ID, account);
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

    // Function to add an admin role (to comply with Schema Hooks)
    function addAdmin(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(ADMIN_ROLE, account);
    }

    // Function to get attestation details
    function getAttestation(uint256 attestationId) external view attestationExists(attestationId) returns (Attestation memory) {
        return attestations[attestationId];
    }
}