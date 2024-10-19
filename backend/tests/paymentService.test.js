// Import necessary libraries and modules
const { expect } = require('chai');
const sinon = require('sinon'); // For mocking external dependencies
const paymentService = require('../services/paymentService'); // Payment service functions
const CircleAPI = require('../CircleAPI'); // Mock Circle API
const Superfluid = require('../Superfluid'); // Mock Superfluid API
const LedgerJS = require('ledgerjs'); // Mock LedgerJS for payment authorization
const ethers = require('ethers'); // Mock ethers for blockchain interactions

// Mock data for tests
const mockUser = {
    id: '123456',
    blockchainAddress: '0xMockBlockchainAddress',
};

// Test suite for Payment Service
describe('Payment Service Tests', () => {

    // Mock Circle API responses and Superfluid responses
    beforeEach(() => {
        sinon.stub(CircleAPI, 'deposit').resolves('mockDepositTxHash');
        sinon.stub(CircleAPI, 'transfer').resolves('mockTransferTxHash');
        sinon.stub(CircleAPI, 'approve').resolves('mockApprovalTxHash');

        sinon.stub(Superfluid, 'createStream').resolves('mockStreamTxHash');
        sinon.stub(Superfluid, 'cancelStream').resolves('mockCancelTxHash');
    });

    afterEach(() => {
        sinon.restore(); // Restore all mocks after each test
    });

    // USDC Deposit Test
    describe('USDC Deposit', () => {
        it('should successfully deposit USDC via Circle API', async () => {
            const txHash = await paymentService.depositUSDC(mockUser.id, 100);

            expect(txHash).to.equal('mockDepositTxHash');
            expect(CircleAPI.deposit.calledOnce).to.be.true;
            expect(CircleAPI.deposit.calledWith(mockUser.blockchainAddress, 100)).to.be.true;
        });

        it('should throw an error for invalid deposit amount', async () => {
            try {
                await paymentService.depositUSDC(mockUser.id, -10);
            } catch (error) {
                expect(error.message).to.equal('USDC deposit failed');
            }
        });

        it('should handle retry logic for Circle API failures', async () => {
            CircleAPI.deposit
                .onFirstCall().rejects(new Error('Network error'))
                .onSecondCall().resolves('mockDepositTxHash');

            const txHash = await paymentService.depositUSDC(mockUser.id, 100);
            expect(txHash).to.equal('mockDepositTxHash');
            expect(CircleAPI.deposit.calledTwice).to.be.true;
        });
    });

    // USDC Transfer Test
    describe('USDC Transfer', () => {
        it('should successfully transfer USDC via Circle API', async () => {
            const txHash = await paymentService.transferUSDC('0xRecipientAddress', 50);

            expect(txHash).to.equal('mockTransferTxHash');
            expect(CircleAPI.transfer.calledOnce).to.be.true;
            expect(CircleAPI.transfer.calledWith('0xRecipientAddress', 50)).to.be.true;
        });

        it('should reject transfer with zero USDC amount', async () => {
            try {
                await paymentService.transferUSDC('0xRecipientAddress', 0);
            } catch (error) {
                expect(error.message).to.equal('USDC transfer failed');
            }
        });

        it('should reject transfer with invalid recipient address', async () => {
            try {
                await paymentService.transferUSDC('invalidAddress', 50);
            } catch (error) {
                expect(error.message).to.equal('USDC transfer failed');
            }
        });

        it('should handle blockchain gas limit errors', async () => {
            sinon.stub(ethers.providers.JsonRpcProvider.prototype, 'sendTransaction')
                .rejects(new Error('Exceeds block gas limit'));

            try {
                await paymentService.transferUSDC('0xRecipientAddress', 50);
            } catch (error) {
                expect(error.message).to.equal('Exceeds block gas limit');
            }

            sinon.restore(); // Restore the blockchain mock
        });

        it('should handle retry logic for Circle API transfer failures', async () => {
            CircleAPI.transfer
                .onFirstCall().rejects(new Error('Rate limit exceeded'))
                .onSecondCall().resolves('mockTransferTxHash');

            const txHash = await paymentService.transferUSDC('0xRecipientAddress', 50);
            expect(txHash).to.equal('mockTransferTxHash');
            expect(CircleAPI.transfer.calledTwice).to.be.true;
        });
    });

    // Streaming Payment Test
    describe('Superfluid Streaming Payments', () => {
        it('should successfully start a streaming payment via Superfluid', async () => {
            const txHash = await paymentService.startStreamingPayment('0xRecipientAddress', 1);

            expect(txHash).to.equal('mockStreamTxHash');
            expect(Superfluid.createStream.calledOnce).to.be.true;
            expect(Superfluid.createStream.calledWith('0xRecipientAddress', 1)).to.be.true;
        });

        it('should reject streaming payment if user has insufficient balance', async () => {
            Superfluid.createStream.rejects(new Error('Insufficient balance'));

            try {
                await paymentService.startStreamingPayment('0xRecipientAddress', 1);
            } catch (error) {
                expect(error.message).to.equal('Insufficient balance');
            }
        });

        it('should successfully cancel a streaming payment via Superfluid', async () => {
            const txHash = await paymentService.cancelStreamingPayment('mockStreamId');

            expect(txHash).to.equal('mockCancelTxHash');
            expect(Superfluid.cancelStream.calledOnce).to.be.true;
            expect(Superfluid.cancelStream.calledWith('mockStreamId')).to.be.true;
        });

        it('should handle multiple Superfluid streams concurrently', async () => {
            const streams = await Promise.all([
                paymentService.startStreamingPayment('0xRecipientAddress1', 1),
                paymentService.startStreamingPayment('0xRecipientAddress2', 2),
            ]);

            expect(streams).to.have.lengthOf(2);
            expect(streams[0]).to.equal('mockStreamTxHash');
            expect(Superfluid.createStream.calledTwice).to.be.true;
        });
    });

    // LedgerJS Payment Authorization Test
    describe('LedgerJS Payment Authorization', () => {
        let ledgerStub;

        beforeEach(() => {
            ledgerStub = sinon.stub(LedgerJS, 'verifySignature').resolves(true);
        });

        afterEach(() => {
            ledgerStub.restore();
        });

        it('should authorize payment with valid Ledger signature', async () => {
            const validSignature = 'validSignature';
            const isAuthorized = await paymentService.authorizePaymentWithLedger(validSignature);

            expect(isAuthorized).to.be.true;
            expect(LedgerJS.verifySignature.calledOnce).to.be.true;
            expect(LedgerJS.verifySignature.calledWith(validSignature)).to.be.true;
        });

        it('should reject payment with invalid Ledger signature', async () => {
            ledgerStub.resolves(false); // Simulate invalid signature

            try {
                await paymentService.authorizePaymentWithLedger('invalidSignature');
            } catch (error) {
                expect(error.message).to.equal('Payment authorization failed.');
            }
        });

        it('should reject Ledger payment authorization if token is expired', async () => {
            ledgerStub.resolves(false); // Simulate expired token in Ledger

            try {
                await paymentService.authorizePaymentWithLedger('expiredSignature');
            } catch (error) {
                expect(error.message).to.equal('Payment authorization failed.');
            }
        });
    });

    // Parallel Tests for Performance
    describe('Parallel Transactions', () => {
        it('should handle multiple USDC transfers in parallel', async () => {
            const transfers = await Promise.all([
                paymentService.transferUSDC('0xRecipientAddress1', 100),
                paymentService.transferUSDC('0xRecipientAddress2', 200),
                paymentService.transferUSDC('0xRecipientAddress3', 300),
            ]);

            expect(transfers).to.have.lengthOf(3);
            expect(transfers[0]).to.equal('mockTransferTxHash');
            expect(CircleAPI.transfer.calledThrice).to.be.true;
        });
    });
});

