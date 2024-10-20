// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@layerzerolabs/lz-evm-oapp-v2/contracts/ILayerZeroEndpoint.sol";

contract LayerZeroMessaging is ERC721, AccessControl, UUPSUpgradeable, ReentrancyGuard {
    // This contract allows users to send media or messages across different blockchains.
    // These media/messages are converted into NFTs and securely transferred using LayerZero V2 for cross-chain communication.

    // AccessControl roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // LayerZero Endpoint interface to communicate between chains
    ILayerZeroEndpoint public endpoint;

    // Struct to track cross-chain NFT transfers
    struct PendingTransfer {
        address owner;
        uint96 tokenId; // Optimized storage for gas efficiency
        uint64 timestamp; // Optimized storage for gas efficiency
    }

    // Mapping to store pending NFT transfers by transferId
    mapping(bytes32 => PendingTransfer) public pendingTransfers;

    // Nonces by chainId to keep track of transfer order
    mapping(uint16 => uint256) public chainNonces;

    // Nonces by user to prevent replay attacks
    mapping(address => uint256) public userNonces;

    // Count of pending transfers per user
    mapping(address => uint256) public pendingTransferCount;

    // Rate limiting: Timestamp of the last transfer by a user to prevent frequent transfers
    mapping(address => uint256) public lastTransferTimestamp;
    uint256 public rateLimit = 5 minutes;

    // List of whitelisted chains to ensure transfers are only done with trusted blockchains
    mapping(uint16 => bool) public whitelistedChains;

    // Approval count for high-value transfers requiring multiple admin approvals
    mapping(bytes32 => uint8) public approvals;
    uint8 public approvalThreshold = 2; // Number of approvals needed for multi-signature verification

    // Transfer timeout (e.g., 1 day) to reclaim NFTs if the transfer fails
    uint256 public transferTimeout = 1 days;

    // Maximum pending transfers allowed per user
    uint256 public constant MAX_PENDING_TRANSFERS = 10;

    // Emergency pause flag to halt all transfers if needed
    bool public paused = false;

    // Events to track different actions like transfer initiation, completion, failure, etc.
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

    // Constructor to set up the contract, endpoint, and admin roles
    constructor(address _endpoint) ERC721("KosmaNFT", "KNFT") {
        endpoint = ILayerZeroEndpoint(_endpoint);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    // Modifier to restrict functions to admin-only access
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        _;
    }

    // Modifier to check if a chain is whitelisted for transfers
    modifier onlyWhitelistedChain(uint16 chainId) {
        require(whitelistedChains[chainId], "Chain not whitelisted");
        _;
    }

    // Modifier to enforce pause state
    modifier whenNotPaused() {
        require(!paused, "Cross-chain transfers are paused");
        _;
    }

    // Modifier to limit pending transfers per user
    modifier limitPendingTransfers() {
        require(pendingTransferCount[msg.sender] < MAX_PENDING_TRANSFERS, "Too many pending transfers");
        _;
    }

    // Modifier to enforce rate limiting
    modifier rateLimited() {
        require(block.timestamp > lastTransferTimestamp[msg.sender] + rateLimit, "Rate limit exceeded");
        _;
    }

    // UUPS proxy upgrade function to allow upgrading the contract
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

    // Function to initiate a cross-chain media/message transfer by converting it into an NFT
    function initiateTransfer(
        uint16 destChainId,
        address to,
        string memory mediaUri,
        uint256 maxGasFee
    ) external payable nonReentrant whenNotPaused onlyWhitelistedChain(destChainId) limitPendingTransfers rateLimited {
        require(to != address(0), "Destination address cannot be zero");

        // Mint a new NFT to represent the media or message being transferred
        uint256 tokenId = _mintMediaNFT(mediaUri);

        // Create a unique transfer ID using the user nonce
        bytes32 transferId = keccak256(abi.encodePacked(msg.sender, to, tokenId, chainNonces[destChainId], userNonces[msg.sender]));

        // Increment user's nonce and pending transfer count
        userNonces[msg.sender]++;
        pendingTransferCount[msg.sender]++;

        // Store the transfer data
        pendingTransfers[transferId] = PendingTransfer({
            owner: msg.sender,
            tokenId: uint96(tokenId), // Gas optimized storage
            timestamp: uint64(block.timestamp) // Gas optimized storage
        });

        // Encode the transfer details into a payload
        bytes memory payload = abi.encode(msg.sender, to, tokenId, chainNonces[destChainId]);

        // Increment the chain-specific nonce
        chainNonces[destChainId]++;

        // Estimate the gas fee for sending the message to the destination chain
        uint256 gasFee = endpoint.estimateFees(destChainId, address(this), payload, false, bytes(""));
        require(gasFee <= maxGasFee, "Gas fee exceeds maximum allowed");

        // Send the message to the destination chain using LayerZero
        endpoint.send{value: gasFee}(destChainId, payload, payable(msg.sender), address(0), bytes(""));

        // Refund any excess gas fee
        if (msg.value > gasFee) {
            payable(msg.sender).transfer(msg.value - gasFee);
        }

        // Update the rate limit timestamp for the user
        lastTransferTimestamp[msg.sender] = block.timestamp;

        // Log the transfer initiation event
        emit TransferInitiated(msg.sender, to, tokenId, destChainId);
    }

    // Function to mint a new NFT representing the media or message
    function _mintMediaNFT(string memory mediaUri) internal returns (uint256) {
        uint256 tokenId = totalSupply() + 1; // Generate a new token ID
        _mint(msg.sender, tokenId); // Mint the NFT
        _setTokenURI(tokenId, mediaUri); // Set the metadata URI for the NFT
        return tokenId;
    }

    // Function to handle receiving cross-chain NFT transfers with admin signature validation
    function lzReceive(
        uint16 srcChainId,
        bytes calldata payload,
        bytes32 r, bytes32 s, uint8 v
    ) external {
        require(msg.sender == address(endpoint), "Only the endpoint can call this function");

        // Decode the payload
        (address owner, address to, uint256 tokenId, uint256 transferNonce, bytes32 messageHash) = abi.decode(payload, (address, address, uint256, uint256, bytes32));

        // Validate the signature using ecrecover
        address signer = ecrecover(messageHash, v, r, s);
        require(hasRole(ADMIN_ROLE, signer), "Invalid signature or unauthorized signer");

        // Verify the nonce to prevent replay attacks
        require(transferNonce == chainNonces[srcChainId], "Invalid nonce");

        // Mint the NFT on this chain for the new owner
        _mint(to, tokenId);

        // Log the transfer completion event
        emit TransferCompleted(owner, tokenId, srcChainId);
    }

    // Function to initiate a batch transfer of multiple NFTs to another chain
    function batchInitiateTransfer(
        uint16 destChainId,
        address to,
        string[] memory mediaUris,
        uint256 maxGasFee
    ) external payable nonReentrant whenNotPaused onlyWhitelistedChain(destChainId) limitPendingTransfers rateLimited {
        require(to != address(0), "Destination address cannot be zero");
        require(mediaUris.length <= 20, "Batch size exceeds limit");

        bytes memory payload;
        for (uint256 i = 0; i < mediaUris.length; i++) {
            // Mint a new NFT for each media/message
            uint256 tokenId = _mintMediaNFT(mediaUris[i]);

            // Add each token's data to the payload
            payload = abi.encodePacked(payload, abi.encode(msg.sender, to, tokenId, chainNonces[destChainId]));
            chainNonces[destChainId]++;
        }

        // Estimate gas for the entire payload
        uint256 totalGasFee = endpoint.estimateFees(destChainId, address(this), payload, false, bytes(""));
        require(totalGasFee <= maxGasFee, "Total gas fee exceeds maximum allowed");
        require(msg.value >= totalGasFee, "Insufficient gas fee");

        // Send the batch message to the destination chain
        endpoint.send{value: totalGasFee}(destChainId, payload, payable(msg.sender), address(0), bytes(""));

        // Refund any excess gas fee
        if (msg.value > totalGasFee) {
            payable(msg.sender).transfer(msg.value - totalGasFee);
        }

        // Log the batch transfer initiation event
        emit TransferInitiated(msg.sender, to, mediaUris.length, destChainId);
    }

    // Function to approve high-value transfers using multi-signature
    function approveTransfer(bytes32 transferId) external onlyAdmin {
        require(approvals[transferId] < approvalThreshold, "Transfer already approved by enough admins");
        approvals[transferId]++;
        emit AdminApproved(transferId, approvals[transferId]);

        // If enough admins approve, mark the transfer as verified
        if (approvals[transferId] == approvalThreshold) {
            emit TransferVerified(pendingTransfers[transferId].owner, pendingTransfers[transferId].tokenId, 0);
        }
    }

    // Function to reclaim NFTs if cross-chain transfer times out
    function reclaimTransfer(bytes32 transferId) external {
        PendingTransfer memory transfer = pendingTransfers[transferId];
        require(transfer.owner == msg.sender, "Not the original owner");
        require(block.timestamp > transfer.timestamp + transferTimeout, "Transfer timeout has not expired");

        // Re-mint the NFT back to the original owner
        _mint(msg.sender, transfer.tokenId);

        // Remove the pending transfer record
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

        // Remove the expired transfer record
        delete pendingTransfers[transferId];
        pendingTransferCount[transfer.owner]--;

        emit ExpiredTransferCleaned(transfer.owner, transfer.tokenId);
    }

    // Emergency pause function to stop all transfers
    function pauseTransfers() external onlyAdmin {
        paused = true;
        emit EmergencyPause(true);
    }

    // Function to unpause transfers
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
