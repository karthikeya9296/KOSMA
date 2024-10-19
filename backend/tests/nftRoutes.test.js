// Import necessary libraries and modules
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const app = require('../app'); // Main application file
const { ethers } = require('ethers');
const NFTContract = require('../contracts/FlowNFT'); // Mock NFT smart contract
const LayerZeroMessaging = require('../contracts/LayerZeroMessaging'); // Mock LayerZero contract
const StoryProtocol = require('../contracts/StoryProtocol'); // Mock Story Protocol contract

// Mock data for tests
const mockNFTData = {
    name: 'Test NFT',
    description: 'This is a test NFT',
    image: 'http://example.com/image.png',
    royalties: 10, // 10% royalties
};

// Clean up database or reset contracts before and after tests
before(async () => {
    // Assuming a function to reset the state of the smart contracts
    sinon.stub(NFTContract, 'reset').resolves();
    sinon.stub(LayerZeroMessaging, 'reset').resolves();
    sinon.stub(StoryProtocol, 'reset').resolves();
});

after(async () => {
    // Restore original behavior
    sinon.restore();
});

// Mint NFT Test
describe('Mint NFT', () => {
    it('should mint an NFT successfully', async () => {
        const res = await request(app)
            .post('/api/nft/mint')
            .send(mockNFTData);

        expect(res.status).to.equal(201);
        expect(res.body).to.have.property('tokenId');
        expect(res.body.name).to.equal(mockNFTData.name);
        expect(res.body.description).to.equal(mockNFTData.description);
    });

    it('should fail to mint an NFT with invalid data', async () => {
        const res = await request(app)
            .post('/api/nft/mint')
            .send({}); // Sending empty data

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Invalid NFT data.');
    });

    it('should handle blockchain network error during NFT minting', async () => {
        sinon.stub(NFTContract, 'mint').rejects(new Error('Network error'));

        const res = await request(app)
            .post('/api/nft/mint')
            .send(mockNFTData);

        expect(res.status).to.equal(500);
        expect(res.body.message).to.equal('Network error');

        NFTContract.mint.restore(); // Restore original behavior
    });

    it('should retry minting NFT on network failure', async () => {
        sinon.stub(NFTContract, 'mint')
            .onFirstCall().rejects(new Error('Network error'))
            .onSecondCall().resolves({ tokenId: 'mockTokenId' });

        const res = await request(app)
            .post('/api/nft/mint')
            .send(mockNFTData);

        expect(res.status).to.equal(201);
        expect(res.body.tokenId).to.equal('mockTokenId');

        NFTContract.mint.restore(); // Restore original behavior
    });

    it('should mint multiple NFTs in parallel', async () => {
        const mintRequests = Promise.all([
            request(app).post('/api/nft/mint').send(mockNFTData),
            request(app).post('/api/nft/mint').send(mockNFTData),
            request(app).post('/api/nft/mint').send(mockNFTData),
        ]);

        const responses = await mintRequests;
        responses.forEach(res => {
            expect(res.status).to.equal(201);
        });
    });
});

// Transfer NFT Test
describe('Transfer NFT', () => {
    let tokenId;

    before(async () => {
        const mintRes = await request(app)
            .post('/api/nft/mint')
            .send(mockNFTData);
        tokenId = mintRes.body.tokenId; // Store the minted tokenId for transfer tests
    });

    it('should transfer an NFT successfully across chains', async () => {
        const res = await request(app)
            .post('/api/nft/transfer')
            .send({
                tokenId,
                to: '0xRecipientAddress', // Replace with a valid address for testing
                chain: 'Ethereum', // Example chain
            });

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal('NFT transferred successfully.');
    });

    it('should fail to transfer an NFT with invalid tokenId', async () => {
        const res = await request(app)
            .post('/api/nft/transfer')
            .send({
                tokenId: 'invalidTokenId',
                to: '0xRecipientAddress',
                chain: 'Ethereum',
            });

        expect(res.status).to.equal(404);
        expect(res.body.message).to.equal('NFT not found.');
    });

    it('should fail to transfer NFT with invalid recipient address', async () => {
        const res = await request(app)
            .post('/api/nft/transfer')
            .send({
                tokenId,
                to: 'invalidAddress', // Invalid recipient address
                chain: 'Ethereum',
            });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Invalid recipient address.');
    });

    it('should handle NFT transfer events correctly', async () => {
        sinon.stub(LayerZeroMessaging, 'transfer').resolves({
            events: [{ event: 'Transfer', args: { from: '0xSender', to: '0xRecipient' } }],
        });

        const res = await request(app)
            .post('/api/nft/transfer')
            .send({
                tokenId,
                to: '0xRecipientAddress',
                chain: 'Ethereum',
            });

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal('NFT transferred successfully.');

        LayerZeroMessaging.transfer.restore(); // Restore original behavior
    });

    it('should reject transfer to unsupported chain', async () => {
        const res = await request(app)
            .post('/api/nft/transfer')
            .send({
                tokenId,
                to: '0xRecipientAddress',
                chain: 'UnknownChain',
            });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Unsupported blockchain.');
    });
});

// License NFT Test
describe('License NFT', () => {
    let tokenId;

    before(async () => {
        const mintRes = await request(app)
            .post('/api/nft/mint')
            .send(mockNFTData);
        tokenId = mintRes.body.tokenId; // Store the minted tokenId for licensing tests
    });

    it('should license an NFT successfully', async () => {
        const res = await request(app)
            .post('/api/nft/license')
            .send({
                tokenId,
                recipient: '0xLicenseeAddress', // Replace with a valid address for testing
                royalties: mockNFTData.royalties,
            });

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal('NFT licensed successfully.');
    });

    it('should fail to license an NFT with invalid royalties', async () => {
        const res = await request(app)
            .post('/api/nft/license')
            .send({
                tokenId,
                recipient: '0xLicenseeAddress',
                royalties: -5, // Invalid royalties
            });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Invalid royalties percentage.');
    });

    it('should fail to license NFT with missing recipient address', async () => {
        const res = await request(app)
            .post('/api/nft/license')
            .send({
                tokenId,
                royalties: mockNFTData.royalties,
            });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Recipient address is required.');
    });

    it('should allow licensing an NFT with zero royalties', async () => {
        const res = await request(app)
            .post('/api/nft/license')
            .send({
                tokenId,
                recipient: '0xLicenseeAddress',
                royalties: 0, // 0% royalties
            });

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal('NFT licensed successfully.');
    });

    it('should reject royalties above 100%', async () => {
        const res = await request(app)
            .post('/api/nft/license')
            .send({
                tokenId,
                recipient: '0xLicenseeAddress',
                royalties: 110, // Invalid royalties above 100%
            });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Invalid royalties percentage.');
    });

    it('should revoke an NFT license successfully', async () => {
        const res = await request(app)
            .post('/api/nft/license/revoke')
            .send({
                tokenId,
                recipient: '0xLicenseeAddress',
            });

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal('License revoked successfully.');
    });
});
