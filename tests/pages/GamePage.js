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
      leaveGameButton: 'button:has-text("Leave"), button:has-text("Exit")',
      structures: '[class*="structure"], .structure',
      cells: '[class*="cell"], .cell'
    };
  }

  /**
   * Verify we're in an active game
   */
  async verifyInGame(stepName = 'verify-in-game') {
    return await this.executeAction(stepName, 'game', async () => {
      await this.validateExpectedPage('game');
      console.log('✅ Confirmed in active game');
      return { inGame: true, url: this.page.url() };
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
        'button:has-text("Leave")',
        'button:has-text("Exit")', 
        'button:has-text("Back")',
        'button:has-text("Lobby")',
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