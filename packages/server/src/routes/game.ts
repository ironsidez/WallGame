import express from 'express';
import { DatabaseManager } from '../database/DatabaseManager';
import { GameManager } from '../game/GameManager';
import { authenticateToken, authenticateAdmin } from './auth';
import { Server as SocketServer } from 'socket.io';

const router = express.Router();

// This will be injected by the main server
let databaseManager: DatabaseManager;
let gameManager: GameManager;
let io: SocketServer;

export function setDatabaseManager(dm: DatabaseManager) {
  databaseManager = dm;
}

export function setGameManager(gm: GameManager) {
  gameManager = gm;
}

export function setSocketIO(socketIO: SocketServer) {
  io = socketIO;
}

// Create new game (admin only)
router.post('/create', authenticateAdmin, async (req: any, res: any) => {
  try {
    const { name, settings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Game name is required' });
    }

    // Create game in database
    const dbGame = await databaseManager.createGame(name, {
      name,
      maxPlayers: settings?.maxPlayers || 100,
      mapWidth: settings?.mapWidth || 50,
      mapHeight: settings?.mapHeight || 50,
      ...settings
    });

    // Initialize in GameManager (it will load from database or create new)
    if (gameManager) {
      await gameManager.initializeGame(dbGame.id);
    }

    // Broadcast lobby update to all connected clients
    if (io && gameManager) {
      const games = await databaseManager.getActiveGames();
      for (const game of games) {
        const onlineCount = await gameManager.getOnlinePlayerCount(game.id);
        const totalCount = await gameManager.getTotalPlayerCount(game.id);
        game.online_players = onlineCount;
        game.total_players = totalCount;
        game.current_players = `${onlineCount}/${totalCount}`;
      }
      io.emit('lobby-update', games);
    }

    res.status(201).json({
      message: 'Game created successfully',
      game: {
        id: dbGame.id,
        name: dbGame.name,
        playerCount: 0,
        maxPlayers: dbGame.max_players || 100,
        status: dbGame.status,
        createdAt: dbGame.created_at
      }
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get active games
router.get('/active', authenticateToken, async (req: any, res: any) => {
  try {
    const games = await databaseManager.getActiveGames();
    const userId = req.user.userId;
    
    // If gameManager is available, get real-time player counts and participation status
    if (gameManager) {
      for (const game of games) {
        const onlineCount = await gameManager.getOnlinePlayerCount(game.id);
        const totalCount = await gameManager.getTotalPlayerCount(game.id);
        
        console.log(`📊 Game "${game.name}" (${game.id}): online=${onlineCount}, total=${totalCount}`);
        
        // Set both online and total counts
        game.online_players = onlineCount;
        game.total_players = totalCount;
        game.current_players = `${onlineCount}/${totalCount}`; // Format: "1/3"
        
        // Check if current user is in this game
        const players = await gameManager.getGamePlayers(game.id);
        console.log(`👥 Game "${game.name}" players:`, players.map((p: any) => `${p.username} (online: ${p.isOnline})`));
        game.isParticipating = players.some((p: any) => p.id === userId);
      }
    }
    
    res.json(games);
  } catch (error) {
    console.error('Get active games error:', error);
    res.status(500).json({ error: 'Failed to get active games' });
  }
});

// Delete game (admin only)
router.delete('/:gameId', authenticateAdmin, async (req: any, res: any) => {
  try {
    const { gameId } = req.params;

    // Remove from GameManager if active
    if (gameManager) {
      await gameManager.deleteGame(gameId);
    }

    // Delete from database
    await databaseManager.deleteGame(gameId);

    // Broadcast lobby update to all connected clients
    if (io && gameManager) {
      const games = await databaseManager.getActiveGames();
      for (const game of games) {
        const onlineCount = await gameManager.getOnlinePlayerCount(game.id);
        const totalCount = await gameManager.getTotalPlayerCount(game.id);
        game.online_players = onlineCount;
        game.total_players = totalCount;
        game.current_players = `${onlineCount}/${totalCount}`;
      }
      io.emit('lobby-update', games);
    }

    res.json({
      message: 'Game deleted successfully',
      gameId
    });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// Get players in a specific game
router.get('/:gameId/players', async (req: any, res: any) => {
  try {
    const { gameId } = req.params;
    
    if (!gameManager) {
      return res.status(500).json({ error: 'Game manager not available' });
    }
    
    const players = await gameManager.getGamePlayers(gameId);
    res.json(players);
  } catch (error) {
    console.error('Get game players error:', error);
    res.status(500).json({ error: 'Failed to get game players' });
  }
});

// Get game state
router.get('/:gameId', authenticateToken, async (req: any, res: any) => {
  try {
    const { gameId } = req.params;
    
    // For now, return a simple placeholder since we don't have getGameState
    res.json({ 
      game: {
        id: gameId,
        status: 'waiting',
        message: 'Game state endpoint not implemented yet'
      }
    });
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// Join game
router.post('/:gameId/join', authenticateToken, async (req: any, res: any) => {
  try {
    const { gameId } = req.params;
    const { teamId, color } = req.body;

    if (!gameManager) {
      return res.status(500).json({ error: 'Game manager not available' });
    }

    const player = {
      id: req.user.userId,
      username: req.user.username,
      color: color || '#' + Math.floor(Math.random()*16777215).toString(16),
      isOnline: true,
      lastSeen: new Date(),
      cityIds: [],
      unitIds: []
    };

    // Add player to database (persistent storage)
    await databaseManager.addPlayerToGame(gameId, req.user.userId, teamId || req.user.userId);
    
    // CRITICAL: Add player to GameManager (in-memory state)
    const added = await gameManager.addPlayerToGame(gameId, player);
    
    if (!added) {
      return res.status(400).json({ error: 'Failed to add player to game (game full or not found)' });
    }

    // Broadcast lobby update to all connected clients
    if (io) {
      const games = await databaseManager.getActiveGames();
      for (const game of games) {
        const onlineCount = await gameManager.getOnlinePlayerCount(game.id);
        const totalCount = await gameManager.getTotalPlayerCount(game.id);
        game.online_players = onlineCount;
        game.total_players = totalCount;
        game.current_players = `${onlineCount}/${totalCount}`;
      }
      io.emit('lobby-update', games);
    }

    res.json({
      message: 'Successfully joined game',
      player: {
        id: player.id,
        username: player.username,
        color: player.color
      }
    });
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// Get game statistics
router.get('/:gameId/stats', authenticateToken, async (req: any, res: any) => {
  try {
    const { gameId } = req.params;
    
    // For now, return placeholder stats since we don't have getGameState
    const stats = {
      totalPlayers: 0,
      totalTeams: 0,
      totalStructures: 0,
      gridSize: {
        width: 100,
        height: 100
      },
      occupiedCells: 0,
      gamePhase: 'waiting',
      gameAge: 0
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get game stats error:', error);
    res.status(500).json({ error: 'Failed to get game statistics' });
  }
});

export { router as gameRouter };
