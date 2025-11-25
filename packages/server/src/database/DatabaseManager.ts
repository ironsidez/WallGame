import { Pool, PoolClient } from 'pg';

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
    console.log('🔍 Database configuration:');
    console.log(`  Host: ${config.host}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  Database: ${config.database}`);
    console.log(`  User: ${config.user}`);
    console.log(`  Password: ${config.password ? '[SET]' : '[NOT SET]'}`);

    this.pool = new Pool(config);

    // Test connection
    try {
      const client = await this.pool.connect();
      client.release();
      console.log('✅ Connected to PostgreSQL');
      
      // Initialize database schema
      await this.initializeSchema();
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('📴 PostgreSQL connection pool closed');
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
      
      console.log('✅ Database connection test successful:', result.rows[0].current_time);
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
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
        console.error('Error executing schema query:', query, error);
        throw error;
      }
    }

    console.log('✅ Database schema initialized');
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
  async createGame(name: string, settings: any): Promise<any> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO games (name, settings)
      VALUES ($1, $2)
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [name, JSON.stringify(settings)]);
    return result.rows[0];
  }

  async updateGameStatus(gameId: string, status: string): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = 'UPDATE games SET status = $1, updated_at = NOW() WHERE id = $2';
    await this.pool.query(query, [status, gameId]);
  }

  async deleteGame(gameId: string): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    // Delete all associated data in a transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Delete game participants
      await client.query('DELETE FROM game_participants WHERE game_id = $1', [gameId]);
      
      // Delete game history
      await client.query('DELETE FROM game_history WHERE game_id = $1', [gameId]);
      
      // Delete the game itself
      await client.query('DELETE FROM games WHERE id = $1', [gameId]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async addPlayerToGame(gameId: string, userId: string, teamId: string): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO game_participants (game_id, user_id, team_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (game_id, user_id) DO NOTHING
    `;
    
    await this.pool.query(query, [gameId, userId, teamId]);
  }

  async removePlayerFromGame(gameId: string, userId: string): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      UPDATE game_participants 
      SET left_at = NOW()
      WHERE game_id = $1 AND user_id = $2 AND left_at IS NULL
    `;
    
    await this.pool.query(query, [gameId, userId]);
  }

  async getGamePlayers(gameId: string): Promise<any[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT 
        u.id,
        u.username,
        gp.team_id,
        gp.joined_at,
        gp.left_at
      FROM game_participants gp
      JOIN users u ON gp.user_id = u.id
      WHERE gp.game_id = $1 AND gp.left_at IS NULL
      ORDER BY gp.joined_at ASC
    `;
    
    const result = await this.pool.query(query, [gameId]);
    return result.rows;
  }

  async getActiveGames(): Promise<any[]> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      SELECT g.*, COUNT(gp.user_id) as current_players
      FROM games g
      LEFT JOIN game_participants gp ON g.id = gp.game_id AND gp.left_at IS NULL
      WHERE g.status IN ('waiting', 'active')
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  // Game persistence methods for state management
  async saveGameHistory(gameId: string, finalState: any, winnerTeamId?: string): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO game_history (game_id, final_state, winner_team_id, total_structures)
      VALUES ($1, $2, $3, $4)
    `;
    
    const totalStructures = finalState.structures ? Object.keys(finalState.structures).length : 0;
    
    await this.pool.query(query, [
      gameId,
      JSON.stringify(finalState),
      winnerTeamId || null,
      totalStructures
    ]);

    // Update game status to ended
    await this.updateGameStatus(gameId, 'ended');
  }

  // Player statistics methods for rankings and achievements
  async updatePlayerStats(userId: string, stats: any): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO player_stats (
        user_id, games_played, games_won, total_structures_built,
        total_structures_captured, total_resources_earned, best_game_score
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE SET
        games_played = player_stats.games_played + $2,
        games_won = player_stats.games_won + $3,
        total_structures_built = player_stats.total_structures_built + $4,
        total_structures_captured = player_stats.total_structures_captured + $5,
        total_resources_earned = player_stats.total_resources_earned + $6,
        best_game_score = GREATEST(player_stats.best_game_score, $7),
        updated_at = NOW()
      `;
    
    await this.pool.query(query, [
      userId,
      stats.gamesPlayed || 0,
      stats.gamesWon || 0,
      stats.structuresBuilt || 0,
      stats.structuresCaptured || 0,
      stats.resourcesEarned || 0,
      stats.gameScore || 0
    ]);
  }

  async getPlayerStats(userId: string): Promise<any | null> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = 'SELECT * FROM player_stats WHERE user_id = $1';
    const result = await this.pool.query(query, [userId]);
    
    return result.rows[0] || null;
  }
}
