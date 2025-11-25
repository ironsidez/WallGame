const fs = require('fs');
const path = require('path');

/**
 * Test context manager that handles setup and coordination between test components
 */
class TestContext {
  constructor(testInfo) {
    this.testInfo = testInfo;
    this.startTime = Date.now();
    this.apiRequests = [];
    this.apiResponses = [];
    
    // Use TEST_TIMESTAMP from npm script to ensure all artifacts go to same folder
    const timestamp = process.env.TEST_TIMESTAMP || 
      new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    // Debug logging
    console.log('🔍 TestContext Debug Info:');
    console.log('  TEST_TIMESTAMP env:', process.env.TEST_TIMESTAMP);
    console.log('  Using timestamp:', timestamp);

    if (testInfo) {
      console.log('  testInfo available:', !!testInfo);
      console.log('  testInfo.outputDir:', testInfo.outputDir);
      console.log('  testInfo.title:', testInfo.title);
    }

    // Always use the TEST_TIMESTAMP folder for consistency
    this.testDir = path.join(process.cwd(), 'tests', 'test-results', timestamp);
    this.screenshotsDir = path.join(this.testDir, 'screenshots');
    
    console.log('  Test directory:', this.testDir);
    
    this.setupDirectories();
  }

  setupDirectories() {
    console.log('📁 Setting up test directories...');
    console.log('📁 Base test directory:', this.testDir);
    console.log('📁 Screenshots directory:', this.screenshotsDir);
    
    // Create the main test results directory
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }
    
    // Create the screenshots subdirectory    
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  /**
   * Setup network monitoring for API requests
   */
  setupNetworkMonitoring(page) {
    console.log('🌐 Setting up network monitoring...');
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        this.apiRequests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData(),
          timestamp: this.timestamp
        });
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        let responseBody = '';
        try {
          responseBody = await response.text();
        } catch (e) {
          responseBody = 'Unable to read response body';
        }
        this.apiResponses.push({
          url: response.url(),
          status: response.status(),
          body: responseBody,
          timestamp: this.timestamp
        });
      }
    });
  }

  /**
   * Log all API activity captured during the test
   */
  logApiActivity() {
    console.log('\n🔍 API ACTIVITY SUMMARY:');
    console.log(`📤 Requests captured: ${this.apiRequests.length}`);
    console.log(`📥 Responses captured: ${this.apiResponses.length}`);
    
    if (this.apiRequests.length > 0) {
      console.log('\n📤 API REQUESTS:');
      console.log(JSON.stringify(this.apiRequests, null, 2));
    }
    
    if (this.apiResponses.length > 0) {
      console.log('\n📥 API RESPONSES:');
      console.log(JSON.stringify(this.apiResponses, null, 2));
    }
  }

  /**
   * Save test results to file
   */
  saveTestResults(testData) {
    const resultsFile = path.join(this.testDir, 'test-details.json');
    const results = {
      timestamp: this.timestamp,
      testInfo: {
        title: this.testInfo?.title,
        file: this.testInfo?.file,
        duration: Date.now() - this.startTime
      },
      apiActivity: {
        requests: this.apiRequests,
        responses: this.apiResponses
      },
      testData: testData
    };
    
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`💾 Test results saved to: ${resultsFile}`);
  }

  /**
   * Run screenshot analysis
   */
  async runScreenshotAnalysis() {
    console.log('\n🤖 Triggering screenshot analysis...');
    try {
      const { AIScreenshotAnalyzer } = require('../ai-screenshot-analyzer');
      const aiAnalyzer = new AIScreenshotAnalyzer(this.timestamp);
      await aiAnalyzer.analyzeAllRecent();
    } catch (error) {
      console.log('❌ Screenshot analysis failed:', error.message);
      console.log('💡 You can run it manually with: node ai-screenshot-analyzer.js');
    }
  }

  /**
   * Complete test with cleanup and analysis
   */
  async complete(testData = {}) {
    console.log('\n🎉 TEST EXECUTION COMPLETE!');
    console.log('📁 Check test results directory for artifacts');
    
    this.logApiActivity();
    this.saveTestResults(testData);
    
    const duration = Date.now() - this.startTime;
    console.log(`⏱️ Total test duration: ${duration}ms`);
  }
}

module.exports = TestContext;
