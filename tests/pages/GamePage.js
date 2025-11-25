const { BasePage } = require('./BasePage');

/**
 * In-game page object with gameplay actions
 */
class GamePage extends BasePage {
  constructor(page, testContext) {
    super(page, testContext);
    
    // Selectors for game elements
    this.selectors = {
      gameBoard: 'canvas, [class*="board"], .game-board',
      structurePalette: '[class*="palette"], .structure-palette',
      chatPanel: '[class*="chat"], .chat-panel',
      chatInput: 'input[placeholder*="chat"], input[name*="message"]',
      chatSendButton: 'button:has-text("Send")',
      playerDashboard: '[class*="dashboard"], .player-dashboard',
      leaveGameButton: 'button:has-text("Leave"), button:has-text("Exit"), button:has-text("Back to Lobby")',
      structures: '[class*="structure"], .structure',
      cells: '[class*="cell"], .cell',
      // New testable selectors
      gameName: '[data-testid="game-name"]',
      onlineCount: '[data-testid="online-count"]',
      totalCount: '[data-testid="total-count"]',
      playerCount: '[data-testid="game-player-count"]'
    };
  }

  /**
   * Verify we're in an active game
   */
  async verifyInGame(stepName = 'verify-in-game') {
    return await this.executeAction(stepName, 'game', async () => {
      // Wait for game URL before validating
      await this.page.waitForURL(/\/game\//, { timeout: 10000 });
      await this.validateExpectedPage('game');
      console.log('✅ Confirmed in active game');
      return { inGame: true, url: this.page.url() };
    });
  }

  /**
   * Verify game information (name, player counts, etc.)
   * @param {Object} expected - Expected values to verify
   * @param {string} expected.gameName - Expected game name (partial match)
   * @param {number} expected.onlinePlayers - Expected online player count
   * @param {number} expected.totalPlayers - Expected total player count
   */
  async verifyGameInfo(expected = {}, stepName = 'verify-game-info') {
    return await this.executeAction(stepName, 'game', async () => {
      console.log('\n🔍 VERIFYING IN-GAME INFO');
      console.log(`   Expected:`, JSON.stringify(expected));
      
      // Wait for game data to load (not "Loading...")
      await this.page.waitForFunction(
        (selectors) => {
          const nameEl = document.querySelector(selectors.gameName);
          return nameEl && !nameEl.textContent?.includes('Loading');
        },
        this.selectors,
        { timeout: 10000 }
      );
      
      const gameInfo = await this.page.evaluate((selectors) => {
        const result = {
          gameName: null,
          onlinePlayers: null,
          totalPlayers: null
        };
        
        // Get game name
        const nameEl = document.querySelector(selectors.gameName);
        if (nameEl) {
          result.gameName = nameEl.textContent?.trim() || null;
        }
        
        // Get online count
        const onlineEl = document.querySelector(selectors.onlineCount);
        if (onlineEl) {
          result.onlinePlayers = parseInt(onlineEl.textContent?.trim() || '0', 10);
        }
        
        // Get total count
        const totalEl = document.querySelector(selectors.totalCount);
        if (totalEl) {
          result.totalPlayers = parseInt(totalEl.textContent?.trim() || '0', 10);
        }
        
        // Fallback: Try to parse from combined player count text
        if (result.onlinePlayers === null || result.totalPlayers === null) {
          const countEl = document.querySelector(selectors.playerCount);
          if (countEl) {
            const text = countEl.textContent || '';
            const match = text.match(/(\d+)\s*\/\s*(\d+)/);
            if (match) {
              result.onlinePlayers = parseInt(match[1], 10);
              result.totalPlayers = parseInt(match[2], 10);
            }
          }
        }
        
        return result;
      }, this.selectors);
      
      console.log(`   Actual:`, JSON.stringify(gameInfo));
      
      // Validate expected values
      const results = {
        gameName: { actual: gameInfo.gameName, expected: expected.gameName, match: true },
        onlinePlayers: { actual: gameInfo.onlinePlayers, expected: expected.onlinePlayers, match: true },
        totalPlayers: { actual: gameInfo.totalPlayers, expected: expected.totalPlayers, match: true }
      };
      
      // Check game name (partial match)
      if (expected.gameName !== undefined) {
        results.gameName.match = gameInfo.gameName?.includes(expected.gameName) || false;
      }
      
      // Check online players
      if (expected.onlinePlayers !== undefined) {
        results.onlinePlayers.match = gameInfo.onlinePlayers === expected.onlinePlayers;
      }
      
      // Check total players
      if (expected.totalPlayers !== undefined) {
        results.totalPlayers.match = gameInfo.totalPlayers === expected.totalPlayers;
      }
      
      // Log results
      const allMatch = Object.values(results).every(r => r.match);
      
      if (allMatch) {
        console.log('✅ All game info matches expected values');
      } else {
        const mismatches = [];
        for (const [key, value] of Object.entries(results)) {
          if (!value.match) {
            mismatches.push(`${key}: expected "${value.expected}", got "${value.actual}"`);
          }
        }
        throw new Error(`Game info mismatch: ${mismatches.join(', ')}`);
      }
      
      return {
        success: true,
        gameInfo,
        results
      };
    });
  }

  /**
   * Leave the current game
   */
  async leaveGame(stepName = 'leave-game') {
    return await this.executeAction(stepName, 'game', async () => {
      console.log('\n🚪 LEAVING GAME');
      
      // Try multiple possible selectors for leave/exit buttons
      const leaveSelectors = [
        'button:has-text("Back to Lobby")',
        'button:has-text("Leave")',
        'button:has-text("Exit")', 
        'button:has-text("Back")',
        'button:has-text("Lobby")',
        '[data-testid="leave-game-button"]',
        'a:has-text("Leave")',
        'a:has-text("Exit")',
        'a:has-text("Back")',
        'a:has-text("Lobby")',
        '[data-action="leave"]',
        '.leave-button',
        '.exit-button'
      ];
      
      let leaveButton = null;
      for (const selector of leaveSelectors) {
        const button = this.page.locator(selector).first();
        if (await button.isVisible()) {
          leaveButton = button;
          console.log(`✅ Found leave button with selector: ${selector}`);
          break;
        }
      }
      
      if (leaveButton) {
        await leaveButton.click();
        console.log('✅ Left game successfully');
        return { gameLeft: true };
      } else {
        console.log('❌ No leave button found. Available buttons:');
        const allButtons = await this.page.locator('button, a').all();
        for (const btn of allButtons) {
          const text = await btn.textContent();
          if (text && text.trim()) {
            console.log(`  - "${text.trim()}"`);
          }
        }
        return { gameLeft: false, reason: 'button not found' };
      }
    }, { stepName });
  }
}

module.exports = { GamePage };