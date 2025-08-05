import express from 'express';
import { GameManager } from '../game/GameManager';
import { authenticateToken } from './auth';

const router = express.Router();

// This will be injected by the main server
let gameManager: GameManager;

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

    const gameState = await gameManager.createGame({
      name,
      ...settings
    });

    res.status(201).json({
      message: 'Game created successfully',
      game: {
        id: gameState.id,
        settings: gameState.settings,
        phase: gameState.gamePhase,
        createdAt: gameState.startTime
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
    const games = await gameManager.getActiveGames();
    res.json({ games });
  } catch (error) {
    console.error('Get active games error:', error);
    res.status(500).json({ error: 'Failed to get active games' });
  }
});

// Get game state
router.get('/:gameId', authenticateToken, async (req: any, res: any) => {
  try {
    const { gameId } = req.params;
    const gameState = await gameManager.getGameState(gameId);

    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ gameState });
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

    const success = await gameManager.addPlayerToGame(gameId, player);

    if (!success) {
      return res.status(400).json({ error: 'Cannot join game (full or not found)' });
    }

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
    const gameState = await gameManager.getGameState(gameId);

    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const stats = {
      totalPlayers: gameState.players.size,
      totalTeams: gameState.teams.size,
      totalStructures: gameState.structures.size,
      gridSize: {
        width: gameState.grid.bounds.maxX - gameState.grid.bounds.minX + 1,
        height: gameState.grid.bounds.maxY - gameState.grid.bounds.minY + 1
      },
      occupiedCells: gameState.grid.cells.size,
      gamePhase: gameState.gamePhase,
      gameAge: Date.now() - gameState.startTime.getTime()
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get game stats error:', error);
    res.status(500).json({ error: 'Failed to get game statistics' });
  }
});

export { router as gameRouter };
