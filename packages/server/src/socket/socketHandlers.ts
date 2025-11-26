import { Server as SocketServer } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { ActionType, GameState } from '@wallgame/shared';
import jwt from 'jsonwebtoken';
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

export function setupSocketHandlers(io: SocketServer, gameManager: GameManager, databaseManager: DatabaseManager) {
  io.on('connection', (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);
    console.log(`🔍 Socket handshake auth:`, socket.handshake.auth);
    
    let currentUserId: string | null = null;
    let currentGameId: string | null = null;

    // Authenticate socket connection
    const token = socket.handshake.auth.token;
    console.log(`🔍 Socket auth token received:`, token ? 'YES' : 'NO');
    console.log(`🔍 Socket auth token value:`, token);
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wallgame-secret') as any;
        currentUserId = decoded.userId;
        console.log(`🔐 Socket authenticated for user: ${currentUserId}`);
      } catch (error) {
        console.log('❌ Socket authentication failed:', error);
        socket.emit('error', { message: 'Authentication failed' });
        // Don't return - allow unauthenticated connections for now
      }
    } else {
      console.log('❌ No authentication token provided');
      // For now, allow unauthenticated connections with a placeholder user ID
      currentUserId = `anonymous-${socket.id}`;
      console.log(`🔄 Using placeholder user ID: ${currentUserId}`);
    }

    // Join game room
    socket.on('join-game', async (data: { gameId: string }) => {
      if (!data) {
        console.error('Join game: No data provided');
        socket.emit('error', { message: 'Invalid join game request' });
        return;
      }
      
      const { gameId } = data;
      
      if (!currentUserId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }
      
      try {
        await socket.join(gameId);
        currentGameId = gameId;
        
        // Initialize or get game state
        let gameState = await gameManager.getGameState(gameId);
        if (!gameState) {
          // Initialize new game state if it doesn't exist
          await gameManager.initializeGame(gameId);
          gameState = await gameManager.getGameState(gameId);
        }
        
        // Check if player already exists in the game
        const existingPlayer = gameState?.players.get(currentUserId);
        
        if (existingPlayer) {
          // Player already in game, just mark as online
          await gameManager.setPlayerOnlineStatus(gameId, currentUserId, true);
          console.log(`👤 Player ${currentUserId} reconnected to game ${gameId}`);
        } else {
          // Player not in game yet - they need to join via REST API first
          console.log(`⚠️ Player ${currentUserId} tried to join game ${gameId} without being a participant`);
          socket.emit('error', { 
            message: 'You must join this game from the lobby first',
            code: 'NOT_A_PARTICIPANT'
          });
          return;
        }
        
        // Refresh game state after player update
        gameState = await gameManager.getGameState(gameId);
        
        if (gameState) {
          // Serialize game state (converts Maps, includes terrainData)
          const serializedState = serializeGameState(gameState);
          socket.emit('game-state', serializedState);
        }
        
        // Notify other players
        socket.to(gameId).emit('player-joined', { playerId: currentUserId });
        
        // Send updated player list
        const players = await gameManager.getGamePlayers(gameId);
        io.to(gameId).emit('players-update', players);
        
        // Broadcast lobby update to all connected clients
        const games = await databaseManager.getActiveGames();
        for (const game of games) {
          const onlineCount = await gameManager.getOnlinePlayerCount(game.id);
          const totalCount = await gameManager.getTotalPlayerCount(game.id);
          game.online_players = onlineCount;
          game.total_players = totalCount;
          game.current_players = `${onlineCount}/${totalCount}`;
        }
        io.emit('lobby-update', games);
        
      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    // Leave game room
    socket.on('leave-game', async (data: { gameId: string; playerId: string }) => {
      if (!data) {
        console.error('Leave game: No data provided');
        socket.emit('error', { message: 'Invalid leave game request' });
        return;
      }
      
      const { gameId, playerId } = data;
      
      try {
        // Mark player as offline BEFORE leaving the room (so we can still broadcast)
        await gameManager.setPlayerOnlineStatus(gameId, playerId, false);
        
        console.log(`👋 Player ${playerId} left game ${gameId} (marked offline)`);
        
        // Notify other players in the game room
        socket.to(gameId).emit('player-left', { playerId });
        
        // Send updated player list to remaining players in the game
        const players = await gameManager.getGamePlayers(gameId);
        io.to(gameId).emit('players-update', players);
        
        // Now leave the socket room
        await socket.leave(gameId);
        currentGameId = null;
        
        // Broadcast lobby update to all connected clients
        const games = await databaseManager.getActiveGames();
        for (const game of games) {
          const onlineCount = await gameManager.getOnlinePlayerCount(game.id);
          const totalCount = await gameManager.getTotalPlayerCount(game.id);
          game.online_players = onlineCount;
          game.total_players = totalCount;
          game.current_players = `${onlineCount}/${totalCount}`;
        }
        io.emit('lobby-update', games);
      } catch (error) {
        console.error('Error leaving game:', error);
      }
    });

    // Handle game actions
    socket.on('game-action', async (data: { gameId: string; action: any }) => {
      if (!data) {
        console.error('Game action: No data provided');
        socket.emit('error', { message: 'Invalid game action request' });
        return;
      }
      
      const { gameId, action } = data;
      
      try {
        const result = await gameManager.processAction(gameId, action);
        
        if (result.success) {
          // Broadcast action to all players in the game
          io.to(gameId).emit('action-processed', {
            action,
            timestamp: new Date()
          });
          
          // Send updated game state (properly serialized)
          const gameState = await gameManager.getGameState(gameId);
          if (gameState) {
            io.to(gameId).emit('game-state-update', serializeGameState(gameState));
          }
        } else {
          socket.emit('action-failed', {
            action,
            error: result.error
          });
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to process action' });
      }
    });

    // Handle chat messages
    socket.on('chat-message', async (data: { gameId: string; playerId: string; message: string }) => {
      if (!data) {
        console.error('Chat message: No data provided');
        socket.emit('error', { message: 'Invalid chat message request' });
        return;
      }
      
      const { gameId, playerId, message } = data;
      
      try {
        const chatAction = {
          type: ActionType.CHAT_MESSAGE,
          playerId,
          timestamp: new Date(),
          data: { message }
        };
        
        // Broadcast chat message to all players in the game
        io.to(gameId).emit('chat-message', {
          playerId,
          message,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to send chat message' });
      }
    });

    // Handle structure placement preview
    socket.on('preview-structure', (data: { gameId: string; positions: any[]; structureType: string }) => {
      // Broadcast preview to other players for real-time feedback
      socket.to(data.gameId).emit('structure-preview', {
        playerId: socket.id,
        positions: data.positions,
        structureType: data.structureType
      });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`🔌 Player disconnected: ${socket.id}`);
      
      // If player was in a game, mark them as offline (don't remove them!)
      if (currentUserId && currentGameId) {
        try {
          await gameManager.setPlayerOnlineStatus(currentGameId, currentUserId, false);
          console.log(`👋 Player ${currentUserId} marked offline in game ${currentGameId}`);
          
          // Broadcast lobby update to all connected clients
          const games = await databaseManager.getActiveGames();
          for (const game of games) {
            const onlineCount = await gameManager.getOnlinePlayerCount(game.id);
            const totalCount = await gameManager.getTotalPlayerCount(game.id);
            game.online_players = onlineCount;
            game.total_players = totalCount;
            game.current_players = `${onlineCount}/${totalCount}`;
          }
          io.emit('lobby-update', games);
          
          // Also update players in the game room
          const players = await gameManager.getGamePlayers(currentGameId);
          io.to(currentGameId).emit('players-update', players);
        } catch (error) {
          console.error('Error marking player offline on disconnect:', error);
        }
      }
      
      // Notify all rooms this player was in
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.to(room).emit('player-disconnected', { playerId: currentUserId || socket.id });
        }
      });
    });

    // Handle ping for latency measurement
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback();
      }
    });

    // Request game list
    socket.on('get-active-games', async () => {
      try {
        const games = await gameManager.getActiveGames();
        socket.emit('active-games', games);
      } catch (error) {
        socket.emit('error', { message: 'Failed to get active games' });
      }
    });
  });

  // Handle server-side events
  setInterval(() => {
    io.emit('server-time', { timestamp: new Date() });
  }, 30000); // Send time sync every 30 seconds
}
