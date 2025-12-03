import { Pool, PoolClient } from 'pg';
import { dbLogger } from '../utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export class DatabaseManager {
  private pool: Pool | null = null;

  async initialize(): Promise<void> {
    const config: DatabaseConfig = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'wallgame',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password'
    };

    // Debug logging to see what values are being used
    dbLogger.debug('🔍 Database configuration:');
    dbLogger.debug(`  Host: ${config.host}`);
    dbLogger.debug(`  Port: ${config.port}`);
    dbLogger.debug(`  Database: ${config.database}`);
    dbLogger.debug(`  User: ${config.user}`);
    dbLogger.debug(`  Password: ${config.password ? '[SET]' : '[NOT SET]'}`);

    this.pool = new Pool(config);

    // Test connection
    try {
      const client = await this.pool.connect();
      client.release();
      dbLogger.info('✅ Connected to PostgreSQL');
      
      // Initialize database schema
      await this.initializeSchema();
    } catch (error) {
      dbLogger.error('❌ Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      dbLogger.info('📴 PostgreSQL connection pool closed');
    }
  }

  /**
   * Test database connection and return connection status
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) {
        await this.initialize();
      }
      
      const client = await this.pool!.connect();
      const result = await client.query('SELECT NOW() as current_time');
      client.release();
      
      dbLogger.info('✅ Database connection test successful:', result.rows[0].current_time);
      return true;
    } catch (error) {
      dbLogger.error('❌ Database connection test failed:', error);
      return false;
    }
  }

  private async initializeSchema(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const queries = [
      // Users table for player authentication and profiles
      `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Games table for game instances and lobbies
      `CREATE TABLE IF NOT EXISTS games (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'waiting',
        max_players INTEGER DEFAULT 100,
        current_players INTEGER DEFAULT 0,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE
      )`,

      // Game participants table for tracking player participation
      `CREATE TABLE IF NOT EXISTS game_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        team_id UUID,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        left_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(game_id, user_id)
      )`,

      // Game history table for completed games and analytics
      `CREATE TABLE IF NOT EXISTS game_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id) ON DELETE CASCADE,
        final_state JSONB NOT NULL,
        winner_team_id UUID,
        duration_seconds INTEGER,
        total_structures INTEGER,
        total_captures INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Player statistics table for rankings and achievements
      `CREATE TABLE IF NOT EXISTS player_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        total_structures_built INTEGER DEFAULT 0,
        total_structures_captured INTEGER DEFAULT 0,
        total_resources_earned INTEGER DEFAULT 0,
        best_game_score INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Performance indexes for grid-based spatial queries
      `CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)`,
      `CREATE INDEX IF NOT EXISTS idx_game_participants_game_id ON game_participants(game_id)`,
      `CREATE INDEX IF NOT EXISTS idx_game_participants_user_id ON game_participants(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_game_history_game_id ON game_history(game_id)`,
      `CREATE INDEX IF NOT EXISTS idx_player_stats_user_id ON player_stats(user_id)`
    ];

    for (const query of queries) {
      try {
        await this.pool.query(query);
      } catch (error) {
        dbLogger.error('Error executing schema query:', { query, error });
        throw error;
      }
    }

    dbLogger.info('✅ Database schema initialized');
  }

  // User management methods for authentication system
  async createUser(username: string, email: string, passwordHash: string): Promise<any> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, is_admin, created_at
    `;
    
    const result = await this.pool.query(query, [username, email, passwordHash]);
    return result.rows[0];
  }

  async getUserByUsername(username: string): Promise<any | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await this.pool.query(query, [username]);
    
    return result.rows[0] || null;
  }

  async getUserById(userId: string): Promise<any | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = 'SELECT id, username, email, is_admin, created_at FROM users WHERE id = $1';
    const result = await this.pool.query(query, [userId]);
    
    return result.rows[0] || null;
  }

  // Game management methods for lobby and session handling
  async createGame(gameId: string, name: string, settings: any, terrainData?: any[][]): Promise<any> {
    if (!this.pool) throw new Error('Database pool not initialized');

    dbLogger.debug('📝 createGame called with:', {
      gameId,
      name,
      settings,
      terrainData: terrainData ? `${terrainData.length}x${terrainData[0]?.length}` : 'NULL'
    });

    const query = `
      INSERT INTO games (
        id,
        name,
        status,
        map_width, 
        map_height, 
        prod_tick_interval, 
        pop_tick_interval,
        artifact_release_time,
        win_condition_duration,
        max_duration,
        max_players,
        start_time,
        terrain_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const params = [
      gameId,
      name,
      settings.status || 'paused',
      settings.mapWidth,
      settings.mapHeight,
      settings.prodTickInterval,
      settings.popTickInterval,
      settings.artifactReleaseTime,
      settings.winConditionDuration,
      settings.maxDuration,
      settings.maxPlayers,
      settings.startTime,
      terrainData ? JSON.stringify(terrainData) : null  // Convert to JSON string for JSONB column
    ];

    dbLogger.debug('Query parameters:', params.map((p, i) => ({
      param: `$${i+1}`,
      type: typeof p,
      value: typeof p === 'object' ? JSON.stringify(p).substring(0, 50) + '...' : p
    })));

    const result = await this.pool.query(query, params);
    return result.rows[0];
  }

  async updateGame(gameId: string, updates: Partial<any>): Promise<any> {
    if (!this.pool) throw new Error('Database pool not initialized');

    // Build dynamic UPDATE query based on provided fields
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (fields.length === 0) {
      // No updates to make
      return await this.getGameById(gameId);
    }

    values.push(gameId); // Add gameId as last parameter
    const query = `
      UPDATE games
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getGameById(gameId: string): Promise<any | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = 'SELECT * FROM games WHERE id = $1';
    const result = await this.pool.query(query, [gameId]);
    
    if (result.rows[0]) {
      const game = result.rows[0];
      console.log('🔍 DatabaseManager.getGameById - Raw DB result:');
      console.log('   terrain_data type:', typeof game.terrain_data);
      console.log('   terrain_data is array?', Array.isArray(game.terrain_data));
      console.log('   terrain_data length:', game.terrain_data?.length);
      console.log('   terrain_data sample:', JSON.stringify(game.terrain_data)?.substring(0, 100));
    }
    
    return result.rows[0] || null;
  }

  async updateGameStatus(gameId: string, status: string): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = 'UPDATE games SET status = $1, updated_at = NOW() WHERE id = $2';
    await this.pool.query(query, [status, gameId]);
  }

  async deleteGame(gameId: string): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    // With CASCADE constraints, deleting the game will automatically delete:
    // - game_participants
    // - grid_squares
    // - units
    // - city_centers
    // - facilities
    // - artifacts
    // - game_history
    const query = 'DELETE FROM games WHERE id = $1';
    await this.pool.query(query, [gameId]);
  }

  async addPlayerToGame(gameId: string, userId: string): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO game_participants (game_id, user_id, is_in_game)
      VALUES ($1, $2, false)
      ON CONFLICT (game_id, user_id) DO NOTHING
    `;
    
    await this.pool.query(query, [gameId, userId]);
  }

  async setPlayerInGame(gameId: string, userId: string, isInGame: boolean): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      UPDATE game_participants 
      SET is_in_game = $3
      WHERE game_id = $1 AND user_id = $2
    `;
    
    await this.pool.query(query, [gameId, userId, isInGame]);
  }

  async removePlayerFromGame(gameId: string, userId: string): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      DELETE FROM game_participants 
      WHERE game_id = $1 AND user_id = $2
    `;
    
    await this.pool.query(query, [gameId, userId]);
  }

  async getGamePlayers(gameId: string): Promise<any[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT 
        u.id,
        u.username,
        u.is_admin,
        gp.is_in_game,
        gp.joined_at
      FROM game_participants gp
      JOIN users u ON gp.user_id = u.id
      WHERE gp.game_id = $1
      ORDER BY gp.joined_at ASC
    `;
    
    const result = await this.pool.query(query, [gameId]);
    return result.rows;
  }

  async getActiveGames(): Promise<any[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT 
        g.*,
        COUNT(DISTINCT gp.user_id) as player_count,
        COUNT(DISTINCT CASE WHEN gp.is_in_game THEN gp.user_id END) as active_player_count
      FROM games g
      LEFT JOIN game_participants gp ON g.id = gp.game_id
      WHERE g.status IN ('paused', 'playing')
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `;
    
    const result = await this.pool.query(query);
    
    // Map DB snake_case to TypeScript camelCase (GameMetadata interface)
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      playerCount: parseInt(row.player_count, 10) || 0,
      activePlayerCount: parseInt(row.active_player_count, 10) || 0,
      maxPlayers: row.max_players,
      mapWidth: row.map_width,
      mapHeight: row.map_height,
      popTicksRemaining: row.pop_ticks_remaining,
      createdAt: row.created_at
    }));
  }

  /**
   * Get full GameMetadata for a specific game
   */
  async getGameMetadata(gameId: string): Promise<any | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT 
        g.*,
        COUNT(DISTINCT gp.user_id) as player_count,
        COUNT(DISTINCT CASE WHEN gp.is_in_game THEN gp.user_id END) as active_player_count
      FROM games g
      LEFT JOIN game_participants gp ON g.id = gp.game_id
      WHERE g.id = $1
      GROUP BY g.id
    `;
    
    const result = await this.pool.query(query, [gameId]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    // Map DB snake_case to TypeScript camelCase (GameMetadata interface)
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      playerCount: parseInt(row.player_count, 10) || 0,
      activePlayerCount: parseInt(row.active_player_count, 10) || 0,
      maxPlayers: row.max_players,
      mapWidth: row.map_width,
      mapHeight: row.map_height,
      popTicksRemaining: row.pop_ticks_remaining,
      createdAt: row.created_at
    };
  }

  /**
   * Get player counts for a specific game
   */
  async getGamePlayerCounts(gameId: string): Promise<{ playerCount: number; activePlayerCount: number }> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as player_count,
        COUNT(DISTINCT CASE WHEN is_in_game THEN user_id END) as active_player_count
      FROM game_participants
      WHERE game_id = $1
    `;
    
    const result = await this.pool.query(query, [gameId]);
    return {
      playerCount: parseInt(result.rows[0]?.player_count, 10) || 0,
      activePlayerCount: parseInt(result.rows[0]?.active_player_count, 10) || 0
    };
  }

  /**
   * Get the game a user is currently active in (is_in_game = true)
   * Returns null if user is not in any game
   */
  async getUserCurrentGame(userId: string): Promise<{ gameId: string } | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT game_id 
      FROM game_participants 
      WHERE user_id = $1 AND is_in_game = true
      LIMIT 1
    `;
    
    const result = await this.pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return { gameId: result.rows[0].game_id };
  }

  /**
   * Save terrain data for a game
   */
  async saveTerrainData(gameId: string, terrainData: any[][]): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = 'UPDATE games SET terrain_data = $1 WHERE id = $2';
    await this.pool.query(query, [JSON.stringify(terrainData), gameId]);
  }

  /**
   * Get terrain data for a game
   */
  async getTerrainData(gameId: string): Promise<any[][] | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = 'SELECT terrain_data FROM games WHERE id = $1';
    const result = await this.pool.query(query, [gameId]);
    
    if (result.rows.length === 0 || !result.rows[0].terrain_data) {
      return null;
    }
    
    return result.rows[0].terrain_data;
  }
}
