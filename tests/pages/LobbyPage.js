const { BasePage } = require('./BasePage');

/**
 * Game lobby page object with game management actions
 */
class LobbyPage extends BasePage {
  constructor(page, testContext) {
    super(page, testContext);
    this.url = 'http://localhost:3000/lobby';
    
    // Selectors
    this.selectors = {
      gameNameInput: 'input[placeholder*="game name"], input[name*="game"], input[placeholder*="name"]',
      createGameButton: 'button:has-text("Create")',
      joinGameButton: 'button:has-text("Join")',
      gameList: '.game-list, [class*="game"]',
      gameItems: '.game-item, [class*="game-item"]'
    };
  }

  /**
   * Verify we're on the lobby page
   */
  async verifyOnLobby(stepName = 'verify-on-lobby') {
    return await this.executeAction(stepName, 'lobby', async () => {
      await this.validateExpectedPage('lobby');
      console.log('✅ Confirmed on lobby page');
      return { onLobby: true, url: this.page.url() };
    });
  }


  /**
   * Fill the create game form
   */
  async fillCreateGame(gameName, stepName = 'fill-create-game') {
    return await this.executeAction(stepName, 'lobby', async () => {
      console.log(`\n🎯 FILLING CREATE GAME FORM: ${gameName}`);
      
      // Look for game name input
      const gameNameInput = await this.page.locator(this.selectors.gameNameInput).first();
      
      if (!(await gameNameInput.isVisible())) {
        throw new Error('Game name input not found on lobby page');
      }
      
      await gameNameInput.fill(gameName);
      console.log(`✅ Filled game name: ${gameName}`);
      
      return { gameName, filled: true };
    });
  }

  /**
   * Submit the create game form
   */
  async submitCreateGame(stepName = 'submit-create-game') {
    return await this.executeAction(stepName, 'lobby', async () => {
      console.log('\n🎯 SUBMITTING CREATE GAME FORM');
      
      // Look for create game button
      const createButton = await this.page.locator(this.selectors.createGameButton).first();
      
      if (!(await createButton.isVisible())) {
        throw new Error('Create Game button not found');
      }
      
      console.log('✅ Found Create Game button, clicking...');
      await createButton.click();
      
      const finalState = await this.getPageState();
      
      // Check if game creation was successful
      const gameCreated = finalState.url.includes('/game/') || 
                         finalState.messages.some(msg => msg.text.includes('created'));
      
      if (gameCreated) {
        console.log('✅ Game creation successful!');
      } else {
        console.log('❌ Game creation may have failed');
      }
      
      return { success: gameCreated, state: finalState };
    });
  }

  /**
   * Log out from the lobby
   */
  async logout(stepName = 'logout') {
    return await this.executeAction(stepName, 'lobby', async () => {
      console.log('\n🚪 LOGGING OUT');
      
      const logoutButton = await this.page.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();
      
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        console.log('✅ Logged out successfully');
        return { loggedOut: true };
      } else {
        console.log('❌ Logout button not found');
        return { loggedOut: false, reason: 'button not found' };
      }
    });
  }
}

// Robust CommonJS exports for maximum compatibility
module.exports = LobbyPage;           // default export = constructor
module.exports.default = LobbyPage;   // explicit default
module.exports.LobbyPage = LobbyPage; // named export
