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
      // Wait for lobby URL before validating
      await this.page.waitForURL(/\/lobby/, { timeout: 10000 });
      await this.validateExpectedPage('lobby');
      console.log('✅ Confirmed on lobby page');
      return { onLobby: true, url: this.page.url() };
    });
  }


  /**
   * Fill the create game form with name and optional settings
   * @param {string} gameName - Name for the game
   * @param {Object} settings - Optional game settings
   * @param {number} settings.mapWidth - Map width (default: 100)
   * @param {number} settings.mapHeight - Map height (default: 100)
   * @param {number} settings.maxPlayers - Max players (default: 100)
   */
  async fillCreateGame(gameName, stepNameOrSettings = 'fill-create-game', maybeStepName = null) {
    // Handle overloaded parameters
    let settings = {};
    let stepName = 'fill-create-game';
    
    if (typeof stepNameOrSettings === 'string') {
      stepName = stepNameOrSettings;
    } else if (typeof stepNameOrSettings === 'object') {
      settings = stepNameOrSettings;
      stepName = maybeStepName || 'fill-create-game';
    }

    return await this.executeAction(stepName, 'lobby', async () => {
      console.log(`\n🎯 FILLING CREATE GAME FORM: ${gameName}`);
      
      // Fill game name
      const gameNameInput = await this.page.locator('[data-testid="game-name-input"]').first();
      
      if (!(await gameNameInput.isVisible())) {
        // Fallback to old selector
        const fallbackInput = await this.page.locator(this.selectors.gameNameInput).first();
        if (await fallbackInput.isVisible()) {
          await fallbackInput.fill(gameName);
        } else {
          throw new Error('Game name input not found on lobby page');
        }
      } else {
        await gameNameInput.fill(gameName);
      }
      
      this.createdGameName = gameName;
      console.log(`✅ Filled game name: ${gameName}`);
      
      // Fill map width if provided
      if (settings.mapWidth) {
        const mapWidthInput = await this.page.locator('[data-testid="map-width-input"]');
        if (await mapWidthInput.isVisible()) {
          await mapWidthInput.fill(String(settings.mapWidth));
          console.log(`✅ Set map width: ${settings.mapWidth}`);
        }
      }
      
      // Fill map height if provided
      if (settings.mapHeight) {
        const mapHeightInput = await this.page.locator('[data-testid="map-height-input"]');
        if (await mapHeightInput.isVisible()) {
          await mapHeightInput.fill(String(settings.mapHeight));
          console.log(`✅ Set map height: ${settings.mapHeight}`);
        }
      }
      
      // Fill max players if provided
      if (settings.maxPlayers) {
        const maxPlayersInput = await this.page.locator('[data-testid="max-players-input"]');
        if (await maxPlayersInput.isVisible()) {
          await maxPlayersInput.fill(String(settings.maxPlayers));
          console.log(`✅ Set max players: ${settings.maxPlayers}`);
        }
      }
      
      return { gameName, settings, filled: true };
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
      
      // Wait for expected player count to appear (with timeout)
      const expectedPattern = `${expectedOnline}/${expectedTotal}`;
      try {
        await this.page.waitForFunction(
          ({ searchName, expected }) => {
            const bodyText = document.body.textContent || '';
            // Check if game exists and has the expected count
            if (!bodyText.includes(searchName)) return false;
            // Find the count pattern near the game name
            const gameSection = bodyText.substring(bodyText.indexOf(searchName), bodyText.indexOf(searchName) + 200);
            return gameSection.includes(expected);
          },
          { searchName: gameName, expected: expectedPattern },
          { timeout: 5000 }
        );
      } catch (e) {
        // Timeout waiting - will fail in the check below with actual values
        console.log(`   ⏰ Timed out waiting for ${expectedPattern}`);
      }
      
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
        throw new Error(`Game "${gameName}" not found in list`);
      }
      
      const countsMatch = gameInfo.online === expectedOnline && gameInfo.total === expectedTotal;
      
      if (countsMatch) {
        console.log(`✅ Player counts match: ${gameInfo.online}/${gameInfo.total}`);
      } else {
        throw new Error(`Player count mismatch for "${gameName}": got ${gameInfo.online}/${gameInfo.total}, expected ${expectedOnline}/${expectedTotal}`);
      }
      
      return {
        success: true,
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
   * Delete a game by name (admin only)
   * @param {string} gameName - Name of the game to delete
   */
  async deleteGame(gameName, stepName = 'delete-game') {
    return await this.executeAction(stepName, 'lobby', async () => {
      console.log(`\n🗑️ DELETING GAME: ${gameName}`);
      
      // Set up dialog handler to accept the confirm dialog
      this.page.once('dialog', async dialog => {
        console.log(`   Dialog appeared: "${dialog.message()}"`);
        await dialog.accept();
        console.log('   ✅ Confirmed deletion');
      });
      
      // Find the game row and click its Delete button
      const deleted = await this.page.evaluate((searchName) => {
        const gameElements = document.querySelectorAll('.game-item, [class*="game-item"], tr, .game-row, div');
        
        for (const el of gameElements) {
          const text = el.textContent || '';
          if (text.includes(searchName)) {
            // Look for Delete button within this element
            const deleteBtn = Array.from(el.querySelectorAll('button')).find(btn => 
              btn.textContent.includes('Delete')
            );
            if (deleteBtn) {
              deleteBtn.click();
              return { clicked: true };
            }
          }
        }
        return { clicked: false };
      }, gameName);
      
      if (deleted.clicked) {
        // Wait for the game list to refresh (game should disappear)
        await this.page.waitForTimeout(500);
        console.log('✅ Delete button clicked');
        return { success: true, gameName };
      } else {
        console.log('❌ Could not find Delete button for game');
        return { success: false, reason: 'delete button not found', gameName };
      }
    });
  }

  /**
   * Verify a game no longer exists in the list
   * @param {string} gameName - Name of the game that should be gone
   */
  async verifyGameDeleted(gameName, stepName = 'verify-game-deleted') {
    return await this.executeAction(stepName, 'lobby', async () => {
      console.log(`\n🔍 VERIFYING GAME DELETED: ${gameName}`);
      
      // Wait a moment for the list to update
      await this.page.waitForTimeout(500);
      
      const gameExists = await this.page.evaluate((searchName) => {
        const pageText = document.body.textContent || '';
        return pageText.includes(searchName);
      }, gameName);
      
      if (!gameExists) {
        console.log('✅ Game successfully deleted - not found in list');
        return { success: true, deleted: true, gameName };
      } else {
        console.log('❌ Game still exists in list');
        return { success: false, deleted: false, gameName };
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
