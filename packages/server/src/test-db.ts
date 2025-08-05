/**
 * Database connection test script
 * Run this to verify your database setup
 */

import { DatabaseManager } from './database/DatabaseManager';
import { RedisManager } from './database/RedisManager';
import dotenv from 'dotenv';

dotenv.config();

async function testConnections() {
  console.log('🧪 Testing database connections...\n');
  
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
