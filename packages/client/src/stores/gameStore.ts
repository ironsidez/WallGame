import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import { GameState, GameAction, Player } from '@wallgame/shared'
import { useAuthStore } from './authStore'

interface GameStore {
  // Socket connection
  socket: Socket | null
  connected: boolean
  
  // Game state
  currentGame: GameState | null
  players: Player[]
  currentPlayer: Player | null
  
  // UI state
  selectedStructure: string | null
  isPlacing: boolean
  previewPosition: { x: number; y: number } | null
  
  // Actions
  connectSocket: () => void
  disconnectSocket: () => void
  joinGame: (gameId: string) => void
  leaveGame: () => void
  placeStructure: (action: GameAction) => void
  selectStructure: (structureType: string) => void
  setPreviewPosition: (position: { x: number; y: number } | null) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  socket: null,
  connected: false,
  currentGame: null,
  players: [],
  currentPlayer: null,
  selectedStructure: null,
  isPlacing: false,
  previewPosition: null,

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
      set({ isPlacing: false, previewPosition: null })
    })

    newSocket.on('action-failed', (error: { message: string }) => {
      console.error('Action failed:', error.message)
      alert(error.message)
      set({ isPlacing: false, previewPosition: null })
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
      set({ isPlacing: false, selectedStructure: null, previewPosition: null })
      
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
    const { socket } = get()
    if (socket) {
      socket.emit('leave-game')
      set({ 
        currentGame: null, 
        players: [], 
        currentPlayer: null,
        selectedStructure: null,
        isPlacing: false,
        previewPosition: null
      })
    }
  },

  placeStructure: (action: GameAction) => {
    const { socket } = get()
    if (socket && action) {
      set({ isPlacing: true })
      socket.emit('game-action', action)
    }
  },

  selectStructure: (structureType: string) => {
    set({ 
      selectedStructure: structureType,
      isPlacing: false,
      previewPosition: null
    })
  },

  setPreviewPosition: (position: { x: number; y: number } | null) => {
    set({ previewPosition: position })
  },
}))

// Socket event helpers
export const emitChatMessage = (message: string) => {
  const socket = useGameStore.getState().socket
  if (socket) {
    socket.emit('chat-message', { message })
  }
}

export const emitStructurePreview = (position: { x: number; y: number }, structureType: string) => {
  const socket = useGameStore.getState().socket
  if (socket) {
    socket.emit('preview-structure', { position, structureType })
  }
}
