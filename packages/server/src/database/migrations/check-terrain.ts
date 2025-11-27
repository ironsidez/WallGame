/**
 * Check terrain data format in database
 */

import { Pool } from 'pg';

async function checkTerrain() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'wallgame',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
  });

  try {
    console.log('\n📊 Checking terrain data in database...\n');

    const result = await pool.query(`
      SELECT 
        id,
        name,
        map_width,
        map_height,
        terrain_data
      FROM games
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No games found');
      return;
    }

    const game = result.rows[0];
    console.log('Game:', game.name);
    console.log('ID:', game.id);
    console.log('Map size (from DB):', game.map_width, 'x', game.map_height);
    console.log('\nTerrain data:');
    console.log('  Type:', typeof game.terrain_data);
    console.log('  Is array?', Array.isArray(game.terrain_data));
    
    if (Array.isArray(game.terrain_data)) {
      console.log('  Rows:', game.terrain_data.length);
      console.log('  Cols:', game.terrain_data[0]?.length || 0);
      console.log('  First cell [0][0]:', game.terrain_data[0]?.[0]);
      console.log('  Sample row [0][0-9]:', game.terrain_data[0]?.slice(0, 10));
      
      // Count terrain types
      const terrainTypes: Record<string, number> = {};
      for (let y = 0; y < Math.min(game.terrain_data.length, 100); y++) {
        for (let x = 0; x < Math.min(game.terrain_data[y]?.length || 0, 100); x++) {
          const t = game.terrain_data[y][x];
          terrainTypes[t] = (terrainTypes[t] || 0) + 1;
        }
      }
      console.log('\n  Terrain type counts (first 100x100):');
      for (const [type, count] of Object.entries(terrainTypes)) {
        console.log(`    ${type}: ${count}`);
      }
    } else {
      console.log('  Value:', JSON.stringify(game.terrain_data).substring(0, 200));
    }

    console.log('\n✅ Check complete');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkTerrain()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
