// Import necessary libraries and modules
const request = require('supertest');
const { expect } = require('chai');
const app = require('../app'); // Main application file
const StoryService = require('../services/storyService'); // Import the story service
const User = require('../models/User'); // User model for database interactions
const License = require('../models/License'); // License model for database interactions
const Royalty = require('../models/Royalty'); // Royalty model for database interactions
const Dispute = require('../models/Dispute'); // Dispute model for database interactions

// Mock data for tests
const mockLicenseData = {
    contentId: 'content123',
    creatorId: 'creator123',
    licenseeId: 'licensee123',
    terms: 'Standard usage rights',
    royalties: 10, // 10% royalties
};

// Clean up database before and after tests
before(async () => {
    await User.deleteMany({});
    await License.deleteMany({});
    await Royalty.deleteMany({});
    await Dispute.deleteMany({});
});

after(async () => {
    await User.deleteMany({});
    await License.deleteMany({});
    await Royalty.deleteMany({});
    await Dispute.deleteMany({});
});

// Create License Test
describe('Create License', () => {
    it('should create a license successfully', async () => {
        const res = await request(app)
            .post('/api/license/create')
            .send(mockLicenseData);

        expect(res.status).to.equal(201);
        expect(res.body).to.have.property('licenseId');
        const licenseInDb = await License.findById(res.body.licenseId);
        expect(licenseInDb).to.not.be.null;
        expect(licenseInDb.terms).to.equal(mockLicenseData.terms);
    });

    it('should fail to create a license with invalid data', async () => {
        const res = await request(app)
            .post('/api/license/create')
            .send({}); // Sending empty data

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Invalid license data.');
    });
});

// Royalty Distribution Test
describe('Royalty Distribution', () => {
    let licenseId;

    before(async () => {
        const licenseRes = await request(app)
            .post('/api/license/create')
            .send(mockLicenseData);
        licenseId = licenseRes.body.licenseId; // Store the created licenseId for royalty tests
    });

    it('should distribute royalties automatically to creators', async () => {
        const res = await request(app)
            .post('/api/royalty/distribute')
            .send({
                licenseId,
                amount: 100, // Total amount for distribution
            });

        expect(res.status).to.equal(200);
        const royaltiesInDb = await Royalty.find({ licenseId });
        expect(royaltiesInDb).to.have.lengthOf(1);
        expect(royaltiesInDb[0].amount).to.equal(10); // 10% of 100
    });

    it('should fail to distribute royalties for non-existent license', async () => {
        const res = await request(app)
            .post('/api/royalty/distribute')
            .send({
                licenseId: 'invalidLicenseId',
                amount: 100,
            });

        expect(res.status).to.equal(404);
        expect(res.body.message).to.equal('License not found.');
    });
});

// Dispute Resolution Test
describe('Dispute Resolution', () => {
    let licenseId;

    before(async () => {
        const licenseRes = await request(app)
            .post('/api/license/create')
            .send(mockLicenseData);
        licenseId = licenseRes.body.licenseId; // Store the created licenseId for dispute tests
    });

    it('should allow initiating a dispute', async () => {
        const res = await request(app)
            .post('/api/dispute/initiate')
            .send({
                licenseId,
                reason: 'Unauthorized usage',
            });

        expect(res.status).to.equal(201);
        expect(res.body).to.have.property('disputeId');
    });

    it('should resolve a dispute successfully', async () => {
        const disputeRes = await request(app)
            .post('/api/dispute/initiate')
            .send({
                licenseId,
                reason: 'Unauthorized usage',
            });

        const disputeId = disputeRes.body.disputeId;

        const res = await request(app)
            .post(`/api/dispute/resolve/${disputeId}`)
            .send({
                resolution: 'License revoked',
            });

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal('Dispute resolved successfully.');
    });

    it('should fail to resolve a non-existent dispute', async () => {
        const res = await request(app)
            .post('/api/dispute/resolve/nonExistentDisputeId')
            .send({
                resolution: 'License revoked',
            });

        expect(res.status).to.equal(404);
        expect(res.body.message).to.equal('Dispute not found.');
    });
});
