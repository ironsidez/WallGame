// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Timestamp is set by npm run test script BEFORE playwright starts
// This ensures all reporters and outputs use the exact same folder
const timestamp = process.env.TEST_TIMESTAMP || 
  new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const testRunDir = `tests/test-results/${timestamp}`;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  reporter: [
    // Custom summary reporter for easy scanning
    ['./tests/utils/SummaryReporter.js'],
    // JSON reporter for programmatic access
    ['json', { outputFile: `${testRunDir}/test-results.json` }],
    // HTML reporter without auto-opening browser
    ['html', { outputFolder: `${testRunDir}/html-report`, open: 'never' }],
    // Line reporter for terminal output
    ['line']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Add timeouts to prevent hanging
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Send all artifacts (screenshots, traces, videos) to a dedicated folder
      outputDir: testRunDir,
    },
  ],

  webServer: [
    {
      command: 'npm run dev:client',
      port: 3000,
      reuseExistingServer: true, // Always reuse if server is running
      timeout: 60000,
    },
    {
      command: 'npm run dev:server',
      port: 3001,
      reuseExistingServer: true, // Always reuse if server is running
      timeout: 60000,
    },
  ],
});
