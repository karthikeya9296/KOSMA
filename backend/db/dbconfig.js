// Import required packages
const mongoose = require('mongoose');
require('dotenv').config();

// Extract environment variables
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;

// Create the MongoDB connection string
const connectionString = `mongodb://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}?authSource=admin`;

// Define connection options for robustness
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  poolSize: 10,               // Maintain up to 10 socket connections
  socketTimeoutMS: 45000,     // Close sockets after 45 seconds of inactivity
  connectTimeoutMS: 10000,    // Timeout after 10 seconds of trying to connect
  autoReconnect: true,        // Automatically try to reconnect
};

// Connect to MongoDB
mongoose.connect(connectionString, options);

// Event handlers for MongoDB connection
mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

// Export the connection
module.exports = mongoose.connection;
