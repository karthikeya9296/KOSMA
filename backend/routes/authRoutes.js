// Import necessary libraries
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const speakeasy = require('speakeasy'); // For 2FA
const qrcode = require('qrcode'); // For QR code generation

// Create a router
const router = express.Router();

// MongoDB User model
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    blockchainAddress: { type: String, required: true },
    securityQuestion: { type: String, required: true },  // New field for security question
    securityAnswer: { type: String, required: true },    // New field for security answer
    twoFactorSecret: { type: String },                   // New field for 2FA secret
}));

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

// Error-handling middleware
function errorHandler(err, req, res, next) {
    console.error(err.stack); // Log error for debugging
    res.status(500).json({
        message: "An internal server error occurred.",
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
}

// Rate limiting for login route
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per window
    message: 'Too many login attempts, please try again later.'
});

// CAPTCHA verification function
const verifyCaptcha = async (token) => {
    const secretKey = process.env.RECAPTCHA_SECRET;
    const response = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, null, {
        params: {
            secret: secretKey,
            response: token
        }
    });
    return response.data.success;
};

/**
 * Registers a new user, hashes their password, assigns a blockchain address,
 * and stores their details in MongoDB.
 *
 * @route POST /register
 */
router.post('/register', [
    body('username').isString().notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{6,}$/)
        .withMessage('Password must contain at least one uppercase letter, one number, and be at least 6 characters long'),
    body('securityQuestion').isString().notEmpty().withMessage('Security question is required'),
    body('securityAnswer').isString().notEmpty().withMessage('Security answer is required'),
    body('captchaToken').notEmpty().withMessage('CAPTCHA verification is required'),
    body('agreeTerms').equals('true').withMessage('You must agree to the Terms of Service and Privacy Policy'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation errors occurred',
            errors: errors.array().map(error => ({
                field: error.param,
                message: error.msg
            }))
        });
    }

    const { username, email, password, securityQuestion, securityAnswer, captchaToken } = req.body;

    try {
        // Verify CAPTCHA
        const captchaVerified = await verifyCaptcha(captchaToken);
        if (!captchaVerified) {
            return res.status(400).json({ message: 'Please verify that you are not a robot.' });
        }

        // Pre-check for existing username or email
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'The username or email you entered is already in use. Please try again with a different one.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generate a unique blockchain address
        const wallet = ethers.Wallet.createRandom();
        const blockchainAddress = wallet.address;

        // Create a new user
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            blockchainAddress,
            securityQuestion,
            securityAnswer
        });

        await newUser.save();
        res.status(201).json({ message: 'User registered successfully', blockchainAddress });
    } catch (error) {
        next(error); // Pass error to the error handler
    }
});

/**
 * Authenticates a user using email and password,
 * returning a JWT if successful.
 *
 * @route POST /login
 */
router.post('/login', loginLimiter, [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
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

        // Generate JWT token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        res.json({ token });
    } catch (error) {
        next(error); // Pass error to the error handler
    }
});

/**
 * Logs out the user by invalidating the JWT on the client side.
 * 
 * @route POST /logout
 */
router.post('/logout', authenticateJWT, (req, res) => {
    // In JWT, 
