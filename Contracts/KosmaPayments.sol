// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
// Import Circle's CCTP interface
import "circle/contracts/CrossChainTransferProtocol.sol";

contract KosmaPayments is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    IERC20 public immutable usdcToken; // Circle USDC token
    ISuperfluid private immutable superfluidHost; // Superfluid host contract
    IConstantFlowAgreementV1 private immutable cfa; // Superfluid Constant Flow Agreement
    CrossChainTransferProtocol public immutable cctp; // Circle CCTP contract interface

    Counters.Counter private transactionIdCounter;

    struct Escrow {
        address sender;
        address receiver;
        uint256 amount;
        bool isCompleted;
    }

    mapping(uint256 => Escrow) public escrows;

    event Deposit(address indexed sender, uint256 amount, uint256 transactionId);
    event Withdrawal(address indexed receiver, uint256 amount, uint256 transactionId);
    event StreamStarted(address indexed from, address indexed to, int96 flowRate);
    event StreamStopped(address indexed from, address indexed to);
    event CrossChainPayment(address indexed sender, address indexed receiver, uint256 amount, string destinationChain);

    constructor(
        address _usdcTokenAddress,
        address _superfluidHost,
        address _cfa,
        address _cctpAddress
    ) {
        usdcToken = IERC20(_usdcTokenAddress);
        superfluidHost = ISuperfluid(_superfluidHost);
        cfa = IConstantFlowAgreementV1(_cfa);
        cctp = CrossChainTransferProtocol(_cctpAddress);
    }

    modifier onlySender(uint256 transactionId) {
        require(msg.sender == escrows[transactionId].sender, "Not the sender of this transaction");
        _;
    }

    modifier onlyReceiver(uint256 transactionId) {
        require(msg.sender == escrows[transactionId].receiver, "Not the receiver of this transaction");
        _;
    }

    // 1. Regular Payments Using Circle USDC
    function deposit(uint256 amount, address receiver) external nonReentrant {
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "Deposit failed");

        transactionIdCounter.increment();
        uint256 transactionId = transactionIdCounter.current();

        escrows[transactionId] = Escrow({
            sender: msg.sender,
            receiver: receiver,
            amount: amount,
            isCompleted: false
        });

        emit Deposit(msg.sender, amount, transactionId);
    }

    function releaseFunds(uint256 transactionId) external onlySender(transactionId) nonReentrant {
        Escrow storage escrow = escrows[transactionId];
        require(!escrow.isCompleted, "Transaction already completed");

        escrow.isCompleted = true;
        require(usdcToken.transfer(escrow.receiver, escrow.amount), "Transfer failed");

        emit Withdrawal(escrow.receiver, escrow.amount, transactionId);
    }

    // 2. Streaming Payments Using Superfluid
    function startStream(
        address receiver,
        int96 flowRate // Flow rate in amount per second
    ) external nonReentrant {
        require(flowRate > 0, "Flow rate must be positive");

        superfluidHost.callAgreement(
            cfa,
            abi.encodeWithSelector(
                cfa.createFlow.selector,
                usdcToken,
                receiver,
                flowRate,
                new bytes(0)
            ),
            "0x"
        );

        emit StreamStarted(msg.sender, receiver, flowRate);
    }

    function updateStream(
        address receiver,
        int96 newFlowRate
    ) external nonReentrant {
        require(newFlowRate > 0, "Flow rate must be positive");

        superfluidHost.callAgreement(
            cfa,
            abi.encodeWithSelector(
                cfa.updateFlow.selector,
                usdcToken,
                receiver,
                newFlowRate,
                new bytes(0)
            ),
            "0x"
        );

        emit StreamStarted(msg.sender, receiver, newFlowRate);
    }

    function stopStream(address receiver) external nonReentrant {
        superfluidHost.callAgreement(
            cfa,
            abi.encodeWithSelector(
                cfa.deleteFlow.selector,
                usdcToken,
                msg.sender,
                receiver,
                new bytes(0)
            ),
            "0x"
        );

        emit StreamStopped(msg.sender, receiver);
    }

    // 3. Cross-Chain Payment Using Circle CCTP
    function crossChainPayment(
        address receiver,
        uint256 amount,
        string memory destinationChain
    ) external nonReentrant {
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Use Circle's CCTP to initiate cross-chain transfer
        // Assuming the CCTP contract has a `send` function
        cctp.send(receiver, amount, destinationChain);

        emit CrossChainPayment(msg.sender, receiver, amount, destinationChain);
    }

    // 4. Emergency Withdraw
    function emergencyWithdraw(uint256 transactionId) external onlyOwner nonReentrant {
        Escrow storage escrow = escrows[transactionId];
        require(!escrow.isCompleted, "Transaction already completed");

        escrow.isCompleted = true;
        require(usdcToken.transfer(escrow.sender, escrow.amount), "Refund failed");

        emit Withdrawal(escrow.sender, escrow.amount, transactionId);
    }
}