const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const expressWinston = require('express-winston');
const config = require('./config'); // Centralized config
const dbConfig = require('./db/dbConfig'); // MongoDB connection config

// Load environment variables from .env file
require('dotenv').config();

const app = express();

// Middleware Setup
app.use(express.json()); // Parses incoming JSON requests
app.use(helmet()); // Secure HTTP headers
app.use(compression()); // Compress response bodies for performance

// CORS setup with specific origins for production
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*', // Allow specific origin in production
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate Limiting - Prevent abuse (e.g., brute force attacks)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

// MongoDB Connection (using dbConfig)
mongoose.connect(dbConfig.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch((err) => console.error('MongoDB connection error:', err));

// Input validation middleware (could use packages like express-validator or joi)
app.use((req, res, next) => {
  // Placeholder for request validation logic
  next();
});

// Winston Logger for production logging
if (process.env.NODE_ENV === 'production') {
  app.use(expressWinston.logger({
    transports: [
      new winston.transports.File({ filename: 'logfile.log' }),
    ],
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.json()
    ),
  }));
} else {
  // Development logging with Morgan
  app.use(morgan('dev'));
}

// Importing route files (placeholders)
const authRoutes = require('./routes/authRoutes');
const nftRoutes = require('./routes/nftRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// Define key routes
app.use('/auth', authRoutes);
app.use('/nft', nftRoutes);
app.use('/payments', paymentRoutes);

// Placeholder routes to be replaced with actual route files
app.get('/', (req, res) => {
  res.send('Welcome to Kosma Decentralized Social Media Platform');
});

// Error Handling for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'An internal error occurred. Please try again later.' });
});

// Graceful shutdown for MongoDB and the server
const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
});

module.exports = app;
git






