import { Server as SocketServer } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { GameState, GameMetadata, LobbyUpdate } from '@wallgame/shared';
import { serverLogger } from '../utils/logger';
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

/**
 * Build lobby update and broadcast to all clients in lobby room
 */
async function broadcastLobbyUpdate(io: SocketServer, db: DatabaseManager): Promise<void> {
  const games: GameMetadata[] = await db.getActiveGames();
  const lobbyUpdate: LobbyUpdate = {
    games,
    onlinePlayerCount: io.sockets.sockets.size
  };
  io.to('lobby').emit('lobby:update', lobbyUpdate);
  serverLogger.debug(`📡 Broadcast lobby update: ${games.length} games, ${lobbyUpdate.onlinePlayerCount} online`);
}

/**
 * Build game metadata update and broadcast to game room
 */
async function broadcastGameMetadata(io: SocketServer, db: DatabaseManager, gameId: string): Promise<void> {
  const metadata: GameMetadata | null = await db.getGameMetadata(gameId);
  if (!metadata) return;
  
  io.to(`game:${gameId}`).emit('game:metadata', metadata);
  serverLogger.debug(`📡 Broadcast game metadata for ${gameId}: ${metadata.activePlayerCount}/${metadata.playerCount} players`);
}

export function setupSocketHandlers(io: SocketServer, gameManager: GameManager, databaseManager: DatabaseManager) {
  io.on('connection', async (socket) => {
    serverLogger.info(`🔌 Player connected: ${socket.id}`);
    
    let currentUserId: string | null = null;
    let currentGameId: string | null = null;

    // Authenticate socket connection
    const token = socket.handshake.auth.token;
    if (!token) {
      serverLogger.warn('❌ No authentication token provided');
      socket.disconnect();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wallgame-secret') as any;
      currentUserId = decoded.userId;
      serverLogger.info(`✅ User ${currentUserId} authenticated`);
    } catch (error) {
      serverLogger.error('❌ Socket authentication failed:', error);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
      return;
    }

    // ===== LOBBY EVENTS =====
    
    // Join lobby room (for receiving updates)
    socket.on('lobby:join', async () => {
      await socket.join('lobby');
      serverLogger.info(`👋 User ${currentUserId} joined lobby`);
      // Send initial lobby state
      await broadcastLobbyUpdate(io, databaseManager);
    });
    
    // Leave lobby room
    socket.on('lobby:leave', async () => {
      await socket.leave('lobby');
      serverLogger.info(`👋 User ${currentUserId} left lobby`);
    });
    
    // Get all games (legacy - kept for backwards compatibility)
    socket.on('get-games', async () => {
      try {
        const games = await databaseManager.getActiveGames();
        socket.emit('games-list', games);
      } catch (error) {
        serverLogger.error('Get games error:', error);
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
        
        serverLogger.info(`🎮 Creating game "${data.name}" (${mapWidth}x${mapHeight})`);
        
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
        
        serverLogger.info(`✅ Game "${data.name}" created`);
        
        // Broadcast lobby update to all clients in lobby
        await broadcastLobbyUpdate(io, databaseManager);
        
        socket.emit('game-created', { gameId });
      } catch (error) {
        serverLogger.error('Create game error:', error);
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
        
        serverLogger.info(`🗑️ Game ${data.gameId} deleted`);
        
        // Broadcast lobby update to all clients in lobby
        await broadcastLobbyUpdate(io, databaseManager);
      } catch (error) {
        serverLogger.error('Delete game error:', error);
        socket.emit('error', { message: 'Failed to delete game' });
      }
    });
    
    // ===== GAME EVENTS =====
    
    // Join game
    socket.on('join-game', async (data: { gameId: string }) => {
      try {
        const { gameId } = data;
        
        // Check if user is already in another game - if so, leave it first
        const currentGame = await databaseManager.getUserCurrentGame(currentUserId!);
        if (currentGame && currentGame.gameId !== gameId) {
          const oldGameId = currentGame.gameId;
          
          // Mark player as inactive in old game
          await databaseManager.setPlayerInGame(oldGameId, currentUserId!, false);
          
          // Leave old game room
          await socket.leave(`game:${oldGameId}`);
          
          // Notify others in old game
          socket.to(`game:${oldGameId}`).emit('player-left', { playerId: currentUserId });
          
          serverLogger.info(`🚪 User ${currentUserId} auto-left game ${oldGameId} to join ${gameId}`);
          
          // Broadcast updates for old game
          await broadcastGameMetadata(io, databaseManager, oldGameId);
        }
        
        // Add to participants
        await databaseManager.addPlayerToGame(gameId, currentUserId!);
        
        // Mark player as active in game
        await databaseManager.setPlayerInGame(gameId, currentUserId!, true);
        
        // Load game state
        await gameManager.initializeGame(gameId);
        const gameState = await gameManager.getGameState(gameId);
        
        if (!gameState) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }
        
        // Leave lobby, join game room
        await socket.leave('lobby');
        await socket.join(`game:${gameId}`);
        currentGameId = gameId;
        
        serverLogger.info(`✅ User ${currentUserId} joined game ${gameId}`);
        
        // Send game state to joining player
        socket.emit('game-state', serializeGameState(gameState));
        
        // Notify others in game
        socket.to(`game:${gameId}`).emit('player-joined', { playerId: currentUserId });
        
        // Broadcast updates
        await broadcastGameMetadata(io, databaseManager, gameId);
        await broadcastLobbyUpdate(io, databaseManager);
        
      } catch (error) {
        serverLogger.error('Join game error:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });
    
    // Leave game
    socket.on('leave-game', async () => {
      if (!currentGameId || !currentUserId) return;
      
      try {
        const gameId = currentGameId;
        
        // Mark player as inactive in game
        await databaseManager.setPlayerInGame(gameId, currentUserId, false);
        
        // Leave game room, rejoin lobby
        await socket.leave(`game:${gameId}`);
        await socket.join('lobby');
        
        serverLogger.info(`🚪 User ${currentUserId} left game ${gameId}`);
        
        // Notify others in game
        socket.to(`game:${gameId}`).emit('player-left', { playerId: currentUserId });
        
        currentGameId = null;
        
        // Broadcast updates
        await broadcastGameMetadata(io, databaseManager, gameId);
        await broadcastLobbyUpdate(io, databaseManager);
        
      } catch (error) {
        serverLogger.error('Leave game error:', error);
      }
    });
    
    // Disconnect cleanup
    socket.on('disconnect', async () => {
      serverLogger.info(`🔌 User ${currentUserId} disconnected`);
      
      if (currentGameId && currentUserId) {
        // Mark player as inactive
        await databaseManager.setPlayerInGame(currentGameId, currentUserId, false);
        
        // Notify others in game
        socket.to(`game:${currentGameId}`).emit('player-left', { playerId: currentUserId });
        
        // Broadcast updates
        await broadcastGameMetadata(io, databaseManager, currentGameId);
        await broadcastLobbyUpdate(io, databaseManager);
      }
    });
  });
}
