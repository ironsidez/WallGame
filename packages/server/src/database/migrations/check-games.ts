import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function checkGames() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'wallgame',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
  });

  try {
    console.log('📋 Checking games in database...\n');
    
    const result = await pool.query(`
      SELECT 
        id,
        name,
        status,
        map_width,
        map_height,
        max_players,
        created_at,
        terrain_data IS NOT NULL as has_terrain
      FROM games
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No games found in database');
    } else {
      console.log(`✅ Found ${result.rows.length} game(s):\n`);
      result.rows.forEach((game, i) => {
        console.log(`Game ${i + 1}:`);
        console.log(`  Name: ${game.name}`);
        console.log(`  Status: ${game.status}`);
        console.log(`  Size: ${game.map_width}×${game.map_height}`);
        console.log(`  Max Players: ${game.max_players}`);
        console.log(`  Has Terrain: ${game.has_terrain ? '✅' : '❌'}`);
        console.log(`  Created: ${game.created_at}`);
        console.log('');
      });
    }
    
    // Check participants
    const participants = await pool.query(`
      SELECT 
        game_id,
        user_id,
        is_in_game,
        joined_at
      FROM game_participants
    `);
    
    console.log(`\n👥 Game Participants: ${participants.rows.length}`);
    participants.rows.forEach(p => {
      console.log(`  Game: ${p.game_id.substring(0, 8)}... | User: ${p.user_id.substring(0, 8)}... | In-Game: ${p.is_in_game}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkGames()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
