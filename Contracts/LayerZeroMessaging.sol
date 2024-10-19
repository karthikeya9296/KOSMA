// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@layerzerolabs/LayerZeroEndpoint.sol";

contract LayerZeroMessaging is ERC721, AccessControl, UUPSUpgradeable, ReentrancyGuard {
    // AccessControl roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // LayerZero Endpoint interface
    ILayerZeroEndpoint public endpoint;

    // Struct to track cross-chain NFT transfers
    struct PendingTransfer {
        address owner;
        uint96 tokenId; // Optimized storage for gas efficiency
        uint64 timestamp; // Optimized storage for gas efficiency
    }

    // Mapping to store pending NFT transfers by transferId
    mapping(bytes32 => PendingTransfer) public pendingTransfers;

    // Nonces by chainId
    mapping(uint16 => uint256) public chainNonces;

    // Nonces by user to avoid replay attacks
    mapping(address => uint256) public userNonces;

    // Pending transfer count per user
    mapping(address => uint256) public pendingTransferCount;

    // Rate limiting: Timestamp of the last transfer by a user
    mapping(address => uint256) public lastTransferTimestamp;
    uint256 public rateLimit = 5 minutes;

    // Whitelisted chains for security
    mapping(uint16 => bool) public whitelistedChains;

    // Approval count for high-value transfers
    mapping(bytes32 => uint8) public approvals;
    uint8 public approvalThreshold = 2; // Number of approvals needed for multi-sig

    // Transfer timeout (e.g., 1 day)
    uint256 public transferTimeout = 1 days;

    // Max pending transfers per user
    uint256 public constant MAX_PENDING_TRANSFERS = 10;

    // Emergency pause
    bool public paused = false;

    // Events
    event TransferInitiated(address indexed from, address indexed to, uint256 tokenId, uint16 destChainId);
    event TransferCompleted(address indexed owner, uint256 tokenId, uint16 srcChainId);
    event FailedTransfer(address indexed owner, uint256 tokenId, uint16 srcChainId, string reason);
    event TransferVerified(address indexed owner, uint256 tokenId, uint16 srcChainId);
    event AdminApproved(bytes32 indexed transferId, uint8 approvalCount);
    event ChainWhitelisted(uint16 indexed chainId);
    event ChainRemoved(uint16 indexed chainId);
    event EmergencyPause(bool isPaused);
    event TransferRetried(address indexed owner, uint256 tokenId, uint16 destChainId, uint256 retryTimestamp);
    event AdminRevoked(address indexed admin);
    event ExpiredTransferCleaned(address indexed owner, uint256 tokenId);

    // Constructor to set up the contract, endpoint, and AccessControl
    constructor(address _endpoint) ERC721("KosmaNFT", "KNFT") {
        endpoint = ILayerZeroEndpoint(_endpoint);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    // Modifier to restrict admin-only actions
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        _;
    }

    // Modifier to check chain whitelisting
    modifier onlyWhitelistedChain(uint16 chainId) {
        require(whitelistedChains[chainId], "Chain not whitelisted");
        _;
    }

    // Modifier to enforce pause state
    modifier whenNotPaused() {
        require(!paused, "Cross-chain transfers are paused");
        _;
    }

    // Modifier to limit pending transfers
    modifier limitPendingTransfers() {
        require(pendingTransferCount[msg.sender] < MAX_PENDING_TRANSFERS, "Too many pending transfers");
        _;
    }

    // Modifier to enforce rate limiting
    modifier rateLimited() {
        require(block.timestamp > lastTransferTimestamp[msg.sender] + rateLimit, "Rate limit exceeded");
        _;
    }

    // UUPS proxy upgrade function
    function _authorizeUpgrade(address newImplementation) internal override onlyAdmin {}

    // Function to whitelist a chain for cross-chain transfers
    function whitelistChain(uint16 chainId) external onlyAdmin {
        whitelistedChains[chainId] = true;
        emit ChainWhitelisted(chainId);
    }

    // Function to remove a chain from the whitelist
    function removeWhitelistChain(uint16 chainId) external onlyAdmin {
        whitelistedChains[chainId] = false;
        emit ChainRemoved(chainId);
    }

    // Function to initiate a cross-chain NFT transfer with gas cap, per-user nonce, and rate limiting
    function initiateTransfer(
        uint16 destChainId,
        address to,
        uint256 tokenId,
        uint256 maxGasFee
    ) external payable nonReentrant whenNotPaused onlyWhitelistedChain(destChainId) limitPendingTransfers rateLimited {
        require(ownerOf(tokenId) == msg.sender, "You don't own this NFT");
        require(to != address(0), "Destination address cannot be zero");

        // Burn the NFT on this chain before sending it cross-chain
        _burn(tokenId);

        // Create transferId using user nonce
        bytes32 transferId = keccak256(abi.encodePacked(msg.sender, to, tokenId, chainNonces[destChainId], userNonces[msg.sender]));

        // Increment user's nonce and pending transfer count
        userNonces[msg.sender]++;
        pendingTransferCount[msg.sender]++;

        // Save the transfer data
        pendingTransfers[transferId] = PendingTransfer({
            owner: msg.sender,
            tokenId: uint96(tokenId), // Gas optimized storage
            timestamp: uint64(block.timestamp) // Gas optimized storage
        });

        // Encode the payload (NFT owner, tokenId, nonce)
        bytes memory payload = abi.encode(msg.sender, to, tokenId, chainNonces[destChainId]);

        // Increment chain-specific nonce
        chainNonces[destChainId]++;

        // Estimate gas fee and ensure it's within the max allowed by the user
        uint256 gasFee = endpoint.estimateFees(destChainId, address(this), payload, false, bytes(""));
        require(gasFee <= maxGasFee, "Gas fee exceeds maximum allowed");

        // Send the message to the destination chain via LayerZero
        endpoint.send{value: gasFee}(destChainId, payload, payable(msg.sender), address(0), bytes(""));

        // Refund the excess gas fee, if any
        if (msg.value > gasFee) {
            payable(msg.sender).transfer(msg.value - gasFee);
        }

        // Update rate limit timestamp
        lastTransferTimestamp[msg.sender] = block.timestamp;

        // Log the event
        emit TransferInitiated(msg.sender, to, tokenId, destChainId);
    }

    // Function to handle receiving cross-chain NFT transfers with signature validation
    function lzReceive(
        uint16 srcChainId,
        bytes calldata payload,
        bytes32 r, bytes32 s, uint8 v
    ) external {
        require(msg.sender == address(endpoint), "Only the endpoint can call this function");

        // Decode the payload
        (address owner, address to, uint256 tokenId, uint256 transferNonce, bytes32 messageHash) = abi.decode(payload, (address, address, uint256, uint256, bytes32));

        // Recover the signer address using ecrecover
        address signer = ecrecover(messageHash, v, r, s);
        require(hasRole(ADMIN_ROLE, signer), "Invalid signature or unauthorized signer");

        // Verify the nonce for replay protection
        require(transferNonce == chainNonces[srcChainId], "Invalid nonce");

        // Mint the NFT on this chain for the new owner
        _mint(to, tokenId);

        // Log the event
        emit TransferCompleted(owner, tokenId, srcChainId);
    }

    // Batch transfer of multiple NFTs to another chain
    function batchInitiateTransfer(
        uint16 destChainId,
        address to,
        uint256[] memory tokenIds,
        uint256 maxGasFee
    ) external payable nonReentrant whenNotPaused onlyWhitelistedChain(destChainId) limitPendingTransfers rateLimited {
        require(to != address(0), "Destination address cannot be zero");
        require(tokenIds.length <= 20, "Batch size exceeds limit"); // Enforcing batch size limit for gas optimization

        bytes memory payload;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(ownerOf(tokenId) == msg.sender, "You don't own this NFT");

            // Burn the NFT on this chain
            _burn(tokenId);

            // Create transferId and payload for each token
            payload = abi.encodePacked(payload, abi.encode(msg.sender, to, tokenId, chainNonces[destChainId]));
            chainNonces[destChainId]++;
        }

        // Estimate gas for entire payload once
        uint256 totalGasFee = endpoint.estimateFees(destChainId, address(this), payload, false, bytes(""));
        require(totalGasFee <= maxGasFee, "Total gas fee exceeds maximum allowed");
        require(msg.value >= totalGasFee, "Insufficient gas fee");

        // Send the batch message to the destination chain via LayerZero
        endpoint.send{value: totalGasFee}(destChainId, payload, payable(msg.sender), address(0), bytes(""));

        // Refund the excess gas fee, if any
        if (msg.value > totalGasFee) {
            payable(msg.sender).transfer(msg.value - totalGasFee);
        }

        emit TransferInitiated(msg.sender, to, tokenIds[0], destChainId); // Emit event for the first token
    }

    // Function to approve high-value transfers using multi-signature
    function approveTransfer(bytes32 transferId) external onlyAdmin {
        require(approvals[transferId] < approvalThreshold, "Transfer already approved by enough admins");
        approvals[transferId]++;
        emit AdminApproved(transferId, approvals[transferId]);

        // If the number of approvals meets the threshold, the transfer is verified
        if (approvals[transferId] == approvalThreshold) {
            emit TransferVerified(pendingTransfers[transferId].owner, pendingTransfers[transferId].tokenId, 0); // Replace 0 with actual chainId
        }
    }

    // Function to reclaim NFT if cross-chain transfer times out
    function reclaimTransfer(bytes32 transferId) external {
        PendingTransfer memory transfer = pendingTransfers[transferId];
        require(transfer.owner == msg.sender, "Not the original owner");
        require(block.timestamp > transfer.timestamp + transferTimeout, "Transfer timeout has not expired");

        // Re-mint the NFT back to the original owner
        _mint(msg.sender, transfer.tokenId);

        // Clean up the pending transfer
        delete pendingTransfers[transferId];
        pendingTransferCount[msg.sender]--;

        emit FailedTransfer(msg.sender, transfer.tokenId, 0, "Timeout, NFT reclaimed");
    }

    // Retry a failed transfer
    function retryTransfer(bytes32 transferId, uint16 destChainId) external payable onlyAdmin {
        PendingTransfer memory transfer = pendingTransfers[transferId];
        require(transfer.owner != address(0), "Invalid transfer ID");

        bytes memory payload = abi.encode(transfer.owner, msg.sender, transfer.tokenId, chainNonces[destChainId]);

        // Retry sending the message to the destination chain
        endpoint.send{value: msg.value}(destChainId, payload, payable(transfer.owner), address(0), bytes(""));

        emit TransferRetried(transfer.owner, transfer.tokenId, destChainId, block.timestamp);
    }

    // Clean up expired transfers
    function cleanUpExpiredTransfers(bytes32 transferId) external onlyAdmin {
        PendingTransfer memory transfer = pendingTransfers[transferId];
        require(block.timestamp > transfer.timestamp + transferTimeout, "Transfer has not expired yet");

        // Clean up the expired transfer
        delete pendingTransfers[transferId];
        pendingTransferCount[transfer.owner]--;

        emit ExpiredTransferCleaned(transfer.owner, transfer.tokenId);
    }

    // Emergency pause function
    function pauseTransfers() external onlyAdmin {
        paused = true;
        emit EmergencyPause(true);
    }

    function unpauseTransfers() external onlyAdmin {
        paused = false;
        emit EmergencyPause(false);
    }

    // AccessControl: Add an admin
    function addAdmin(address admin) external onlyAdmin {
        grantRole(ADMIN_ROLE, admin);
    }

    // AccessControl: Revoke an admin
    function revokeAdmin(address admin) external onlyAdmin {
        revokeRole(ADMIN_ROLE, admin);
        emit AdminRevoked(admin);
    }
}
