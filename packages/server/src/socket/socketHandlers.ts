import { Server as SocketServer } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { ActionType } from '@wallgame/shared';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

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
        
        // Get user info from database
        const userInfo = await databaseManager.getUserById(currentUserId);
        if (!userInfo) {
          socket.emit('error', { message: 'User not found' });
          return;
        }
        
        // Create player object
        const teamColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'];
        const player = {
          id: currentUserId,
          username: userInfo.username,
          teamId: uuidv4(), // Generate a new team ID for the player
          color: teamColors[Math.floor(Math.random() * teamColors.length)],
          isOnline: true,
          resources: 100,
          lastSeen: new Date()
        };
        
        // Add player to game via GameManager
        await gameManager.addPlayerToGame(gameId, player);
        
        // Add player to database for persistent tracking
        await databaseManager.addPlayerToGame(gameId, currentUserId, player.teamId);
        
        console.log(`👤 Player ${currentUserId} joined game ${gameId}`);
        
        // Initialize or get game state
        let gameState = await gameManager.getGameState(gameId);
        if (!gameState) {
          // Initialize new game state if it doesn't exist
          await gameManager.initializeGame(gameId);
          gameState = await gameManager.getGameState(gameId);
        }
        
        if (gameState) {
          socket.emit('game-state', gameState);
        }
        
        // Notify other players
        socket.to(gameId).emit('player-joined', { playerId: currentUserId });
        
        // Send updated player list
        const players = await gameManager.getGamePlayers(gameId);
        io.to(gameId).emit('players-update', players);
        
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
        await socket.leave(gameId);
        
        // Remove player from game state and database
        await gameManager.removePlayerFromGame(gameId, playerId);
        await databaseManager.removePlayerFromGame(gameId, playerId);
        
        console.log(`👋 Player ${playerId} left game ${gameId}`);
        
        // Notify other players
        socket.to(gameId).emit('player-left', { playerId });
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
          
          // Send updated game state
          const gameState = await gameManager.getGameState(gameId);
          if (gameState) {
            io.to(gameId).emit('game-state-update', gameState);
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
      
      // If player was in a game, remove them
      if (currentUserId && currentGameId) {
        try {
          await gameManager.removePlayerFromGame(currentGameId, currentUserId);
          await databaseManager.removePlayerFromGame(currentGameId, currentUserId);
          console.log(`👋 Player ${currentUserId} automatically removed from game ${currentGameId} on disconnect`);
        } catch (error) {
          console.error('Error removing player on disconnect:', error);
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
