const dotenv = require('dotenv');
const path = require('path');

// Load environment file for testing
dotenv.config({ path: path.join(__dirname, '../../packages/server/.env.local') });

// Export test credentials for use in tests
// Admin account (can create/delete games)
const ADMIN_CREDENTIALS = {
  username: process.env.TEST_ADMIN_USERNAME,
  password: process.env.TEST_ADMIN_PASSWORD
};

// Regular user account (for multi-user testing)
const USER_CREDENTIALS = {
  username: process.env.TEST_USERNAME,
  password: process.env.TEST_PASSWORD
};

console.log('🔐 Test environment loaded with credentials:', {
  admin: ADMIN_CREDENTIALS.username,
  user: USER_CREDENTIALS.username,
  passwords: '[MASKED]'
});

module.exports = { ADMIN_CREDENTIALS, USER_CREDENTIALS };
