<<<<<<< HEAD
// Import required packages
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables from .env

// Construct MongoDB connection string using .env variables
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbName = process.env.DB_NAME;

const connectionString = `mongodb://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}?authSource=admin`;

// Connection options to ensure high availability and auto-reconnection
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  poolSize: 10,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  autoReconnect: true,
};

// Connect to MongoDB
mongoose.connect(connectionString, options);

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Successfully connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully');
});

// Export the connection for use across the project
module.exports = mongoose.connection;
=======
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1); // Exit process with failure
  }
};

module.exports = { connectDB };
>>>>>>> 44a5f1a5e8fc62de5a717d9f8b677cad74761914
