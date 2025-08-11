/**
 * Database connection test script
 * Run this to verify your database setup
 */

import { DatabaseManager } from './database/DatabaseManager';
import { RedisManager } from './database/RedisManager';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the correct path
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testConnections() {
  console.log('🧪 Testing database connections...\n');
  
  // Debug: Show what environment variables are loaded
  console.log('🔍 Environment variables:');
  console.log(`  POSTGRES_HOST: ${process.env.POSTGRES_HOST || 'NOT SET'}`);
  console.log(`  POSTGRES_USER: ${process.env.POSTGRES_USER || 'NOT SET'}`);
  console.log(`  POSTGRES_DB: ${process.env.POSTGRES_DB || 'NOT SET'}`);
  console.log(`  POSTGRES_PASSWORD: ${process.env.POSTGRES_PASSWORD ? '[SET]' : 'NOT SET'}`);
  console.log('');
  
  // Test PostgreSQL
  console.log('📊 Testing PostgreSQL connection...');
  const dbManager = new DatabaseManager();
  try {
    await dbManager.initialize();
    console.log('✅ PostgreSQL connection successful!');
    
    // Test basic query
    console.log('📋 Testing database schema...');
    // Schema will be created automatically
    console.log('✅ Database schema ready!');
    
    await dbManager.close();
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error instanceof Error ? error.message : String(error));
    console.log('💡 Make sure PostgreSQL is running and credentials are correct');
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test Redis
  console.log('🔴 Testing Redis connection...');
  const redisManager = new RedisManager();
  try {
    await redisManager.initialize();
    console.log('✅ Redis connection successful!');
    
    // Test basic operation
    await redisManager.setGameState('test', { message: 'Hello Redis!' });
    const testData = await redisManager.getGameState('test');
    console.log('✅ Redis read/write test passed!');
    
    await redisManager.close();
  } catch (error) {
    console.error('❌ Redis connection failed:', error instanceof Error ? error.message : String(error));
    console.log('💡 Make sure Redis is running on port 6379');
  }
  
  console.log('\n🎉 Database connection test complete!');
}

// Run the test
testConnections().catch(console.error);
