// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISuperfluid {
    function createFlow(address recipient, uint256 flowRate) external;
    function updateFlow(address recipient, uint256 newFlowRate) external;
    function deleteFlow(address sender, address recipient) external;
}

contract KosmaPayments is Ownable, ReentrancyGuard, AccessControl, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Token and Superfluid interfaces
    IERC20 public usdcToken;
    ISuperfluid public superfluid;

    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");

    bool public paymentsEnabled;
    mapping(address => uint256) public userBalances;

    // Events
    event PaymentDeposited(address indexed user, uint256 amount);
    event PaymentWithdrawn(address indexed user, uint256 amount);
    event StreamingPaymentStarted(address indexed creator, address indexed subscriber, uint256 flowRate);
    event StreamingPaymentUpdated(address indexed creator, address indexed subscriber, uint256 newFlowRate);
    event StreamingPaymentStopped(address indexed creator, address indexed subscriber);

    // Modifier for rate-limiting to prevent abuse
    mapping(address => uint256) private lastActionTime;
    uint256 public actionCooldown = 1 minutes;

    modifier rateLimited() {
        require(
            block.timestamp >= lastActionTime[msg.sender] + actionCooldown,
            "Rate limit exceeded"
        );
        _;
        lastActionTime[msg.sender] = block.timestamp;
    }

    constructor(address _usdcTokenAddress, address _superfluidAddress) {
        usdcToken = IERC20(_usdcTokenAddress);
        superfluid = ISuperfluid(_superfluidAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DAO_ROLE, msg.sender);
    }

    // Enable or disable payments
    function setPaymentsEnabled(bool enabled) external onlyRole(DAO_ROLE) {
        paymentsEnabled = enabled;
    }

    // Set cooldown for rate-limiting actions
    function setActionCooldown(uint256 cooldown) external onlyRole(DAO_ROLE) {
        actionCooldown = cooldown;
    }

    // Deposit USDC into the contract
    function depositPayment(uint256 amount) external nonReentrant rateLimited {
        require(paymentsEnabled, "Payments are currently disabled");
        require(amount > 0, "Amount must be greater than zero");

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        userBalances[msg.sender] = userBalances[msg.sender].add(amount);
        emit PaymentDeposited(msg.sender, amount);
    }

    // Withdraw deposited USDC
    function withdrawPayment(uint256 amount) external nonReentrant rateLimited {
        require(amount > 0, "Amount must be greater than zero");
        require(userBalances[msg.sender] >= amount, "Insufficient balance");

        userBalances[msg.sender] = userBalances[msg.sender].sub(amount);
        usdcToken.safeTransfer(msg.sender, amount);
        emit PaymentWithdrawn(msg.sender, amount);
    }

    // Start streaming payment using Superfluid
    function startStreamingPayment(address creator, uint256 flowRate) external onlyRole(CREATOR_ROLE) rateLimited {
        require(paymentsEnabled, "Payments are currently disabled");
        require(flowRate > 0, "Flow rate must be greater than zero");

        superfluid.createFlow(creator, flowRate);
        emit StreamingPaymentStarted(creator, msg.sender, flowRate);
    }

    // Update an existing streaming payment
    function updateStreamingPayment(address creator, uint256 newFlowRate) external onlyRole(CREATOR_ROLE) rateLimited {
        require(newFlowRate > 0, "New flow rate must be greater than zero");

        superfluid.updateFlow(creator, newFlowRate);
        emit StreamingPaymentUpdated(creator, msg.sender, newFlowRate);
    }

    // Stop a streaming payment
    function stopStreamingPayment(address creator) external onlyRole(CREATOR_ROLE) rateLimited {
        superfluid.deleteFlow(msg.sender, creator);
        emit StreamingPaymentStopped(creator, msg.sender);
    }

    // Fallback function to recover mistakenly sent Ether
    receive() external payable {
        revert("Contract does not accept Ether");
    }

    fallback() external payable {
        revert("Invalid call");
    }

    // Recover mistakenly sent tokens
    function recoverTokens(address tokenAddress) external onlyRole(DAO_ROLE) {
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
        require(balance > 0, "No tokens to recover");
        IERC20(tokenAddress).safeTransfer(msg.sender, balance);
    }
}

contract KosmaPaymentsProxy is TransparentUpgradeableProxy {
    constructor(
        address _logic,
        address admin_,
        bytes memory _data
    ) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
