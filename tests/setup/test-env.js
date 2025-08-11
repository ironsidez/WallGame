const dotenv = require('dotenv');
const path = require('path');

// Load environment file for testing
dotenv.config({ path: path.join(__dirname, '../../packages/server/.env.local') });

// Export test credentials for use in tests
const TEST_CREDENTIALS = {
  username: process.env.TEST_USERNAME,
  password: process.env.TEST_PASSWORD
};

console.log('🔐 Test environment loaded with credentials:', {
  username: TEST_CREDENTIALS.username,
  password: '[MASKED]'
});

module.exports = { TEST_CREDENTIALS };
