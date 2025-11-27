import { Server as SocketServer } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { GameState } from '@wallgame/shared';
import jwt from 'jsonwebtoken';
import { generateRandomMap } from '../game/map-generator';
import { v4 as uuidv4 } from 'uuid';

/**
 * Serialize game state for socket transmission
 * Converts Maps to plain objects and ensures terrainData is included
 */
function serializeGameState(gameState: GameState): any {
  return {
    ...gameState,
    players: Object.fromEntries(gameState.players || new Map()),
    cities: Object.fromEntries(gameState.cities || new Map()),
    buildings: Object.fromEntries(gameState.buildings || new Map()),
    units: Object.fromEntries(gameState.units || new Map()),
    grid: {
      width: gameState.grid.width,
      height: gameState.grid.height,
      squares: {} // Don't send squares - client uses terrainData
    },
    terrainData: gameState.terrainData || []
  };
}

/**
 * Convert map data to terrain data array
 */
function convertTerrainToData(mapData: { terrain: string[][] }): string[][] {
  return mapData.terrain;
}

export function setupSocketHandlers(io: SocketServer, gameManager: GameManager, databaseManager: DatabaseManager) {
  io.on('connection', async (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);
    
    let currentUserId: string | null = null;
    let currentGameId: string | null = null;

    // Authenticate socket connection
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('❌ No authentication token provided');
      socket.disconnect();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wallgame-secret') as any;
      currentUserId = decoded.userId;
      console.log(`✅ User ${currentUserId} authenticated`);
    } catch (error) {
      console.log('❌ Socket authentication failed:', error);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
      return;
    }

    // ===== LOBBY EVENTS =====
    
    // Get all games
    socket.on('get-games', async () => {
      try {
        const games = await databaseManager.getActiveGames();
        socket.emit('games-list', games);
      } catch (error) {
        console.error('Get games error:', error);
        socket.emit('error', { message: 'Failed to get games' });
      }
    });
    
    // Create game (admin only)
    socket.on('create-game', async (data: { name: string, settings: any }) => {
      try {
        // Check admin
        const user = await databaseManager.getUserById(currentUserId!);
        if (!user.is_admin) {
          socket.emit('error', { message: 'Admin only' });
          return;
        }
        
        const gameId = uuidv4();
        const mapWidth = data.settings?.mapWidth || 1000;
        const mapHeight = data.settings?.mapHeight || 2000;
        
        console.log(`🎮 Creating game "${data.name}" (${mapWidth}x${mapHeight})`);
        
        // Generate map
        const mapData = generateRandomMap(
          mapWidth,
          mapHeight,
          Date.now(),
          data.settings?.terrainWeights
        );
        
        const terrainData = convertTerrainToData(mapData);
        
        // Save to database
        await databaseManager.createGame(
          gameId,
          data.name,
          {
            maxPlayers: data.settings?.maxPlayers || 100,
            mapWidth,
            mapHeight,
            prodTickInterval: data.settings?.prodTickInterval || 10,
            popTickInterval: data.settings?.popTickInterval || 600,
            artifactReleaseTime: data.settings?.artifactReleaseTime || 12,
            winConditionDuration: data.settings?.winConditionDuration || 0.5,
            maxDuration: data.settings?.maxDuration || null,
            startTime: data.settings?.startTime || new Date(),
            status: 'paused'
          },
          terrainData
        );
        
        console.log(`✅ Game "${data.name}" created`);
        
        // Broadcast to all clients
        const games = await databaseManager.getActiveGames();
        io.emit('games-list', games);
        
        socket.emit('game-created', { gameId });
      } catch (error) {
        console.error('Create game error:', error);
        socket.emit('error', { message: 'Failed to create game' });
      }
    });
    
    // Delete game (admin only)
    socket.on('delete-game', async (data: { gameId: string }) => {
      try {
        const user = await databaseManager.getUserById(currentUserId!);
        if (!user.is_admin) {
          socket.emit('error', { message: 'Admin only' });
          return;
        }
        
        await databaseManager.deleteGame(data.gameId);
        await gameManager.deleteGame(data.gameId);
        
        console.log(`🗑️ Game ${data.gameId} deleted`);
        
        // Broadcast to all clients
        const games = await databaseManager.getActiveGames();
        io.emit('games-list', games);
      } catch (error) {
        console.error('Delete game error:', error);
        socket.emit('error', { message: 'Failed to delete game' });
      }
    });
    
    // ===== GAME EVENTS =====
    
    // Join game
    socket.on('join-game', async (data: { gameId: string }) => {
      try {
        const { gameId } = data;
        
        // Check not already in another game
        const allGames = await databaseManager.getActiveGames();
        for (const game of allGames) {
          if (game.id === gameId) continue;
          const participants = await databaseManager.getGamePlayers(game.id);
          const inGame = participants.find((p: any) => p.id === currentUserId);
          if (inGame) {
            socket.emit('error', { 
              message: 'You are already in another game. Leave that game first.' 
            });
            return;
          }
        }
        
        // Add to participants
        await databaseManager.addPlayerToGame(gameId, currentUserId!);
        
        // Load game state
        await gameManager.initializeGame(gameId);
        const gameState = await gameManager.getGameState(gameId);
        
        if (!gameState) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }
        
        // Join socket room
        await socket.join(gameId);
        currentGameId = gameId;
        
        console.log(`✅ User ${currentUserId} joined game ${gameId}`);
        
        // Send game state
        socket.emit('game-state', serializeGameState(gameState));
        
        // Notify others
        socket.to(gameId).emit('player-joined', { playerId: currentUserId });
        
        // Update lobby
        const games = await databaseManager.getActiveGames();
        io.emit('games-list', games);
        
      } catch (error) {
        console.error('Join game error:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });
    
    // Leave game
    socket.on('leave-game', async () => {
      if (!currentGameId || !currentUserId) return;
      
      try {
        // Leave socket room
        await socket.leave(currentGameId);
        
        console.log(`🚪 User ${currentUserId} left game ${currentGameId}`);
        
        // Notify others
        socket.to(currentGameId).emit('player-left', { playerId: currentUserId });
        
        currentGameId = null;
        
        // Update lobby
        const games = await databaseManager.getActiveGames();
        io.emit('games-list', games);
        
      } catch (error) {
        console.error('Leave game error:', error);
      }
    });
    
    // Game actions
    socket.on('game-action', async (data: { gameId: string; action: any }) => {
      if (!data) {
        socket.emit('error', { message: 'Invalid game action' });
        return;
      }
      
      const { gameId, action } = data;
      
      try {
        const result = await gameManager.processAction(gameId, action);
        
        if (result.success) {
          const gameState = await gameManager.getGameState(gameId);
          if (gameState) {
            io.to(gameId).emit('game-state-update', serializeGameState(gameState));
          }
        } else {
          socket.emit('action-failed', { message: result.error });
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to process action' });
      }
    });
    
    // Chat messages
    socket.on('chat-message', async (data: { gameId: string; message: string }) => {
      if (!data || !currentUserId) return;
      
      const { gameId, message } = data;
      
      io.to(gameId).emit('chat-message', {
        playerId: currentUserId,
        message,
        timestamp: new Date()
      });
    });
    
    // Disconnect cleanup
    socket.on('disconnect', async () => {
      console.log(`🔌 User ${currentUserId} disconnected`);
      
      if (currentGameId && currentUserId) {
        // Notify others in game
        socket.to(currentGameId).emit('player-left', { playerId: currentUserId });
        
        // Update lobby
        const games = await databaseManager.getActiveGames();
        io.emit('games-list', games);
      }
    });
  });
}
