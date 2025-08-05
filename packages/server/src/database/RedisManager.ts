import { createClient, RedisClientType } from 'redis';

export class RedisManager {
  private client: RedisClientType | null = null;

  async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = createClient({
      url: redisUrl
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await this.client.connect();
    console.log('✅ Connected to Redis');
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      console.log('📴 Redis connection closed');
    }
  }

  async setGameState(gameId: string, gameState: any): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const key = `game:${gameId}`;
    await this.client.setEx(key, 3600, JSON.stringify(gameState)); // Expire in 1 hour
  }

  async getGameState(gameId: string): Promise<any | null> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const key = `game:${gameId}`;
    const data = await this.client.get(key);
    
    return data ? JSON.parse(data) : null;
  }

  async deleteGameState(gameId: string): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const key = `game:${gameId}`;
    await this.client.del(key);
  }

  async setPlayerSession(playerId: string, sessionData: any): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const key = `session:${playerId}`;
    await this.client.setEx(key, 86400, JSON.stringify(sessionData)); // Expire in 24 hours
  }

  async getPlayerSession(playerId: string): Promise<any | null> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const key = `session:${playerId}`;
    const data = await this.client.get(key);
    
    return data ? JSON.parse(data) : null;
  }

  async publishGameUpdate(gameId: string, updateData: any): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const channel = `game:${gameId}:updates`;
    await this.client.publish(channel, JSON.stringify(updateData));
  }

  async subscribeToGameUpdates(gameId: string, callback: (data: any) => void): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    
    const channel = `game:${gameId}:updates`;
    await subscriber.subscribe(channel, (message) => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        console.error('Error parsing game update:', error);
      }
    });
  }

  async addPlayerToGame(gameId: string, playerId: string): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const key = `game:${gameId}:players`;
    await this.client.sAdd(key, playerId);
    await this.client.expire(key, 3600); // Expire with game state
  }

  async removePlayerFromGame(gameId: string, playerId: string): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const key = `game:${gameId}:players`;
    await this.client.sRem(key, playerId);
  }

  async getPlayersInGame(gameId: string): Promise<string[]> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const key = `game:${gameId}:players`;
    return await this.client.sMembers(key);
  }

  async getActiveGames(): Promise<string[]> {
    if (!this.client) throw new Error('Redis client not initialized');
    
    const keys = await this.client.keys('game:*:players');
    return keys.map(key => key.split(':')[1]);
  }
}
