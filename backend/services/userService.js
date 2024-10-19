// Import necessary libraries and modules
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming a User model is defined in models/User.js
const { UnlockProtocol } = require('../services/unlockProtocol'); // Assuming a service for Unlock Protocol
const { StoryProtocol } = require('../services/storyProtocol'); // Assuming a service for Story Protocol
const Ledger = require('ledgerjs'); // Assuming LedgerJS is installed

// Configure Nodemailer for password reset
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use your email service
    auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASS, // Your email password
    },
});

// User Service Class
class UserService {
    // Profile Management
    async getProfile(userId) {
        const user = await User.findById(userId).select('-password'); // Exclude password
        if (!user) throw new Error('User not found.');
        return user;
    }

    async updateProfile(userId, profileData) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found.');

        // Update profile fields
        user.username = profileData.username || user.username;
        user.bio = profileData.bio || user.bio;
        user.profilePicture = profileData.profilePicture || user.profilePicture;

        await user.save();
        return { message: 'Profile updated successfully.' };
    }

    async connectLedger(userId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found.');

        // Logic to connect Ledger wallet (pseudo-code)
        const ledgerConnection = await Ledger.connect(); // Mock LedgerJS connection
        user.ledgerConnected = true; // Update connection status
        await user.save();

        return { message: 'Ledger wallet connected successfully.' };
    }

    // Password Management
    async updatePassword(userId, oldPassword, newPassword) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found.');

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) throw new Error('Old password is incorrect.');

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        return { message: 'Password updated successfully.' };
    }

    async resetPassword(email) {
        const user = await User.findOne({ email });
        if (!user) throw new Error('User not found.');

        const token = this.generateResetToken(user._id);
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset',
            text: `Please reset your password by clicking on the following link: ${resetLink}`,
        };

        await transporter.sendMail(mailOptions);
        return { message: 'Password reset link sent to your email.' };
    }

    generateResetToken(userId) {
        // Generate a secure token (could use JWT or a simple random string)
        return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    }

    async verifyResetToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            if (!user) throw new Error('Invalid token.');
            return user;
        } catch (error) {
            throw new Error('Invalid or expired token.');
        }
    }

    async setNewPassword(token, newPassword) {
        const user = await this.verifyResetToken(token);

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        return { message: 'Password has been reset successfully.' };
    }

    // Membership and Royalty Data
    async getMembershipStatus(userId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found.');

        // Fetch membership data from Unlock Protocol
        const memberships = await UnlockProtocol.getMemberships(userId);
        return memberships;
    }

    async getRoyaltyInformation(userId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found.');

        // Fetch royalty data from Story Protocol
        const royalties = await StoryProtocol.getRoyalties(userId);
        return royalties;
    }
}

// Export UserService
module.exports = new UserService();
