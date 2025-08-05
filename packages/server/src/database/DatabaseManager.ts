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
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'wallgame',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    };

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

  private async initializeSchema(): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const queries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Games table
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

      // Game participants table
      `CREATE TABLE IF NOT EXISTS game_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES games(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        team_id UUID,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        left_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(game_id, user_id)
      )`,

      // Game history table for completed games
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

      // Player statistics table
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

      // Indexes for better performance
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

  async createUser(username: string, email: string, passwordHash: string): Promise<any> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, created_at
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

    const query = 'SELECT id, username, email, created_at FROM users WHERE id = $1';
    const result = await this.pool.query(query, [userId]);
    
    return result.rows[0] || null;
  }

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

  async addPlayerToGame(gameId: string, userId: string, teamId: string): Promise<void> {
    if (!this.pool) throw new Error('Database pool not initialized');

    const query = `
      INSERT INTO game_participants (game_id, user_id, team_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (game_id, user_id) DO NOTHING
    `;
    
    await this.pool.query(query, [gameId, userId, teamId]);
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
}
