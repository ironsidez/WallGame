/**
 * Test runner that ensures a single timestamp is used across all test artifacts
 */
const { execSync } = require('child_process');

// Generate timestamp ONCE at the start
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

console.log(`\n🕐 Test timestamp: ${timestamp}`);
console.log(`📁 All results will go to: tests/test-results/${timestamp}\n`);

// Run Playwright with the timestamp in environment
execSync('npx playwright test --headed', {
  stdio: 'inherit',
  env: {
    ...process.env,
    TEST_TIMESTAMP: timestamp
  }
});
