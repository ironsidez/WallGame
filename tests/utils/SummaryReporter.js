const fs = require('fs');
const path = require('path');

/**
 * Custom Playwright reporter that generates a clean, scannable test summary
 */
class SummaryReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile || 'test-summary.txt';
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  onBegin(config, suite) {
    this.startTime = new Date();
    this.config = config;
  }

  onTestEnd(test, result) {
    this.results.push({
      title: test.title,
      status: result.status,
      duration: result.duration,
      error: result.error?.message || null
    });
  }

  onEnd(result) {
    this.endTime = new Date();
    
    const timestamp = process.env.TEST_TIMESTAMP || 
      new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputDir = path.join(process.cwd(), 'tests', 'test-results', timestamp);
    const outputPath = path.join(outputDir, 'summary.txt');
    
    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const summary = this.generateSummary(result);
    fs.writeFileSync(outputPath, summary);
    
    // Also print to console
    console.log('\n' + summary);
  }

  generateSummary(overallResult) {
    const totalDuration = this.endTime - this.startTime;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    
    const lines = [
      '═'.repeat(60),
      '  WALLGAME TEST SUMMARY',
      '═'.repeat(60),
      '',
      `  📅 Date:     ${this.startTime.toLocaleString()}`,
      `  ⏱️  Duration: ${(totalDuration / 1000).toFixed(2)}s`,
      '',
      '─'.repeat(60),
      '  RESULTS',
      '─'.repeat(60),
      '',
      `  ✅ Passed:   ${passed}`,
      `  ❌ Failed:   ${failed}`,
      `  ⏭️  Skipped:  ${skipped}`,
      `  📊 Total:    ${this.results.length}`,
      '',
    ];
    
    // Add test details
    lines.push('─'.repeat(60));
    lines.push('  TEST DETAILS');
    lines.push('─'.repeat(60));
    lines.push('');
    
    for (const test of this.results) {
      const icon = test.status === 'passed' ? '✅' : 
                   test.status === 'failed' ? '❌' : '⏭️';
      const duration = (test.duration / 1000).toFixed(2);
      lines.push(`  ${icon} ${test.title}`);
      lines.push(`     Duration: ${duration}s`);
      
      if (test.error) {
        lines.push(`     Error: ${test.error.split('\n')[0]}`);
      }
      lines.push('');
    }
    
    // Final status
    lines.push('═'.repeat(60));
    if (failed === 0) {
      lines.push('  🎉 ALL TESTS PASSED!');
    } else {
      lines.push(`  ⚠️  ${failed} TEST(S) FAILED`);
    }
    lines.push('═'.repeat(60));
    
    return lines.join('\n');
  }
}

module.exports = SummaryReporter;
