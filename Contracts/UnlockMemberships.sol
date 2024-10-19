// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@unlock-protocol/contracts/interfaces/IUnlock.sol";
import "@unlock-protocol/contracts/interfaces/IPublicLock.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract UnlockMemberships is AccessControl, ReentrancyGuard, Initializable {
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");

    struct Membership {
        address lockAddress; // Address of the Unlock Protocol lock contract
        string tier; // Membership tier (e.g., Silver, Gold, Platinum)
        uint256 price; // Membership price
    }

    mapping(address => Membership) public memberships; // Maps creators to their membership tiers
    mapping(address => bool) public hasActiveMembership; // Track active memberships per user

    event MembershipMinted(address indexed creator, address indexed lockAddress, string tier);
    event MembershipPurchased(address indexed user, address indexed lockAddress, string tier);
    event MembershipRenewed(address indexed user, address indexed lockAddress, string tier);
    event MembershipCancelled(address indexed user, address indexed lockAddress);
    event MembershipUpgraded(address indexed user, address indexed oldLock, address indexed newLock, string newTier);
    event MembershipDowngraded(address indexed user, address indexed oldLock, address indexed newLock, string newTier);
    event MembershipTransferred(address indexed from, address indexed to, address indexed lockAddress);
    event MembershipTrialStarted(address indexed user, address indexed lockAddress, string tier);

    IUnlock public unlock;

    constructor(address _unlockAddress) {
        unlock = IUnlock(_unlockAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyCreator() {
        require(hasRole(CREATOR_ROLE, msg.sender), "UnlockMemberships: Not a creator");
        _;
    }

    // 1. Membership Minting Using Unlock Protocol
    function createMembership(
        string memory tier,
        uint256 keyPrice,
        uint256 expirationDuration,
        uint256 maxNumberOfKeys,
        string memory lockName
    ) external onlyCreator nonReentrant {
        address lockAddress = unlock.createLock(
            expirationDuration,
            msg.sender,
            keyPrice,
            maxNumberOfKeys,
            lockName
        );

        memberships[msg.sender] = Membership({
            lockAddress: lockAddress,
            tier: tier,
            price: keyPrice
        });

        emit MembershipMinted(msg.sender, lockAddress, tier);
    }

    // 2. Subscription Management with Added Flexibility
    function purchaseMembership(address lockAddress) external payable nonReentrant {
        IPublicLock lock = IPublicLock(lockAddress);
        require(!hasActiveMembership[msg.sender], "UnlockMemberships: Already has active membership");

        lock.purchase{value: msg.value}(msg.sender, msg.value);
        hasActiveMembership[msg.sender] = true;

        Membership memory membership = _findMembershipByLock(lockAddress);
        emit MembershipPurchased(msg.sender, lockAddress, membership.tier);
    }

    function transferMembership(address recipient, address lockAddress) external nonReentrant {
        IPublicLock lock = IPublicLock(lockAddress);
        require(lock.getHasValidKey(msg.sender), "UnlockMemberships: No active membership to transfer");

        lock.transferFrom(msg.sender, recipient);
        hasActiveMembership[msg.sender] = false;
        hasActiveMembership[recipient] = true;

        emit MembershipTransferred(msg.sender, recipient, lockAddress);
    }

    function startTrialMembership(address lockAddress, uint256 trialDuration) external nonReentrant {
        IPublicLock lock = IPublicLock(lockAddress);
        require(!hasActiveMembership[msg.sender], "UnlockMemberships: Already has active membership");

        lock.grantKeys(new address , trialDuration);
        hasActiveMembership[msg.sender] = true;

        Membership memory membership = _findMembershipByLock(lockAddress);
        emit MembershipTrialStarted(msg.sender, lockAddress, membership.tier);
    }

    // Additional Security Measures & Role Management
    modifier onlyAdminOrCreator(address lockAddress) {
        require(hasRole(ADMIN_ROLE, msg.sender) || memberships[lockAddress].lockAddress != address(0), "Unauthorized");
        _;
    }

    function _findMembershipByLock(address lockAddress) internal view returns (Membership memory) {
        address[] memory creators = unlock.getAllLocksFor(msg.sender);
        for (uint256 i = 0; i < creators.length; i++) {
            if (memberships[creators[i]].lockAddress == lockAddress) {
                return memberships[creators[i]];
            }
        }
        revert("UnlockMemberships: Membership not found");
    }

    error UnauthorizedAccess();
}
