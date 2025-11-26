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
   * Verify terrain variety on the game canvas
   * Waits for terrain to load and checks that multiple terrain types are present
   */
  async verifyTerrainVariety(stepName = 'verify-terrain-variety') {
    return await this.executeAction(stepName, 'game', async () => {
      console.log('\n🗺️ VERIFYING TERRAIN VARIETY');
      
      // Listen to console logs from the browser
      const consoleLogs = [];
      this.page.on('console', msg => {
        if (msg.text().includes('terrainData') || msg.text().includes('game-state')) {
          consoleLogs.push(msg.text());
        }
      });
      
      // Wait 2 seconds for terrain to load
      console.log('⏳ Waiting 2 seconds for terrain to load...');
      await this.page.waitForTimeout(2000);
      
      // Print captured console logs
      if (consoleLogs.length > 0) {
        console.log('📋 Browser console logs:');
        consoleLogs.forEach(log => console.log('  ', log));
      }
      
      // Check if terrainData exists in game state
      const stateCheck = await this.page.evaluate(() => {
        // @ts-ignore - accessing Zustand store from window
        const gameStore = window.__ZUSTAND_STORES__?.gameStore;
        const currentGame = gameStore?.getState?.()?.currentGame;
        
        return {
          hasGameStore: !!gameStore,
          hasCurrentGame: !!currentGame,
          hasTerrainData: !!currentGame?.terrainData,
          terrainDataRows: currentGame?.terrainData?.length || 0,
          terrainDataCols: currentGame?.terrainData?.[0]?.length || 0,
          terrainSample: currentGame?.terrainData?.[0]?.slice(0, 10)
        };
      });
      
      console.log('📊 Game state check:', stateCheck);
      
      // Get terrain data from browser
      const terrainInfo = await this.page.evaluate(() => {
        // Check if canvas exists and has drawn content
        const canvas = document.querySelector('canvas');
        if (!canvas) {
          return { error: 'No canvas found' };
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return { error: 'No canvas context' };
        }
        
        // Sample pixels from canvas to detect color variety
        const width = canvas.width;
        const height = canvas.height;
        const sampleSize = 200; // Sample 200 pixels for better coverage
        
        const colors = new Map();
        
        for (let i = 0; i < sampleSize; i++) {
          const x = Math.floor(Math.random() * width);
          const y = Math.floor(Math.random() * height);
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          // Only count non-black, non-transparent pixels
          if (pixel[3] > 0) { // Alpha > 0
            const rgb = `${pixel[0]},${pixel[1]},${pixel[2]}`;
            colors.set(rgb, (colors.get(rgb) || 0) + 1);
          }
        }
        
        // Define expected terrain colors (from GameGrid.tsx)
        // Allow some tolerance for anti-aliasing/rendering differences
        const terrainColors = {
          plains: { r: 124, g: 186, b: 95 },     // #7cba5f
          forest: { r: 45, g: 90, b: 39 },       // #2d5a27
          hills: { r: 139, g: 115, b: 85 },      // #8b7355
          mountain: { r: 90, g: 90, b: 90 },     // #5a5a5a
          desert: { r: 212, g: 184, b: 113 },    // #d4b871
          swamp: { r: 74, g: 90, b: 58 },        // #4a5a3a
          river: { r: 74, g: 144, b: 217 },      // #4a90d9
          ocean: { r: 37, g: 99, b: 168 }        // #2563a8
        };
        
        // Check for color matches with tolerance
        const tolerance = 10; // Allow ±10 in each RGB channel
        const detectedTerrains = [];
        const colorMatches = {};
        
        for (const [rgb, count] of colors.entries()) {
          const [r, g, b] = rgb.split(',').map(Number);
          for (const [terrainType, expected] of Object.entries(terrainColors)) {
            if (Math.abs(r - expected.r) <= tolerance &&
                Math.abs(g - expected.g) <= tolerance &&
                Math.abs(b - expected.b) <= tolerance) {
              if (!detectedTerrains.includes(terrainType)) {
                detectedTerrains.push(terrainType);
                colorMatches[terrainType] = { actual: rgb, expected: `${expected.r},${expected.g},${expected.b}`, count };
              }
            }
          }
        }
        
        return {
          uniqueColors: colors.size,
          detectedTerrains,
          terrainCount: detectedTerrains.length,
          colorSamples: Array.from(colors.entries()).slice(0, 10), // First 10 colors with counts
          colorMatches
        };
      });
      
      console.log(`   Unique colors detected: ${terrainInfo.uniqueColors}`);
      console.log(`   Terrain types found: ${terrainInfo.detectedTerrains?.join(', ') || 'none'}`);
      console.log(`   Total terrain types: ${terrainInfo.terrainCount || 0}`);
      console.log(`   Color samples (first 10):`, terrainInfo.colorSamples);
      console.log(`   Color matches:`, terrainInfo.colorMatches);
      
      if (terrainInfo.error) {
        throw new Error(`Terrain verification failed: ${terrainInfo.error}`);
      }
      
      if (terrainInfo.terrainCount < 2) {
        throw new Error(`Expected multiple terrain types, but only found ${terrainInfo.terrainCount}: ${terrainInfo.detectedTerrains?.join(', ')}. Color samples: ${JSON.stringify(terrainInfo.colorSamples?.slice(0, 5))}`);
      }
      
      console.log(`✅ Terrain variety confirmed: ${terrainInfo.terrainCount} different terrain types`);
      
      return {
        success: true,
        ...terrainInfo
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