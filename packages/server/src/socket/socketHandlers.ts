import { Server as SocketServer } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { ActionType } from '@wallgame/shared';

export function setupSocketHandlers(io: SocketServer, gameManager: GameManager) {
  io.on('connection', (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);

    // Join game room
    socket.on('join-game', async (data: { gameId: string; playerId: string }) => {
      const { gameId, playerId } = data;
      
      try {
        await socket.join(gameId);
        console.log(`👤 Player ${playerId} joined game ${gameId}`);
        
        // Send current game state
        const gameState = await gameManager.getGameState(gameId);
        if (gameState) {
          socket.emit('game-state', gameState);
        }
        
        // Notify other players
        socket.to(gameId).emit('player-joined', { playerId });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    // Leave game room
    socket.on('leave-game', async (data: { gameId: string; playerId: string }) => {
      const { gameId, playerId } = data;
      
      try {
        await socket.leave(gameId);
        console.log(`👋 Player ${playerId} left game ${gameId}`);
        
        // Notify other players
        socket.to(gameId).emit('player-left', { playerId });
      } catch (error) {
        console.error('Error leaving game:', error);
      }
    });

    // Handle game actions
    socket.on('game-action', async (data: { gameId: string; action: any }) => {
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
    socket.on('disconnect', () => {
      console.log(`🔌 Player disconnected: ${socket.id}`);
      
      // Notify all rooms this player was in
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.to(room).emit('player-disconnected', { playerId: socket.id });
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
