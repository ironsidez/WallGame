import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { io, Socket } from 'socket.io-client'
import { GameState, Player, GameMetadata, getLogger } from '@wallgame/shared'
import { useAuthStore } from './authStore'

const clientLogger = getLogger('client');

interface GameStore {
  // Socket connection
  socket: Socket | null
  connected: boolean
  
  // Game state
  currentGame: GameState | null
  currentGameId: string | null
  gameMetadata: GameMetadata | null  // Real-time metadata
  players: Player[]
  currentPlayer: Player | null
  
  // UI state
  selectedUnit: string | null
  selectedCity: string | null
  selectedBuilding: string | null
  
  // Actions
  connectSocket: () => void
  disconnectSocket: () => void
  joinGame: (gameId: string) => void
  leaveGame: () => void
  selectUnit: (unitId: string | null) => void
  selectCity: (cityId: string | null) => void
  selectBuilding: (buildingId: string | null) => void
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // Initial state
      socket: null,
      connected: false,
      currentGame: null,
      currentGameId: null,
      gameMetadata: null,
      players: [],
      currentPlayer: null,
      selectedUnit: null,
      selectedCity: null,
      selectedBuilding: null,

  connectSocket: () => {
    const { socket } = get()
    if (socket?.connected) return

    // Get the token from the auth store
    const token = useAuthStore.getState().token
    clientLogger.debug('🔍 Token from authStore:', token ? 'FOUND' : 'NOT FOUND')
    
    if (token) {
      clientLogger.debug('🔍 Token preview:', token.substring(0, 50) + '...')
    }

    clientLogger.debug('🔍 Final token for socket:', token ? 'YES' : 'NO')

    const newSocket = io('http://localhost:3001', {
      auth: {
        token: token
      }
    })

    newSocket.on('connect', () => {
      clientLogger.info('Connected to game server')
      set({ connected: true })
    })

    newSocket.on('disconnect', () => {
      clientLogger.info('Disconnected from game server')
      set({ connected: false })
    })

    newSocket.on('game-state', (gameState: GameState) => {
      const terrainRows = (gameState as any)?.terrainData?.length || 'NONE';
      const terrainCols = terrainRows !== 'NONE' ? (gameState as any)?.terrainData[0]?.length || 0 : 0;
      clientLogger.debug('📥 game-state received');
      clientLogger.debug('   terrainData:', terrainRows, 'x', terrainCols);
      clientLogger.debug('   full gameState keys:', Object.keys(gameState));
      clientLogger.debug('   terrainData sample [0][0]:', (gameState as any)?.terrainData?.[0]?.[0]);
      set({ currentGame: gameState })
    })

    newSocket.on('game-state-update', (gameState: GameState) => {
      const terrainRows = (gameState as any)?.terrainData?.length || 'NONE';
      const terrainCols = terrainRows !== 'NONE' ? (gameState as any)?.terrainData[0]?.length || 0 : 0;
      clientLogger.debug('📥 game-state-update received');
      clientLogger.debug('   terrainData:', terrainRows, 'x', terrainCols);
      set({ currentGame: gameState })
    })

    // Listen for game metadata updates (player counts, status, etc.)
    newSocket.on('game:metadata', (metadata: GameMetadata) => {
      clientLogger.info('📡 Game metadata update:', metadata.activePlayerCount, '/', metadata.playerCount, 'players');
      set({ gameMetadata: metadata })
    })

    newSocket.on('players-update', (players: Player[]) => {
      set({ players })
    })

    newSocket.on('player-joined', (data: { playerId: string }) => {
      clientLogger.info('👋 Player joined:', data.playerId)
    })

    newSocket.on('player-left', (data: { playerId: string }) => {
      clientLogger.info('👋 Player left:', data.playerId)
    })

    newSocket.on('error', (error: { message: string }) => {
      clientLogger.error('❌ Socket error:', error.message)
      alert(error.message)
    })

    newSocket.on('action-processed', (result: { success: boolean; message?: string }) => {
      if (!result.success) {
        clientLogger.error('Action failed:', result.message)
        alert(result.message || 'Action failed')
      }
    })

    newSocket.on('action-failed', (error: { message: string }) => {
      clientLogger.error('Action failed:', error.message)
      alert(error.message)
    })

    set({ socket: newSocket })
  },

  disconnectSocket: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ 
        socket: null, 
        connected: false,
        currentGame: null,
        gameMetadata: null,
        players: [],
        currentPlayer: null
      })
    }
  },

  joinGame: (gameId: string) => {
    const { socket } = get()
    if (socket) {
      socket.emit('join-game', { gameId })
      set({ 
        currentGameId: gameId, // Save the game ID to localStorage
        selectedUnit: null, 
        selectedCity: null, 
        selectedBuilding: null 
      })
    }
  },

  leaveGame: () => {
    const { socket, currentGameId } = get()
    if (socket && currentGameId) {
      socket.emit('leave-game')
      
      set({ 
        currentGame: null,
        currentGameId: null,
        gameMetadata: null,
        players: [], 
        currentPlayer: null,
        selectedUnit: null,
        selectedCity: null,
        selectedBuilding: null
      })
    }
  },

  selectUnit: (unitId: string | null) => {
    set({ selectedUnit: unitId, selectedCity: null, selectedBuilding: null })
  },

  selectCity: (cityId: string | null) => {
    set({ selectedCity: cityId, selectedUnit: null, selectedBuilding: null })
  },

  selectBuilding: (buildingId: string | null) => {
    set({ selectedBuilding: buildingId, selectedUnit: null, selectedCity: null })
  },
    }),
    {
      name: 'game-storage',
      partialize: (state) => ({
        currentGameId: state.currentGameId, // Only persist the game ID, not the game state
      }),
    }
  )
)

// Socket event helpers
export const emitChatMessage = (message: string) => {
  const socket = useGameStore.getState().socket
  if (socket) {
    socket.emit('chat-message', { message })
  }
}
