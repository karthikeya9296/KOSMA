// Import the database connection
const dbConnection = require('./dbConfig');

// Optional: Import Express or other frameworks (if needed)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; // Default port is 3000

// Handle database connection events
dbConnection.once('open', () => {
  console.log('✅ Database connection is open and ready');

  // Example: Start the Express server (or any other service)
  app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
  });
});

// Handle any database errors
dbConnection.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// Define routes (optional)
app.get('/', (req, res) => {
  res.send('Welcome to Kosma Decentralized Social Media!');
});
