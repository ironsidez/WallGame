import express from 'express';
import { DatabaseManager } from '../database/DatabaseManager';
import { GameManager } from '../game/GameManager';
import { authenticateToken } from './auth';

const router = express.Router();

// This will be injected by the main server
let databaseManager: DatabaseManager;
let gameManager: GameManager;

export function setDatabaseManager(dm: DatabaseManager) {
  databaseManager = dm;
}

export function setGameManager(gm: GameManager) {
  gameManager = gm;
}

// Create new game
router.post('/create', authenticateToken, async (req: any, res: any) => {
  try {
    const { name, settings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Game name is required' });
    }

    const gameState = await databaseManager.createGame(name, {
      name,
      ...settings
    });

    res.status(201).json({
      message: 'Game created successfully',
      game: {
        id: gameState.id,
        name: gameState.name,
        playerCount: 1,
        maxPlayers: gameState.max_players || 10,
        status: gameState.status,
        createdAt: gameState.created_at
      }
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get active games
router.get('/active', async (req: any, res: any) => {
  try {
    const games = await databaseManager.getActiveGames();
    
    // If gameManager is available, get real-time player counts
    if (gameManager) {
      for (const game of games) {
        const players = await gameManager.getGamePlayers(game.id);
        game.current_players = players.length.toString();
      }
    }
    
    res.json(games);
  } catch (error) {
    console.error('Get active games error:', error);
    res.status(500).json({ error: 'Failed to get active games' });
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

    const player = {
      id: req.user.userId,
      username: req.user.username,
      teamId: teamId || req.user.userId, // Default to individual team
      color: color || '#' + Math.floor(Math.random()*16777215).toString(16),
      resources: 100, // Starting resources
      isOnline: true,
      lastSeen: new Date()
    };

    await databaseManager.addPlayerToGame(gameId, req.user.userId, player.teamId);

    res.json({
      message: 'Successfully joined game',
      player: {
        id: player.id,
        username: player.username,
        teamId: player.teamId,
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
