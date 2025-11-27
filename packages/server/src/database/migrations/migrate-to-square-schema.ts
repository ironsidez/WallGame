import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function migrate() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'wallgame',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
  });

  try {
    console.log('🔄 Starting database migration to square-centric schema...');
    console.log(`📍 Host: ${process.env.POSTGRES_HOST || 'localhost'}`);
    console.log(`📍 Database: ${process.env.POSTGRES_DB || 'wallgame'}`);
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    
    // Drop old tables (CASCADE will handle dependencies)
    console.log('\n📦 Dropping old tables...');
    await pool.query(`
      DROP TABLE IF EXISTS player_stats CASCADE;
      DROP TABLE IF EXISTS game_history CASCADE;
      DROP TABLE IF EXISTS game_participants CASCADE;
      DROP TABLE IF EXISTS games CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    console.log('✅ Old tables dropped');
    
    // Read and execute new schema
    console.log('\n📝 Reading new schema from database/setup.sql...');
    const schemaPath = path.join(__dirname, '../../../../../database/setup.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Remove \c wallgame command and COMMIT (we'll handle transaction)
    const cleanedSchema = schema
      .replace(/\\c wallgame;/g, '')
      .replace(/COMMIT;/g, '');
    
    console.log('🏗️  Creating new tables...');
    await pool.query(cleanedSchema);
    console.log('✅ New schema applied');
    
    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Current tables:');
    result.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));
    
    // Verify test users were created
    const userResult = await pool.query('SELECT username FROM users');
    console.log('\n👥 Test users:');
    userResult.rows.forEach(row => console.log(`  ✓ ${row.username}`));
    
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n🎉 Database migration successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
