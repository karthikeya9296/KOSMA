// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract StoryIntegration is AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;

    // Role definitions for access control
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

    // Structs for content licensing, royalties, and disputes
    struct License {
        address creator;
        string ipfsHash; // IPFS link to metadata stored off-chain
        uint256 price;
        bool isActive;
        string terms; // Licensing terms
    }

    struct RoyaltyRecipient {
        address recipient;
        uint256 percentage; // Share of royalties (out of 100)
    }

    struct Dispute {
        uint256 contentId;
        address raisedBy;
        string reason;
        bool resolved;
        string resolutionDetails;
    }

    // Counters to track content and dispute IDs
    Counters.Counter private contentIdCounter;
    Counters.Counter private disputeIdCounter;

    // Mappings to store licenses, royalty recipients, and disputes
    mapping(uint256 => License) public licenses;
    mapping(uint256 => RoyaltyRecipient[]) public royalties;
    mapping(uint256 => Dispute) public disputes;

    // Events for transparency and tracking key actions
    event LicenseCreated(uint256 indexed contentId, address indexed creator, string ipfsHash, uint256 price, string terms);
    event RoyaltyPaid(uint256 indexed contentId, address indexed recipient, uint256 amount);
    event DisputeRaised(uint256 indexed disputeId, uint256 indexed contentId, address raisedBy, string reason);
    event DisputeResolved(uint256 indexed disputeId, string resolutionDetails);

    // Modifiers to enforce role-based access
    modifier onlyCreator() {
        require(hasRole(CREATOR_ROLE, msg.sender), "Access denied: Only creators allowed.");
        _;
    }

    modifier onlyModerator() {
        require(hasRole(MODERATOR_ROLE, msg.sender), "Access denied: Only moderators allowed.");
        _;
    }

    constructor() {
        // Grant admin role to the contract deployer
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Allows a content creator to create a new license.
     * @param ipfsHash Metadata link stored on IPFS.
     * @param price Price of the license.
     * @param terms Licensing terms.
     */
    function createLicense(string memory ipfsHash, uint256 price, string memory terms) 
        external onlyCreator 
    {
        require(bytes(ipfsHash).length > 0, "IPFS hash required.");
        require(price > 0, "Price must be greater than zero.");
        require(bytes(terms).length > 0, "Terms cannot be empty.");

        uint256 contentId = contentIdCounter.current();
        licenses[contentId] = License(msg.sender, ipfsHash, price, true, terms);
        contentIdCounter.increment();

        emit LicenseCreated(contentId, msg.sender, ipfsHash, price, terms);
    }

    /**
     * @dev Allows the creator to assign royalty recipients.
     * @param contentId The ID of the content.
     * @param recipients Array of recipient addresses.
     * @param percentages Array of percentage shares for each recipient.
     */
    function setRoyaltyRecipients(
        uint256 contentId,
        address[] memory recipients,
        uint256[] memory percentages
    ) external onlyCreator {
        require(licenses[contentId].creator == msg.sender, "Not the content creator.");
        require(recipients.length == percentages.length, "Mismatched inputs.");

        uint256 totalPercentage = 0;
        delete royalties[contentId]; // Clear previous royalties

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient address.");
            require(percentages[i] > 0, "Percentage must be greater than 0.");
            totalPercentage += percentages[i];

            royalties[contentId].push(RoyaltyRecipient(recipients[i], percentages[i]));
        }

        require(totalPercentage <= 100, "Total percentage exceeds 100.");
    }

    /**
     * @dev Distributes royalties to the recipients.
     * @param contentId The ID of the content.
     */
    function payRoyalties(uint256 contentId) external payable nonReentrant {
        require(licenses[contentId].isActive, "Inactive license.");
        require(msg.value > 0, "No payment sent.");

        uint256 totalPayment = msg.value;

        for (uint256 i = 0; i < royalties[contentId].length; i++) {
            RoyaltyRecipient memory recipient = royalties[contentId][i];
            uint256 amount = (totalPayment * recipient.percentage) / 100;
            require(amount > 0, "Insufficient payment.");

            (bool success, ) = recipient.recipient.call{value: amount}("");
            require(success, "Payment failed.");

            emit RoyaltyPaid(contentId, recipient.recipient, amount);
        }
    }

    /**
     * @dev Raises a dispute regarding content usage.
     * @param contentId The ID of the disputed content.
     * @param reason Reason for raising the dispute.
     */
    function raiseDispute(uint256 contentId, string memory reason) external {
        require(bytes(reason).length > 0, "Reason required.");

        uint256 disputeId = disputeIdCounter.current();
        disputes[disputeId] = Dispute(contentId, msg.sender, reason, false, "");
        disputeIdCounter.increment();

        emit DisputeRaised(disputeId, contentId, msg.sender, reason);
    }

    /**
     * @dev Resolves a dispute.
     * @param disputeId The ID of the dispute.
     * @param resolutionDetails Details of the resolution.
     */
    function resolveDispute(uint256 disputeId, string memory resolutionDetails) external onlyModerator {
        require(!disputes[disputeId].resolved, "Dispute already resolved.");
        require(bytes(resolutionDetails).length > 0, "Resolution details required.");

        disputes[disputeId].resolved = true;
        disputes[disputeId].resolutionDetails = resolutionDetails;

        emit DisputeResolved(disputeId, resolutionDetails);
    }

    /**
     * @dev Grants a role to an address.
     * @param account Address to be granted the role.
     * @param role Role to be granted.
     */
    function grantRoleTo(address account, bytes32 role) external {
        require(account != address(0), "Invalid address.");
        grantRole(role, account);
    }

    /**
     * @dev Revokes a role from an address.
     * @param account Address from which the role will be revoked.
     * @param role Role to be revoked.
     */
    function revokeRoleFrom(address account, bytes32 role) external {
        require(account != address(0), "Invalid address.");
        revokeRole(role, account);
    }
}
