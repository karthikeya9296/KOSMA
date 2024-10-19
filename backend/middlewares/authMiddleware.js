// Import necessary libraries and modules
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const LedgerJS = require('ledgerjs'); // LedgerJS for Ledger wallet integration
const User = require('./models/User'); // User model to fetch user data
const bcrypt = require('bcrypt'); // For password hashing
const rateLimit = require('express-rate-limit'); // For rate limiting
const redisClient = require('./redisClient'); // For session management with Redis

// Middleware to verify JWT tokens
async function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(403).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach user info to request object
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please log in again.' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ error: 'Invalid token.' });
        } else {
            return res.status(500).json({ error: 'Token verification failed.' });
        }
    }
}

// Middleware to check user roles with hierarchy support
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        const userRole = req.user?.role;
        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
}

// Middleware to refresh JWT token if close to expiration
function refreshToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) {
        const decoded = jwt.decode(token);
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

        // Check if the token is about to expire in the next 5 minutes
        if (decoded.exp - currentTime < 300) {
            const newToken = jwt.sign({ id: decoded.id, role: decoded.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.setHeader('x-new-token', newToken); // Send new token in response header
        }
    }
    next();
}

// Middleware for Ledger authentication
async function ledgerAuth(req, res, next) {
    const ledgerSignature = req.headers['ledger-signature'];
    if (!ledgerSignature) {
        return res.status(403).json({ error: 'Access denied. Ledger signature required.' });
    }

    try {
        const transport = await LedgerJS.transport.create();
        const ledgerDevice = new LedgerJS.YourLedgerDevice(transport); // Replace with actual Ledger device class
        const isValid = await ledgerDevice.verifySignature(ledgerSignature); // Custom method to verify signature

        if (!isValid) {
            return res.status(403).json({ error: 'Invalid Ledger signature.' });
        }
        next();
    } catch (error) {
        console.error('Ledger authentication failed:', error);
        return res.status(500).json({ error: 'Internal server error during Ledger authentication.' });
    }
}

// Middleware for rate limiting to prevent abuse or brute force attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});

// Middleware for session management (using Redis for token/session invalidation)
async function verifySession(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    const session = await redisClient.get(token);
    
    if (!session) {
        return res.status(401).json({ error: 'Session invalid. Please log in again.' });
    }
    next();
}

// Middleware to hash passwords during registration or update
async function hashPassword(req, res, next) {
    try {
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            req.body.password = await bcrypt.hash(req.body.password, salt);
        }
        next();
    } catch (error) {
        console.error('Password hashing failed:', error);
        res.status(500).json({ error: 'Password hashing failed.' });
    }
}

// Export the middleware functions
module.exports = {
    verifyToken,
    authorizeRoles,
    refreshToken,
    ledgerAuth,
    limiter,
    verifySession,
    hashPassword,
};
