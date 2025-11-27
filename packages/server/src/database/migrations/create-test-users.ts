import bcrypt from 'bcrypt';
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

async function createTestUsers() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'wallgame',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
  });

  try {
    console.log('🔐 Creating test users...');
    
    // Hash passwords
    const password = process.env.TEST_ADMIN_PASSWORD || 'pizzapie';
    const passwordHash = await bcrypt.hash(password, 10);
    
    console.log(`📝 Password hash for "${password}": ${passwordHash.substring(0, 20)}...`);
    
    // Delete existing test users
    await pool.query(`DELETE FROM users WHERE username IN ('Angelo', 'angelo2', 'testuser1', 'testuser2')`);
    console.log('🗑️  Cleared existing test users');
    
    // Insert test users with proper password hashes
    await pool.query(`
      INSERT INTO users (username, email, password_hash, is_admin) VALUES 
      ($1, $2, $3, true),
      ($4, $5, $3, false)
    `, [
      'Angelo',
      'angelo@wallgame.com',
      passwordHash,
      'angelo2',
      'angelo2@wallgame.com'
    ]);
    
    console.log('✅ Created test users:');
    console.log('  👤 Angelo (admin) - password: ' + password);
    console.log('  👤 angelo2 (user) - password: ' + password);
    
    // Verify users were created
    const result = await pool.query('SELECT username, is_admin FROM users ORDER BY username');
    console.log('\n📋 All users in database:');
    result.rows.forEach(row => {
      console.log(`  ${row.is_admin ? '👑' : '👤'} ${row.username}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to create test users:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createTestUsers()
  .then(() => {
    console.log('\n✅ Test users created successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
