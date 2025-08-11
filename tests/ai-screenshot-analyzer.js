const fs = require('fs');
const path = require('path');

class AIScreenshotAnalyzer {
  constructor(timestamp = null) {
    // Use the timestamp from Playwright environment if available, otherwise find most recent
    if (!timestamp) {
      timestamp = process.env.PLAYWRIGHT_TEST_TIMESTAMP || this.findMostRecentTestRun();
    }
    
    this.timestamp = timestamp;
    this.testRunDir = `./tests/test-results/${this.timestamp}`;
    this.screenshotDir = `${this.testRunDir}/test-screenshots`;
    this.analysisDir = `${this.testRunDir}/analysis-results`;
    
    // Common analysis prompt for both AI providers
    this.analysisPrompt = `Analyze this screenshot from my WallGame web application. Please provide:

1. **Visual Description**: What do you see on the page?
2. **UI/UX Analysis**: How does the interface look? Any issues?
3. **Functionality Assessment**: What features/buttons/forms are visible?
4. **User Experience**: Is the layout clear and intuitive?
5. **Technical Issues**: Any visual bugs, broken layouts, or missing elements?
6. **Recommendations**: Specific suggestions for improvement

Focus on details like button states, form fields, navigation, error messages, player counts, game state, and overall visual polish.`;
  }

  ensureAnalysisDirectoryExists() {
    if (!fs.existsSync(this.analysisDir)) {
      fs.mkdirSync(this.analysisDir, { recursive: true });
    }
  }

  findMostRecentTestRun() {
    const testResultsDir = './tests/test-results';
    if (!fs.existsSync(testResultsDir)) {
      throw new Error('No test results directory found. Run tests first!');
    }
    
    const timestampDirs = fs.readdirSync(testResultsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .filter(dirent => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(dirent.name))
      .map(dirent => dirent.name)
      .sort()
      .reverse();
    
    // Find the most recent directory with screenshots
    for (const timestamp of timestampDirs) {
      const screenshotDir = path.join(testResultsDir, timestamp, 'test-screenshots');
      if (fs.existsSync(screenshotDir)) {
        const screenshots = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png'));
        if (screenshots.length > 0) {
          const testResultsFile = path.join(testResultsDir, timestamp, 'test-results.json');
          const hasPlaywrightOutput = fs.existsSync(testResultsFile);
          console.log(`📁 Using most recent test run with screenshots: ${timestamp}${hasPlaywrightOutput ? ' (complete)' : ' (screenshots only)'}`);
          return timestamp;
        }
      }
    }
    
    throw new Error('No test runs with screenshots found. Run tests first!');
  }

  // Get available AI provider and API key
  getAIProvider() {
    if (process.env.OPENAI_API_KEY) {
      return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY };
    }
    if (process.env.ANTHROPIC_API_KEY) {
      return { provider: 'claude', apiKey: process.env.ANTHROPIC_API_KEY };
    }
    return null;
  }

  // Encode image to base64
  encodeImage(imagePath) {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  }

  async analyzeWithOpenAI(imagePath, apiKey) {
    const base64Image = this.encodeImage(imagePath);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: this.analysisPrompt },
            { 
              type: "image_url", 
              image_url: { url: `data:image/png;base64,${base64Image}` }
            }
          ]
        }],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  }

  async analyzeWithClaude(imagePath, apiKey) {
    const base64Image = this.encodeImage(imagePath);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: this.analysisPrompt },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64Image
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.content[0].text;
  }

  // Unified AI analysis method
  async analyzeScreenshot(imagePath) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('No AI API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.');
    }

    try {
      if (aiProvider.provider === 'openai') {
        return await this.analyzeWithOpenAI(imagePath, aiProvider.apiKey);
      } else {
        return await this.analyzeWithClaude(imagePath, aiProvider.apiKey);
      }
    } catch (error) {
      console.error(`${aiProvider.provider} analysis failed:`, error);
      return `Analysis failed: ${error.message}`;
    }
  }

  async getLatestScreenshots(limit = 5) {
    try {
      if (!fs.existsSync(this.screenshotDir)) {
        console.log('📁 No screenshots directory found');
        return [];
      }

      const files = fs.readdirSync(this.screenshotDir)
        .filter(file => file.endsWith('.png'))
        .map(file => ({
          name: file,
          path: path.join(this.screenshotDir, file),
          timestamp: fs.statSync(path.join(this.screenshotDir, file)).mtime,
          action: this.parseActionFromFilename(file)
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      return files;
    } catch (error) {
      console.error('Error reading screenshots:', error);
      return [];
    }
  }

  parseActionFromFilename(filename) {
    const parts = filename.replace('.png', '').split('-');
    const actionParts = parts.slice(0, -1);
    return actionParts.join(' ');
  }

  async analyzeAllRecent() {
    console.log('🤖 Screenshot Analysis System');
    console.log('==============================\n');

    const screenshots = await this.getLatestScreenshots();
    
    if (screenshots.length === 0) {
      console.log('❌ No screenshots found!');
      console.log('💡 Run a test first: npx playwright test');
      return;
    }

    console.log(`📸 Found ${screenshots.length} recent screenshots to analyze...\n`);

    // Check if AI analysis is available
    const aiProvider = this.getAIProvider();
    
    if (!aiProvider) {
      console.log('🔧 Analysis Mode: ⏭️ Skipping - No AI API Key');
      console.log('💡 To enable AI visual analysis, set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.');
      console.log('📊 Rich test data is already available in test-results.json');
      return;
    }

    console.log(`🔧 Analysis Mode: 🤖 AI Vision Analysis (${aiProvider.provider.toUpperCase()})`);

    // Only create analysis directory when we actually have results to save
    this.ensureAnalysisDirectoryExists();

    const analysisReport = {
      timestamp: new Date().toISOString(),
      analysisType: 'ai-vision',
      provider: aiProvider.provider,
      screenshots: [],
      totalAnalyzed: 0
    };

    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      console.log(`🔍 Analyzing ${i + 1}/${screenshots.length}: ${screenshot.action}`);
      console.log(`📁 File: ${screenshot.name}`);
      
      try {
        const analysis = await this.analyzeScreenshot(screenshot.path);

        console.log('✅ Analysis complete!\n');
        console.log('🤖 Analysis:');
        console.log('---------------');
        console.log(analysis);
        console.log('\n' + '='.repeat(80) + '\n');

        analysisReport.screenshots.push({
          name: screenshot.name,
          action: screenshot.action,
          timestamp: screenshot.timestamp,
          analysis: analysis
        });

        analysisReport.totalAnalyzed++;

        // Small delay to respect API rate limits
        if (i < screenshots.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Failed to analyze ${screenshot.name}:`, error.message);
        analysisReport.screenshots.push({
          name: screenshot.name,
          action: screenshot.action,
          timestamp: screenshot.timestamp,
          analysis: `Analysis failed: ${error.message}`
        });
      }
    }

    // Save detailed report
    const reportPath = path.join(this.analysisDir, `screenshot-analysis-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(analysisReport, null, 2));
    
    console.log(`📋 Detailed analysis report saved to: ${reportPath}`);
    console.log(`📊 Summary: Analyzed ${analysisReport.totalAnalyzed} screenshots using ${aiProvider.provider.toUpperCase()}`);

    return analysisReport;
  }

  async quickAnalysis(screenshotPath) {
    console.log(`🔍 Quick AI analysis of: ${screenshotPath}`);
    
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`Screenshot not found: ${screenshotPath}`);
    }

    const analysis = await this.analyzeScreenshot(screenshotPath);
    
    console.log('🤖 AI Analysis:');
    console.log('---------------');
    console.log(analysis);
    
    return analysis;
  }
}

// CLI usage
async function main() {
  const analyzer = new AIScreenshotAnalyzer();
  
  const args = process.argv.slice(2);
  if (args.length > 0) {
    // Analyze specific screenshot
    await analyzer.quickAnalysis(args[0]);
  } else {
    // Analyze all recent screenshots
    await analyzer.analyzeAllRecent();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AIScreenshotAnalyzer };