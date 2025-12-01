import { Server as SocketServer } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { GameState, GameMetadata, LobbyUpdate } from '@wallgame/shared';
import { serverLogger } from '../utils/logger';
import { verifyJWT } from '../utils/jwt';
import { generateRandomMap } from '../game/map-generator';
import { v4 as uuidv4 } from 'uuid';

/**
 * Track active user sessions to enforce one-socket-per-user
 */
const userSockets = new Map<string, string>(); // userId -> socketId

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
 * Use this when games list changes (created/deleted)
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
 * Broadcast just the online player count (lightweight)
 * Use this when total connected players changes (connect/disconnect only)
 */
function broadcastPlayerCount(io: SocketServer, logger: any): void {
  const count = io.sockets.sockets.size;
  io.to('lobby').emit('lobby:player-count', { onlinePlayerCount: count });
  logger.debug(`📡 Broadcast player count: ${count}`);
}

/**
 * Broadcast game metadata updates to both game room and lobby
 * Use this whenever game metadata changes (player joins/leaves)
 * Queries metadata once and broadcasts to both audiences
 */
async function broadcastGameUpdate(
  io: SocketServer, 
  db: DatabaseManager, 
  gameId: string,
  logger: any
): Promise<void> {
  const gameMetadata = await db.getGameMetadata(gameId);
  if (!gameMetadata) return;
  
  // Broadcast to players in the game
  io.to(`game:${gameId}`).emit('game:metadata', gameMetadata);
  io.to('lobby').emit('lobby:game-updated', gameMetadata);
  
  logger.debug(`📡 Broadcast game metadata updates for game ${gameId}: ${gameMetadata.activePlayerCount}/${gameMetadata.playerCount} players`);
}

/**
 * Common logic for leaving a game
 * Used by: leave-game event, auto-leave when joining different game, disconnect cleanup
 */
async function handleLeaveGame(
  io: SocketServer,
  db: DatabaseManager,
  socket: any,
  userId: string,
  gameId: string,
  logger: any
): Promise<void> {
  // Mark player as inactive in game
  await db.setPlayerInGame(gameId, userId, false);
  
  // Leave game room (no-op on disconnect, but harmless)
  await socket.leave(`game:${gameId}`);
  
  // Notify others in game
  socket.to(`game:${gameId}`).emit('player-left', { playerId: userId });
  
  logger.info(`🚪 Left game ${gameId.substring(0, 8)}`);

  // Broadcast updates to game room and lobby
  await broadcastGameUpdate(io, db, gameId, logger);
}

export function setupSocketHandlers(io: SocketServer, gameManager: GameManager, databaseManager: DatabaseManager) {
  serverLogger.info('🔧 Setting up socket.io handlers');
  
  io.on('connection', async (socket) => {
    serverLogger.info(`🔗 New connection attempt: ${socket.id.substring(0, 8)}`);
    let currentUserId: string | null = null;
    let currentUsername: string | null = null;
    let currentGameId: string | null = null;
    
    // Socket-scoped logger that automatically includes connection context
    const socketLogger = {
      _prefix: () => `[${socket.id.substring(0, 8)}|${currentUsername || '?'}|${currentUserId?.substring(0, 8) || '?'}]`,
      info: (msg: string) => serverLogger.info(`${socketLogger._prefix()} ${msg}`),
      warn: (msg: string) => serverLogger.warn(`${socketLogger._prefix()} ${msg}`),
      error: (msg: string, err?: any) => serverLogger.error(`${socketLogger._prefix()} ${msg}`, err),
      debug: (msg: string) => serverLogger.debug(`${socketLogger._prefix()} ${msg}`),
    };

    // Authenticate socket connection
    const token = socket.handshake.auth.token;
    if (!token) {
      serverLogger.warn(`❌ [${socket.id.substring(0, 8)}] No authentication token`);
      socket.disconnect();
      return;
    }

    try {
      const decoded = verifyJWT(token);
      currentUserId = decoded.userId;
      currentUsername = decoded.username;
      
      // Enforce one-socket-per-user: disconnect any existing socket for this user
      const existingSocketId = userSockets.get(currentUserId);
      if (existingSocketId) {
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          serverLogger.info(`🔄 Disconnecting existing socket for user ${currentUsername} (${existingSocketId.substring(0, 8)})`);
          existingSocket.emit('warn', { message: 'Logged in from another location' });
          existingSocket.disconnect(true);
        }
      }
      
      // Register this socket for this user
      userSockets.set(currentUserId, socket.id);
      
    } catch (error) {
      serverLogger.error(`❌ [${socket.id.substring(0, 8)}] Authentication failed:`, error);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
      return;
    }

    // ===== REGISTER ALL EVENT HANDLERS FIRST (before any async operations) =====
    socketLogger.info('📋 Registering event handlers');
    
    // ===== LOBBY EVENTS =====
    
    // Join lobby (client requests when GameLobby mounts)
    socket.on('lobby:join', async () => {
      await socket.join('lobby');
      socketLogger.info('✅ Joined lobby');
      
      const games: GameMetadata[] = await databaseManager.getActiveGames();
      socket.emit('lobby:update', {
        games,
        onlinePlayerCount: io.sockets.sockets.size
      });
    });
    
    // Leave lobby room
    socket.on('lobby:leave', async () => {
      await socket.leave('lobby');
      socketLogger.info('👋 Left lobby');
    });
    
    // Get all games (legacy - kept for backwards compatibility)
    //TODO DELETE
    socket.on('get-games', async () => {
      try {
        const games = await databaseManager.getActiveGames();
        socket.emit('games-list', games);
      } catch (error) {
        socketLogger.error('❌ Get games error:', error);
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
        
        socketLogger.info(`🎮 Creating game "${data.name}" (${mapWidth}x${mapHeight})`);
        
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
        
        socketLogger.info(`✅ Game "${data.name}" created (${gameId.substring(0, 8)})`);
        
        // Broadcast to ALL in lobby (something changed)
        await broadcastLobbyUpdate(io, databaseManager);
        
        // Respond directly to creator
        socket.emit('game-created', { gameId });
      } catch (error) {
        socketLogger.error('❌ Create game error:', error);
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
        
        socketLogger.info(`🗑️ Deleted game ${data.gameId.substring(0, 8)}`);
        
        // Broadcast lobby update to all clients in lobby
        await broadcastLobbyUpdate(io, databaseManager);
      } catch (error) {
        socketLogger.error('❌ Delete game error:', error);
        socket.emit('error', { message: 'Failed to delete game' });
      }
    });
    
    // ===== GAME EVENTS =====
    
    // Join game
    socket.on('join-game', async (data: { gameId: string }) => {
      socketLogger.info(`🎮 RECEIVED join-game event with data: ${JSON.stringify(data)}`);
      try {
        const { gameId } = data;
        
        // Check if user is already in another game - if so, leave it first
        const currentGame = await databaseManager.getUserCurrentGame(currentUserId!);
        if (currentGame && currentGame.gameId !== gameId) {
          socketLogger.info(`🔄 Auto-leaving game ${currentGame.gameId.substring(0, 8)} to join ${gameId.substring(0, 8)}`);
          await handleLeaveGame(io, databaseManager, socket, currentUserId!, currentGame.gameId, socketLogger);
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
        
        // Leave lobby room and join game room
        // await socket.leave('lobby');
        // socketLogger.info(`🚪 Left lobby`);
        await socket.join(`game:${gameId}`);
        
        socketLogger.info(`✅ Joined game ${gameId.substring(0, 8)}`);
        
        currentGameId = gameId;    
        
        // Send game state to joining player
        socket.emit('game-state', serializeGameState(gameState));
        
        // Notify others a player joined
        socket.to(`game:${gameId}`).emit('player-joined', { playerId: currentUserId });
        
        // Broadcast updates to game room and lobby (includes the joining player)
        await broadcastGameUpdate(io, databaseManager, gameId, socketLogger);
        
      } catch (error) {
        socketLogger.error('❌ Join game error:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });
    
    // Leave game
    socket.on('leave-game', async (callback) => {
      if (!currentGameId || !currentUserId) {
        if (callback) callback({ success: true });
        return;
      }
      
      try {
        const gameId = currentGameId;
        currentGameId = null;
        
        await handleLeaveGame(io, databaseManager, socket, currentUserId, gameId, socketLogger);
        
        // Send acknowledgement that leave is complete
        if (callback) callback({ success: true });
        
      } catch (error) {
        socketLogger.error('❌ Leave game error:', error);
        if (callback) callback({ success: false, error: 'Failed to leave game' });
      }
    });
    
    // Disconnect cleanup
    socket.on('disconnect', async () => {
      // Broadcast updated player count to lobby
      broadcastPlayerCount(io, socketLogger);
      
      if (currentUserId) {
        // Remove from user tracking
        userSockets.delete(currentUserId);
        
        // Leave game if in one
        if (currentGameId) {
          const gameId = currentGameId;
          currentGameId = null;
          await handleLeaveGame(io, databaseManager, socket, currentUserId, gameId, socketLogger);
        }
      }

      socketLogger.info('🔌 Disconnected');
    });

    // ===== INITIALIZATION (after handlers are registered) ===== 
    await socket.join(`user:${currentUserId}`);
    socketLogger.info('🔌 Connected');
    broadcastPlayerCount(io, socketLogger);
    socketLogger.info('🔌 Ready for events');
  });
}
