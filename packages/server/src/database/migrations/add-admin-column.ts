import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from the server package directory
const envPath = path.resolve(__dirname, '../../../.env.local');
dotenv.config({ path: envPath });

async function addAdminColumn() {
  console.log('Environment check:');
  console.log('  Config path:', envPath);
  console.log('  POSTGRES_USER:', process.env.POSTGRES_USER);
  console.log('  POSTGRES_PASSWORD:', process.env.POSTGRES_PASSWORD ? '[SET]' : '[NOT SET]');
  
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'wallgame',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
  });

  try {
    console.log('Adding is_admin column to users table...');
    
    // Add the column if it doesn't exist
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE
    `);
    
    console.log('✅ Successfully added is_admin column');
    
    // Optional: Make a specific user an admin (replace 'Angelo' with your username)
    const username = process.env.ADMIN_USERNAME || 'Angelo';
    const result = await pool.query(
      'UPDATE users SET is_admin = TRUE WHERE username = $1 RETURNING username',
      [username]
    );
    
    if (result.rows.length > 0) {
      console.log(`✅ Set ${result.rows[0].username} as admin`);
    } else {
      console.log(`⚠️  User '${username}' not found. Create an account and run this again.`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addAdminColumn()
  .then(() => {
    console.log('Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });
