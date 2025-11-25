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
      enterGameButton: 'button:has-text("Enter")',
      gameList: '.game-list, [class*="game"]',
      gameItems: '.game-item, [class*="game-item"]'
    };
    
    // Store the created game name for later reference
    this.createdGameName = null;
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
      this.createdGameName = gameName;
      console.log(`✅ Filled game name: ${gameName}`);
      
      return { gameName, filled: true };
    });
  }

  /**
   * Submit the create game form (no longer navigates to game)
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
      
      // Wait for game list to update
      await this.waitForStable(1000);
      
      const finalState = await this.getPageState();
      
      // Creating a game no longer navigates - we stay on lobby
      // Check that we're still on lobby and game appears in list
      const stayedOnLobby = finalState.url.includes('/lobby');
      
      if (stayedOnLobby) {
        console.log('✅ Game created, stayed on lobby');
      } else {
        console.log('⚠️ Unexpected navigation after game creation');
      }
      
      return { success: stayedOnLobby, state: finalState };
    });
  }

  /**
   * Verify player count for a game by name
   * @param {string} gameName - Name of the game to check
   * @param {number} expectedOnline - Expected online player count
   * @param {number} expectedTotal - Expected total player count
   */
  async verifyGamePlayerCount(gameName, expectedOnline, expectedTotal, stepName = 'verify-player-count') {
    return await this.executeAction(stepName, 'lobby', async () => {
      console.log(`\n🔢 VERIFYING PLAYER COUNT FOR: ${gameName}`);
      console.log(`   Expected: ${expectedOnline}/${expectedTotal}`);
      
      // Find the game row by name and extract player count
      const gameInfo = await this.page.evaluate((searchName) => {
        // Find all game rows/items in the list
        const gameElements = document.querySelectorAll('.game-item, [class*="game-item"], tr, .game-row');
        
        for (const el of gameElements) {
          const text = el.textContent || '';
          if (text.includes(searchName)) {
            // Look for player count pattern like "0/2" or "1/10"
            const match = text.match(/(\d+)\s*\/\s*(\d+)/);
            if (match) {
              return {
                found: true,
                online: parseInt(match[1], 10),
                total: parseInt(match[2], 10),
                fullText: text.substring(0, 200)
              };
            }
          }
        }
        
        // Also try looking at the body text for the pattern
        const bodyText = document.body.textContent || '';
        if (bodyText.includes(searchName)) {
          const lines = bodyText.split('\n');
          for (const line of lines) {
            if (line.includes(searchName)) {
              const match = line.match(/(\d+)\s*\/\s*(\d+)/);
              if (match) {
                return {
                  found: true,
                  online: parseInt(match[1], 10),
                  total: parseInt(match[2], 10),
                  fullText: line.substring(0, 200)
                };
              }
            }
          }
        }
        
        return { found: false, bodyPreview: bodyText.substring(0, 500) };
      }, gameName);
      
      console.log('📋 Game info found:', JSON.stringify(gameInfo, null, 2));
      
      if (!gameInfo.found) {
        console.log('❌ Game not found in list');
        return { 
          success: false, 
          reason: 'game not found',
          gameName,
          expectedOnline,
          expectedTotal 
        };
      }
      
      const countsMatch = gameInfo.online === expectedOnline && gameInfo.total === expectedTotal;
      
      if (countsMatch) {
        console.log(`✅ Player counts match: ${gameInfo.online}/${gameInfo.total}`);
      } else {
        console.log(`❌ Player counts MISMATCH: got ${gameInfo.online}/${gameInfo.total}, expected ${expectedOnline}/${expectedTotal}`);
      }
      
      return {
        success: countsMatch,
        actualOnline: gameInfo.online,
        actualTotal: gameInfo.total,
        expectedOnline,
        expectedTotal,
        gameName
      };
    });
  }

  /**
   * Join a specific game by name
   * @param {string} gameName - Name of the game to join
   */
  async joinGame(gameName, stepName = 'join-game') {
    return await this.executeAction(stepName, 'lobby', async () => {
      console.log(`\n🎮 JOINING GAME: ${gameName}`);
      
      // Find the game row and click its Join button
      const joined = await this.page.evaluate((searchName) => {
        const gameElements = document.querySelectorAll('.game-item, [class*="game-item"], tr, .game-row, div');
        
        for (const el of gameElements) {
          const text = el.textContent || '';
          if (text.includes(searchName)) {
            // Look for Join button within this element
            const joinBtn = el.querySelector('button');
            if (joinBtn && (joinBtn.textContent.includes('Join') || joinBtn.textContent.includes('Enter') || joinBtn.textContent.includes('Open'))) {
              joinBtn.click();
              return { clicked: true, buttonText: joinBtn.textContent };
            }
          }
        }
        return { clicked: false };
      }, gameName);
      
      if (joined.clicked) {
        console.log(`✅ Clicked ${joined.buttonText} button for game`);
        // Wait for navigation to game page
        await this.page.waitForURL(/\/game\//, { timeout: 10000 });
        console.log('✅ Navigated to game page');
        return { success: true, gameName };
      } else {
        // Fallback: try to find any Join button if game row approach failed
        const joinButton = await this.page.locator(`button:has-text("Join")`).first();
        if (await joinButton.isVisible()) {
          await joinButton.click();
          await this.page.waitForURL(/\/game\//, { timeout: 10000 });
          console.log('✅ Clicked Join button (fallback) and navigated');
          return { success: true, gameName, fallback: true };
        }
        
        console.log('❌ Could not find Join button for game');
        return { success: false, reason: 'join button not found', gameName };
      }
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
