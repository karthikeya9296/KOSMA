// Import necessary libraries
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const AccessControl = require('accesscontrol');

// Create a router
const router = express.Router();

// MongoDB User model
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    blockchainAddress: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    role: { type: String, required: true, default: 'user' }, // Default role is 'user'
}));

// Access Control setup
const ac = new AccessControl();
ac.grant('user').readOwn('profile').updateOwn('profile');
ac.grant('content_creator').extend('user').createOwn('content').readAny('content');

// Nodemailer transport setup for email verification
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Middleware for JWT authentication
const authenticateJWT = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

// Middleware for role-based access control
const checkRole = (action, resource) => (req, res, next) => {
    const permission = ac.can(req.user.role)[action](resource);
    if (!permission.granted) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    next();
};

/**
 * Route for user registration
 * Hashes the password, generates a blockchain address, assigns roles, and sends email verification
 */
router.post('/register', [
    body('username').isString().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role } = req.body;

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a unique blockchain address
        const wallet = ethers.Wallet.createRandom();
        const blockchainAddress = wallet.address;

        // Generate email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Create a new user
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            blockchainAddress,
            role: role || 'user', // Default role to 'user'
            verificationToken
        });

        await newUser.save();

        // Send verification email
        const verificationUrl = `${process.env.BASE_URL}/verify-email?token=${verificationToken}`;
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Email Verification - Kosma Platform',
            html: `<p>Please verify your email by clicking <a href="${verificationUrl}">here</a>.</p>`
        });

        res.status(201).json({ message: 'User registered successfully. Please check your email to verify your account.', blockchainAddress });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Route to verify email after registration
 * Verifies the email by matching the token from the URL query parameter
 */
router.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    try {
        // Find user by verification token
        const user = await User.findOne({ verificationToken: token });
        if (!user) return res.status(400).json({ message: 'Invalid or expired verification token' });

        // Update user to mark email as verified
        user.emailVerified = true;
        user.verificationToken = null;
        await user.save();

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Route for user login
 * Verifies user credentials and generates a JWT for authentication
 */
router.post('/login', [
    body('email').isEmail(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        // Ensure email is verified
        if (!user.emailVerified) {
            return res.status(403).json({ message: 'Email not verified. Please verify your email to login.' });
        }

        // Generate JWT
        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Route for user logout
 * As JWT is stateless, logout is handled by client side by removing the token.
 */
router.post('/logout', authenticateJWT, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// Export the router
module.exports = router;
