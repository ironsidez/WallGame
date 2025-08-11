const { test, expect } = require('@playwright/test');

// Load test environment with secure credentials
require('./setup/test-env');

const { LoginPage } = require('./pages/LoginPage');
// Replace direct destructuring import with defensive import and logging
const LobbyModule = require('./pages/LobbyPage');
console.log('🔎 LobbyModule typeof:', typeof LobbyModule, 'keys:', Object.keys(LobbyModule || {}));
const LobbyPage = LobbyModule?.LobbyPage || LobbyModule?.default || LobbyModule;
console.log('🔎 LobbyPage typeof:', typeof LobbyPage);
const { GamePage } = require('./pages/GamePage');
const TestContextModule = require('./utils/TestContext');
console.log('🔎 TestContextModule typeof:', typeof TestContextModule, 'keys:', Object.keys(TestContextModule || {}));
const TestContext = TestContextModule;

test('WallGame Complete Flow - Login and Create Game', async ({ page }, testInfo) => {
  console.log('📁 Starting test...');
  console.log('🔎 About to create TestContext with:', typeof TestContext);

  // Create TestContext with testInfo
  const testContext = new TestContext(testInfo);
  
  const loginPage = new LoginPage(page, testContext);
  const lobbyPage = new LobbyPage(page, testContext);
  const gamePage = new GamePage(page, testContext);

  console.log('\n🎮 TESTING WALLGAME COMPLETE FLOW');
  console.log('=================================');

  try {
    // Step 1: Navigate to login page
    console.log('\n🔐 Step 1: Navigate to Login Page');
    await loginPage.navigate('Step-1-navigate-to-login');
    
    // Step 2: Verify we're on login page
    console.log('\n✅ Step 2: Verify on Login Page');
    await loginPage.verifyOnLogin('Step-2-verify-on-login');
    
    // Step 3: Fill credentials using environment variables
    console.log('\n📝 Step 3: Fill Login Credentials');
    await loginPage.fillTestCredentials('Step-3-fill-credentials');
    
    // Step 4: Submit login
    console.log('\n🚀 Step 4: Submit Login');
    await loginPage.submitLogin('Step-4-submit-login');
    
    // Step 5: Verify we're on lobby page
    console.log('\n🏠 Step 5: Verify on Lobby');
    await lobbyPage.verifyOnLobby('Step-5-verify-on-lobby');
    
    // Step 6: Fill create game form
    console.log('\n🎯 Step 6: Fill Create Game Form');
    const gameName = `Test Game ${Date.now()}`;
    await lobbyPage.fillCreateGame(gameName, 'Step-6-fill-create-game');
    
    // Step 7: Submit create game
    console.log('\n🎮 Step 7: Submit Create Game');
    const gameResult = await lobbyPage.submitCreateGame('Step-7-submit-create-game');
    
    if (gameResult.success) {
      // Step 8: Verify we're in the game
      console.log('\n🎮 Step 8: Verify In Game');
      await gamePage.verifyInGame('Step-8-verify-in-game');
      
      // Step 9: Leave the game
      console.log('\n🚪 Step 9: Leave Game');
      await gamePage.leaveGame('Step-9-leave-game');
      
      // Step 10: Verify we're back on lobby
      console.log('\n🏠 Step 10: Verify Back on Lobby');
      await lobbyPage.verifyOnLobby('Step-10-verify-back-on-lobby');
      
      // Step 11: Logout from the application
      console.log('\n🚪 Step 11: Logout');
      await lobbyPage.logout('Step-11-logout');
      
      // Step 12: Verify we're back on login page
      console.log('\n🔐 Step 12: Verify Back on Login');
      await loginPage.verifyOnLogin('Step-12-verify-back-on-login');
    } else {
      throw new Error('Failed to create game');
    }
    
    console.log('✅ COMPLETE FLOW TEST SUCCESSFUL!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
});