/**
 * Playwright Global Setup
 * This runs ONCE at the start of each test run (before any tests)
 * Uses TEST_TIMESTAMP set by npm run test script
 */

module.exports = async () => {
  // Use timestamp from npm script (set before Playwright starts)
  const timestamp = process.env.TEST_TIMESTAMP || 
    new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  // Also set as TEST_RUN_TIMESTAMP for tests that reference it
  process.env.TEST_RUN_TIMESTAMP = timestamp;
  
  console.log(`\n🕐 Test run timestamp: ${timestamp}`);
  console.log(`📁 Results will be saved to: tests/test-results/${timestamp}\n`);
};
