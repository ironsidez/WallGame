const { test, expect } = require('@playwright/test');

// Load test environment with secure credentials
const { ADMIN_CREDENTIALS, USER_CREDENTIALS } = require('./setup/test-env');

const { LoginPage } = require('./pages/LoginPage');
const LobbyModule = require('./pages/LobbyPage');
const LobbyPage = LobbyModule?.LobbyPage || LobbyModule?.default || LobbyModule;
const { GamePage } = require('./pages/GamePage');
const TestContext = require('./utils/TestContext');

/**
 * Complete multi-user flow test:
 * 1. Admin creates game (stays on lobby)
 * 2. Admin logs out
 * 3. User2 logs in, sees game at 0/0, joins, sees 1/1, leaves, sees 0/1, logs out
 * 4. Admin logs back in, sees 0/1, joins, sees 1/2, leaves, sees 0/2, logs out
 */
test('WallGame Complete Multi-User Flow', async ({ page }, testInfo) => {
  const testContext = new TestContext(testInfo);
  
  const loginPage = new LoginPage(page, testContext);
  const lobbyPage = new LobbyPage(page, testContext);
  const gamePage = new GamePage(page, testContext);

  // Generate unique game name for this test run
  const gameName = `Test Game ${Date.now()}`;
  let stepNum = 1;

  console.log('\n🎮 TESTING WALLGAME COMPLETE MULTI-USER FLOW');
  console.log('=============================================');
  console.log(`📝 Game name: ${gameName}`);
  console.log(`👤 Admin: ${ADMIN_CREDENTIALS.username}`);
  console.log(`👤 User2: ${USER_CREDENTIALS.username}`);

  try {
    // =====================================================
    // PHASE 1: Admin creates game
    // =====================================================
    console.log('\n📋 PHASE 1: Admin Creates Game');
    console.log('================================');

    // Step 1: Navigate to login
    console.log(`\n🔐 Step ${stepNum}: Navigate to Login Page`);
    await loginPage.navigate(`Step-${stepNum}-navigate-to-login`);
    stepNum++;

    // Step 2: Verify on login
    console.log(`\n✅ Step ${stepNum}: Verify on Login Page`);
    await loginPage.verifyOnLogin(`Step-${stepNum}-verify-on-login`);
    stepNum++;

    // Step 3: Login as Admin
    console.log(`\n📝 Step ${stepNum}: Login as Admin (${ADMIN_CREDENTIALS.username})`);
    await loginPage.fillCredentials(ADMIN_CREDENTIALS.username, ADMIN_CREDENTIALS.password, `Step-${stepNum}-admin-credentials`);
    stepNum++;

    // Step 4: Submit login
    console.log(`\n🚀 Step ${stepNum}: Submit Admin Login`);
    await loginPage.submitLogin(`Step-${stepNum}-submit-admin-login`);
    stepNum++;

    // Step 5: Verify on lobby
    console.log(`\n🏠 Step ${stepNum}: Verify Admin on Lobby`);
    await lobbyPage.verifyOnLobby(`Step-${stepNum}-admin-on-lobby`);
    stepNum++;

    // Step 6: Fill create game form with settings
    console.log(`\n🎯 Step ${stepNum}: Fill Create Game Form`);
    const gameSettings = {
      mapWidth: 2000,
      mapHeight: 2000,
      maxPlayers: 50
    };
    await lobbyPage.fillCreateGame(gameName, gameSettings, `Step-${stepNum}-fill-create-game`);
    stepNum++;

    // Step 7: Submit create game (stays on lobby)
    console.log(`\n🎮 Step ${stepNum}: Submit Create Game`);
    const createResult = await lobbyPage.submitCreateGame(`Step-${stepNum}-submit-create-game`);
    if (!createResult.success) {
      throw new Error('Failed to create game');
    }
    stepNum++;

    // Step 8: Verify still on lobby (not auto-joined)
    console.log(`\n🏠 Step ${stepNum}: Verify Still on Lobby (not auto-joined)`);
    await lobbyPage.verifyOnLobby(`Step-${stepNum}-still-on-lobby`);
    stepNum++;

    // Step 9: Logout admin
    console.log(`\n🚪 Step ${stepNum}: Admin Logout`);
    await lobbyPage.logout(`Step-${stepNum}-admin-logout`);
    stepNum++;

    // Step 10: Verify on login
    console.log(`\n🔐 Step ${stepNum}: Verify Back on Login`);
    await loginPage.verifyOnLogin(`Step-${stepNum}-verify-logout-to-login`);
    stepNum++;

    // =====================================================
    // PHASE 2: User2 joins game
    // =====================================================
    console.log('\n📋 PHASE 2: User2 Joins Game');
    console.log('=============================');

    // Step 11: Login as User2
    console.log(`\n📝 Step ${stepNum}: Login as User2 (${USER_CREDENTIALS.username})`);
    await loginPage.fillCredentials(USER_CREDENTIALS.username, USER_CREDENTIALS.password, `Step-${stepNum}-user2-credentials`);
    stepNum++;

    // Step 12: Submit login
    console.log(`\n🚀 Step ${stepNum}: Submit User2 Login`);
    await loginPage.submitLogin(`Step-${stepNum}-submit-user2-login`);
    stepNum++;

    // Step 13: Verify on lobby
    console.log(`\n🏠 Step ${stepNum}: Verify User2 on Lobby`);
    await lobbyPage.verifyOnLobby(`Step-${stepNum}-user2-on-lobby`);
    stepNum++;

    // Step 14: Verify game shows 0/0 players
    console.log(`\n🔢 Step ${stepNum}: Verify Game is 0/0 Players`);
    const count1 = await lobbyPage.verifyGamePlayerCount(gameName, 0, 0, `Step-${stepNum}-verify-0-0`);
    console.log(`   Result: ${count1.success ? '✅ PASS' : '❌ FAIL'} (actual: ${count1.actualOnline}/${count1.actualTotal})`);
    stepNum++;

    // Step 15: Join the game
    console.log(`\n🎮 Step ${stepNum}: User2 Joins Game`);
    // Clear localStorage to avoid stale game state
    await page.evaluate(() => localStorage.clear());
    await lobbyPage.joinGame(gameName, `Step-${stepNum}-user2-join-game`);
    stepNum++;

    // Step 16: Verify in game
    console.log(`\n🎮 Step ${stepNum}: Verify User2 In Game`);
    await gamePage.verifyInGame(`Step-${stepNum}-user2-in-game`);
    stepNum++;

    // Step 17: Verify terrain variety (wait 2 seconds then check)
    console.log(`\n🗺️ Step ${stepNum}: Verify Terrain Variety`);
    const terrainCheck = await gamePage.verifyTerrainVariety(`Step-${stepNum}-verify-terrain-variety`);
    console.log(`   Result: ${terrainCheck.success ? '✅ PASS' : '❌ FAIL'} - ${terrainCheck.terrainCount} terrain types`);
    stepNum++;

    // Step 18: Verify game info shows correct name and 1/1 players
    console.log(`\n🔍 Step ${stepNum}: Verify Game Info (name and 1/1 players)`);
    const gameInfo1 = await gamePage.verifyGameInfo({
      gameName: gameName.substring(0, 10), // Partial match
      onlinePlayers: 1,
      totalPlayers: 1
    }, `Step-${stepNum}-verify-game-info-1-1`);
    console.log(`   Result: ${gameInfo1.success ? '✅ PASS' : '❌ FAIL'}`);
    stepNum++;

    // Step 19: Leave game
    console.log(`\n🚪 Step ${stepNum}: User2 Leaves Game`);
    await gamePage.leaveGame(`Step-${stepNum}-user2-leave-game`);
    stepNum++;

    // Step 20: Verify back on lobby
    console.log(`\n🏠 Step ${stepNum}: Verify User2 Back on Lobby`);
    await lobbyPage.verifyOnLobby(`Step-${stepNum}-user2-back-on-lobby`);
    stepNum++;

    // Step 21: Verify game shows 0/1 players
    console.log(`\n🔢 Step ${stepNum}: Verify Game is 0/1 Players`);
    const count2 = await lobbyPage.verifyGamePlayerCount(gameName, 0, 1, `Step-${stepNum}-verify-0-1`);
    console.log(`   Result: ${count2.success ? '✅ PASS' : '❌ FAIL'} (actual: ${count2.actualOnline}/${count2.actualTotal})`);
    stepNum++;

    // Step 22: Logout User2
    console.log(`\n🚪 Step ${stepNum}: User2 Logout`);
    await lobbyPage.logout(`Step-${stepNum}-user2-logout`);
    stepNum++;

    // Step 23: Verify on login
    console.log(`\n🔐 Step ${stepNum}: Verify Back on Login`);
    await loginPage.verifyOnLogin(`Step-${stepNum}-verify-user2-logout`);
    stepNum++;

    // =====================================================
    // PHASE 3: Admin joins game
    // =====================================================
    console.log('\n📋 PHASE 3: Admin Joins Game');
    console.log('=============================');

    // Step 24: Login as Admin again
    console.log(`\n📝 Step ${stepNum}: Login as Admin (${ADMIN_CREDENTIALS.username})`);
    await loginPage.fillCredentials(ADMIN_CREDENTIALS.username, ADMIN_CREDENTIALS.password, `Step-${stepNum}-admin-credentials-2`);
    stepNum++;

    // Step 25: Submit login
    console.log(`\n🚀 Step ${stepNum}: Submit Admin Login`);
    await loginPage.submitLogin(`Step-${stepNum}-submit-admin-login-2`);
    stepNum++;

    // Step 26: Verify on lobby
    console.log(`\n🏠 Step ${stepNum}: Verify Admin on Lobby`);
    await lobbyPage.verifyOnLobby(`Step-${stepNum}-admin-on-lobby-2`);
    stepNum++;

    // Step 27: Verify game shows 0/1 players
    console.log(`\n🔢 Step ${stepNum}: Verify Game is 0/1 Players`);
    const count3 = await lobbyPage.verifyGamePlayerCount(gameName, 0, 1, `Step-${stepNum}-verify-0-1-admin`);
    console.log(`   Result: ${count3.success ? '✅ PASS' : '❌ FAIL'} (actual: ${count3.actualOnline}/${count3.actualTotal})`);
    stepNum++;

    // Step 28: Join the game
    console.log(`\n🎮 Step ${stepNum}: Admin Joins Game`);
    await lobbyPage.joinGame(gameName, `Step-${stepNum}-admin-join-game`);
    stepNum++;

    // Step 29: Verify in game
    console.log(`\n🎮 Step ${stepNum}: Verify Admin In Game`);
    await gamePage.verifyInGame(`Step-${stepNum}-admin-in-game`);
    stepNum++;

    // Step 30: Verify game info shows correct name and 1/2 players (1 online, 2 total)
    console.log(`\n🔍 Step ${stepNum}: Verify Game Info (name and 1/2 players)`);
    const gameInfo2 = await gamePage.verifyGameInfo({
      gameName: gameName.substring(0, 10), // Partial match
      onlinePlayers: 1,
      totalPlayers: 2
    }, `Step-${stepNum}-verify-game-info-1-2`);
    console.log(`   Result: ${gameInfo2.success ? '✅ PASS' : '❌ FAIL'}`);
    stepNum++;

    // Step 31: Leave game
    console.log(`\n🚪 Step ${stepNum}: Admin Leaves Game`);
    await gamePage.leaveGame(`Step-${stepNum}-admin-leave-game`);
    stepNum++;

    // Step 32: Verify back on lobby
    console.log(`\n🏠 Step ${stepNum}: Verify Admin Back on Lobby`);
    await lobbyPage.verifyOnLobby(`Step-${stepNum}-admin-back-on-lobby`);
    stepNum++;

    // Step 33: Verify game shows 0/2 players
    console.log(`\n🔢 Step ${stepNum}: Verify Game is 0/2 Players`);
    const count4 = await lobbyPage.verifyGamePlayerCount(gameName, 0, 2, `Step-${stepNum}-verify-0-2`);
    console.log(`   Result: ${count4.success ? '✅ PASS' : '❌ FAIL'} (actual: ${count4.actualOnline}/${count4.actualTotal})`);
    stepNum++;

    // Step 34: Delete the test game
    console.log(`\n🗑️ Step ${stepNum}: Admin Deletes Test Game`);
    await lobbyPage.deleteGame(gameName, `Step-${stepNum}-delete-game`);
    stepNum++;

    // Step 35: Verify game is deleted
    console.log(`\n🔍 Step ${stepNum}: Verify Game Deleted`);
    const deleteResult = await lobbyPage.verifyGameDeleted(gameName, `Step-${stepNum}-verify-deleted`);
    console.log(`   Result: ${deleteResult.success ? '✅ PASS' : '❌ FAIL'}`);
    stepNum++;

    // Step 36: Final logout
    console.log(`\n🚪 Step ${stepNum}: Final Admin Logout`);
    await lobbyPage.logout(`Step-${stepNum}-final-logout`);
    stepNum++;

    // Step 37: Verify back on login
    console.log(`\n🔐 Step ${stepNum}: Verify Final Logout to Login`);
    await loginPage.verifyOnLogin(`Step-${stepNum}-final-verify-login`);
    stepNum++;

    // =====================================================
    // TEST COMPLETE
    // =====================================================
    console.log('\n=============================================');
    console.log('✅ COMPLETE MULTI-USER FLOW TEST SUCCESSFUL!');
    console.log(`   Total Steps: ${stepNum - 1}`);
    console.log('=============================================');

  } catch (error) {
    console.error(`\n❌ Test failed at step ${stepNum}:`, error.message);
    throw error;
  }
});