// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Generate timestamp for this test run and make it available globally
// Cache the timestamp to prevent multiple executions from creating different values
const timestamp = process.env.PLAYWRIGHT_TIMESTAMP_CACHE || 
  (() => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    process.env.PLAYWRIGHT_TIMESTAMP_CACHE = ts;
    return ts;
  })();
const testRunDir = `tests/test-results/${timestamp}`;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
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
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev:server',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
