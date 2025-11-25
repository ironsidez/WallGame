const fs = require('fs');
const path = require('path');

/**
 * Base page class with common functionality for all pages
 */
const { maskSensitiveData } = require('../utils/security');

class BasePage {
  constructor(page, testContext) {
    this.page = page;
    this.testContext = testContext;
  }

  /**
   * Navigate to a specific URL
   */
  async goto(url) {
    await this.page.goto(url);
  }

  /**
   * Take a screenshot with consistent naming using TestContext's directory
   */
  async takeScreenshot(name, options = {}) {
    const screenshotPath = path.join(this.testContext.screenshotsDir, `${name}.png`);
    
    await this.page.screenshot({ 
      path: screenshotPath,
      fullPage: true,
      ...options 
    });
    console.log(`📸 Screenshot saved: ${name}.png to ${this.testContext.screenshotsDir}`);
  }

  /**
   * Wait for network to be idle OR timeout, whichever comes first
   */
  async waitForStable(timeout = 500) {
    await Promise.race([
      this.page.waitForLoadState('networkidle'),
      this.page.waitForTimeout(timeout)
    ]);
  }

  /**
   * Extract page state for debugging
   */
  async getPageState() {
    return await this.page.evaluate(() => {
      // Safe localStorage access
      let localStorageData = {};
      try {
        localStorageData = {
          user: localStorage.getItem('user'),
          token: localStorage.getItem('token'),
          auth: localStorage.getItem('wallgame-auth')
        };
      } catch (error) {
        localStorageData = { error: 'localStorage access denied' };
      }

      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.textContent?.substring(0, 1000),
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim()),
        messages: Array.from(document.querySelectorAll('.message, .error, .success, .warning')).map(msg => ({
          className: msg.className,
          text: msg.textContent?.trim()
        })),
        localStorage: localStorageData
      };
    });
  }

  /**
   * Gather comprehensive page information including state, buttons, inputs, etc.
   */
  async getFullPageInfo() {
    const info = await this.page.evaluate(() => {
      // Safe localStorage access
      let localStorageData = {};
      try {
        localStorageData = {
          user: localStorage.getItem('user'),
          token: localStorage.getItem('token'),
          auth: localStorage.getItem('wallgame-auth')
        };
      } catch (error) {
        localStorageData = { error: 'localStorage access denied' };
      }

      return {
        // Page state
        url: window.location.href,
        title: document.title,
        bodyText: document.body.textContent?.substring(0, 1000),
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim()),
        messages: Array.from(document.querySelectorAll('.message, .error, .success, .warning')).map(msg => ({
          className: msg.className,
          text: msg.textContent?.trim()
        })),
        localStorage: localStorageData,
        
        // Buttons
        buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent?.trim(),
          disabled: btn.disabled,
          className: btn.className
        })),
        
        // Inputs
        inputs: Array.from(document.querySelectorAll('input')).map(input => ({
          name: input.name,
          type: input.type,
          placeholder: input.placeholder,
          value: input.value
        }))
      };
    });

    return {
      ...info,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Gather and log comprehensive page information for debugging - more efficient combined version
   */
  async getAndLogFullPageInfo(stepName) {
    const info = await this.getFullPageInfo();
    const maskedInfo = maskSensitiveData(info);
    
    console.log(`\n📋 ${stepName.toUpperCase()} FULL PAGE INFO:`);
    console.log('URL:', maskedInfo.url);
    console.log('Title:', maskedInfo.title);
    
    if (maskedInfo.headings.length > 0) {
      console.log('Headings:', maskedInfo.headings);
    }
    
    if (maskedInfo.messages.length > 0) {
      console.log('Messages:', JSON.stringify(maskedInfo.messages, null, 2));
    }
    
    if (maskedInfo.buttons.length > 0) {
      console.log('Buttons:', maskedInfo.buttons.map(btn => `"${btn.text}" (${btn.disabled ? 'disabled' : 'enabled'})`));
    }
    
    if (maskedInfo.inputs.length > 0) {
      console.log('Inputs:', maskedInfo.inputs.map(input => {
        const displayValue = input.value ? '[FILLED]' : `"${input.placeholder || 'empty'}"`;
        return `${input.name || input.type}: ${displayValue}`;
      }));
    }
    
    console.log('Auth state:', {
      user: maskedInfo.localStorage.user,
      token: maskedInfo.localStorage.token,
      auth: maskedInfo.localStorage.auth
    });
    console.log('Timestamp:', maskedInfo.timestamp);
    
    return info;
  }

  /**
   * Comprehensive action wrapper that validates page, captures state, logs, and screenshots
   * @param {string} stepName - Name of the step being performed
   * @param {string} expectedPage - Expected page identifier (e.g. 'login', 'lobby', 'game')
   * @param {Function} action - The actual action function to execute
   * @param {Object} options - Additional options (skipPreValidation: boolean, stabilityTimeout: number)
   */
  async executeAction(stepName, expectedPage, action, options = {}) {
    
    try { 
      // Execute the actual action with timeout
      console.log(`\n🔄 Executing action: ${stepName}`);
      const result = await Promise.race([
        action(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Action timeout after 30s`)), 30000)
        )
      ]);
      
      // Post-action validation and logging
      await this.waitForStable(options.stabilityTimeout || 200);
      
      // Capture and log post-action state
      const postActionInfo = await this.getAndLogFullPageInfo(`POST-${stepName}`);
      
      // Take post-action screenshot
      await this.takeScreenshot(`${stepName}`);
      
      console.log(`✅ Action completed successfully: ${stepName}`);
      
      return {
        success: true,
        result,
        postState: postActionInfo,
        stepName,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Action failed: ${stepName}`, error.message);
      
      // Take error screenshot
      await this.takeScreenshot(`${stepName}-error`);
      
      // Log error state
      await this.getAndLogFullPageInfo(`ERROR-${stepName}`);
      
      throw new Error(`Action '${stepName}' failed: ${error.message}`);
    }
  }

  /**
   * Validate that we're on the expected page - simplified URL-only check
   * @param {string} expectedPage - Expected page identifier
   */
  async validateExpectedPage(expectedPage) {
    const url = this.page.url().toLowerCase();
    const expectedPageLower = expectedPage.toLowerCase();
    
    if (!url.includes(expectedPageLower)) {
      const error = `Expected to be on '${expectedPage}' page, but current URL is: ${this.page.url()}`;
      throw new Error(error);
    }
    
    console.log(`✅ Page validation passed: Currently on '${expectedPage}' page`);
  }
}

module.exports = { BasePage };
