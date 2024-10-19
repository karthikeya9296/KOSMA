// Import necessary libraries and modules
const request = require('supertest');
const { expect } = require('chai');
const app = require('../app'); // Main application file
const User = require('../models/User'); // User model for database interactions
const jwt = require('jsonwebtoken');
const sinon = require('sinon'); // For mocking
const LedgerJS = require('ledgerjs'); // Mock LedgerJS for testing

// Mock data for tests
const mockUser = {
    email: 'testuser@example.com',
    password: 'Password123!',
};

// Clean up database before and after tests
beforeEach(async () => {
    await User.deleteMany({});
});

afterEach(async () => {
    await User.deleteMany({});
});

// User Registration Test
describe('User Registration', () => {
    it('should register a new user successfully and hash the password', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(mockUser);

        expect(res.status).to.equal(201);
        expect(res.body).to.have.property('token');

        const userInDb = await User.findOne({ email: mockUser.email });
        expect(userInDb).to.not.be.null;
        expect(userInDb.password).to.not.equal(mockUser.password); // Password should be hashed
    });

    it('should not register a user with an existing email', async () => {
        await request(app)
            .post('/api/auth/register')
            .send(mockUser);

        const res = await request(app)
            .post('/api/auth/register')
            .send(mockUser);

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Email already exists.');
    });

    it('should reject weak passwords', async () => {
        const weakPasswordUser = { email: 'weakuser@example.com', password: '12345' };
        const res = await request(app)
            .post('/api/auth/register')
            .send(weakPasswordUser);

        expect(res.status).to.equal(400);
        expect(res.body.message).to.include('Password must be stronger');
    });
});

// Login Test
describe('User Login', () => {
    beforeEach(async () => {
        await request(app)
            .post('/api/auth/register')
            .send(mockUser);
    });

    it('should login successfully with correct credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: mockUser.email,
                password: mockUser.password,
            });

        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('token');
    });

    it('should not login with incorrect credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: mockUser.email,
                password: 'WrongPassword!',
            });

        expect(res.status).to.equal(401);
        expect(res.body.message).to.equal('Invalid email or password.');
    });

    it('should reject login with missing fields', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: mockUser.email,
            });

        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Email and password are required.');
    });
});

// JWT Verification Test
describe('JWT Verification', () => {
    let token;

    beforeEach(async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(mockUser);
        token = res.body.token;
    });

    it('should verify a valid JWT token', async () => {
        const res = await request(app)
            .get('/api/protected-route')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal('Access granted.');
    });

    it('should reject an expired JWT token', async () => {
        const expiredToken = jwt.sign({ id: 'testId' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
        const res = await request(app)
            .get('/api/protected-route')
            .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).to.equal(401);
        expect(res.body.message).to.equal('Invalid token.');
    });

    it('should reject requests without JWT', async () => {
        const res = await request(app)
            .get('/api/protected-route');

        expect(res.status).to.equal(403);
        expect(res.body.message).to.equal('Access denied. No token provided.');
    });
});

// Ledger Wallet Test
describe('Ledger Wallet Integration', () => {
    let ledgerStub;

    beforeEach(() => {
        // Mock Ledger signature verification
        ledgerStub = sinon.stub(LedgerJS, 'verifySignature').returns(Promise.resolve(true));
    });

    afterEach(() => {
        ledgerStub.restore();
    });

    it('should authenticate user using Ledger wallet', async () => {
        const ledgerSignature = 'mockLedgerSignature';

        const res = await request(app)
            .post('/api/auth/login/ledger')
            .send({
                email: mockUser.email,
                ledgerSignature,
            });

        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('token');
    });

    it('should reject invalid Ledger signature', async () => {
        ledgerStub.returns(Promise.resolve(false)); // Simulate invalid signature

        const res = await request(app)
            .post('/api/auth/login/ledger')
            .send({
                email: mockUser.email,
                ledgerSignature: 'invalidSignature',
            });

        expect(res.status).to.equal(403);
        expect(res.body.message).to.equal('Invalid Ledger signature.');
    });
});

// Rate Limiting Test (Example)
describe('Rate Limiting', () => {
    it('should reject excessive login attempts', async () => {
        for (let i = 0; i < 6; i++) {
            await request(app)
                .post('/api/auth/login')
                .send({
                    email: mockUser.email,
                    password: 'WrongPassword!',
                });
        }

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: mockUser.email,
                password: 'WrongPassword!',
            });

        expect(res.status).to.equal(429); // Too many requests
        expect(res.body.message).to.equal('Too many login attempts. Please try again later.');
    });
});
