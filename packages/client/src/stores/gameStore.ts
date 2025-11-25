import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { io, Socket } from 'socket.io-client'
import { GameState, Player } from '@wallgame/shared'
import { useAuthStore } from './authStore'

interface GameStore {
  // Socket connection
  socket: Socket | null
  connected: boolean
  
  // Game state
  currentGame: GameState | null
  currentGameId: string | null // Add this to track which game we're in
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
    console.log('🔍 Token from authStore:', token ? 'FOUND' : 'NOT FOUND')
    
    if (token) {
      console.log('🔍 Token preview:', token.substring(0, 50) + '...')
    }

    console.log('🔍 Final token for socket:', token ? 'YES' : 'NO')

    const newSocket = io('http://localhost:3001', {
      auth: {
        token: token
      }
    })

    newSocket.on('connect', () => {
      console.log('Connected to game server')
      set({ connected: true })
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from game server')
      set({ connected: false })
    })

    newSocket.on('game-state', (gameState: GameState) => {
      set({ currentGame: gameState })
    })

    newSocket.on('game-state-update', (gameState: GameState) => {
      set({ currentGame: gameState })
    })

    newSocket.on('players-update', (players: Player[]) => {
      set({ players })
    })

    newSocket.on('action-processed', (result: { success: boolean; message?: string }) => {
      if (!result.success) {
        console.error('Action failed:', result.message)
        alert(result.message || 'Action failed')
      }
    })

    newSocket.on('action-failed', (error: { message: string }) => {
      console.error('Action failed:', error.message)
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
        players: [],
        currentPlayer: null
      })
    }
  },

  joinGame: async (gameId: string) => {
    const { socket } = get()
    if (socket) {
      socket.emit('join-game', { gameId })
      set({ 
        currentGameId: gameId, // Save the game ID to localStorage
        selectedUnit: null, 
        selectedCity: null, 
        selectedBuilding: null 
      })
      
      // Also fetch players via API as backup
      try {
        const token = useAuthStore.getState().token
        const response = await fetch(`http://localhost:3001/api/game/${gameId}/players`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.ok) {
          const players = await response.json()
          set({ players })
        }
      } catch (error) {
        console.error('Failed to fetch players:', error)
      }
    }
  },

  leaveGame: () => {
    const { socket, currentGameId } = get()
    if (socket && currentGameId) {
      // Get current user ID from auth store
      const authState = useAuthStore.getState()
      const userId = authState.user?.id
      
      socket.emit('leave-game', { 
        gameId: currentGameId, 
        playerId: userId 
      })
      
      set({ 
        currentGame: null,
        currentGameId: null, // Clear the persisted game ID 
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
        currentGameId: state.currentGameId, // Only persist the game ID
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
