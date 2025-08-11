import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../stores'
import { useAuthStore } from '../stores/authStore'
import { StructurePalette } from './StructurePalette'
import { ChatPanel } from './ChatPanel'
import { PlayerDashboard } from './PlayerDashboard'
import { ActionType } from '@wallgame/shared'

interface GameBoardProps {
  user: any
}

const CELL_SIZE = 40
const GRID_WIDTH = 25
const GRID_HEIGHT = 20

export function GameBoard({ user }: GameBoardProps) {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewPosition, setPreviewPosition] = useState<{x: number, y: number} | null>(null)
  
  const {
    connectSocket,
    disconnectSocket,
    joinGame,
    leaveGame,
    placeStructure,
    selectedStructure,
    currentGame,
    players,
    connected
  } = useGameStore()

  const { isAuthenticated, token } = useAuthStore()

  // Initialize socket connection and join game
  useEffect(() => {
    if (gameId && user && isAuthenticated && token) {
      console.log('🎮 Attempting to connect socket and join game...')
      
      // Add a delay to ensure auth store is fully loaded
      const timer = setTimeout(() => {
        connectSocket()
        
        // Small delay to ensure socket is connected
        setTimeout(() => {
          joinGame(gameId)
        }, 100)
      }, 200)

      return () => clearTimeout(timer)
    }

    return () => {
      leaveGame()
      disconnectSocket()
    }
  }, [gameId, user, isAuthenticated, token])

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1

    // Vertical lines
    for (let x = 0; x <= GRID_WIDTH; x++) {
      ctx.beginPath()
      ctx.moveTo(x * CELL_SIZE, 0)
      ctx.lineTo(x * CELL_SIZE, GRID_HEIGHT * CELL_SIZE)
      ctx.stroke()
    }

    // Horizontal lines
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * CELL_SIZE)
      ctx.lineTo(GRID_WIDTH * CELL_SIZE, y * CELL_SIZE)
      ctx.stroke()
    }

    // Draw structures (placeholder - will be populated from game state)
    if (currentGame?.structures) {
      Object.values(currentGame.structures).forEach((structure: any) => {
        ctx.fillStyle = getTeamColor(structure.teamId)
        structure.positions?.forEach((pos: any) => {
          ctx.fillRect(
            pos.x * CELL_SIZE + 2,
            pos.y * CELL_SIZE + 2,
            CELL_SIZE - 4,
            CELL_SIZE - 4
          )
        })
      })
    }

    // Draw preview structure
    if (previewPosition && selectedStructure) {
      ctx.fillStyle = 'rgba(0, 150, 255, 0.5)'
      ctx.fillRect(
        previewPosition.x * CELL_SIZE + 2,
        previewPosition.y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
      )
    }
  }, [currentGame, previewPosition, selectedStructure])

  const getTeamColor = (teamId: string): string => {
    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff']
    const hash = teamId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedStructure || !canvasRef.current || !user) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / CELL_SIZE)
    const y = Math.floor((event.clientY - rect.top) / CELL_SIZE)

    // Validate placement bounds
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return

    const action = {
      type: ActionType.PLACE_STRUCTURE,
      playerId: user.id,
      timestamp: new Date(),
      data: {
        structureType: selectedStructure,
        positions: [{ x, y }],
        rotation: 0
      }
    }

    placeStructure(action)
  }

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedStructure || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / CELL_SIZE)
    const y = Math.floor((event.clientY - rect.top) / CELL_SIZE)

    // Only update if position is valid
    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
      setPreviewPosition({ x, y })
    }
  }

  const handleCanvasMouseLeave = () => {
    setPreviewPosition(null)
  }

  const handleLeaveGame = () => {
    leaveGame()
    navigate('/lobby')
  }

  return (
    <div className="game-board-container">
      <div className="game-header">
        <h1>🎮 Game: {gameId}</h1>
        <div className="game-info">
          <span>Player: {user?.username}</span>
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span>Players: {players.length}</span>
        </div>
        <button onClick={handleLeaveGame} className="btn-secondary">
          Back to Lobby
        </button>
      </div>

      <div className="game-layout">
        <div className="game-sidebar-left">
          <StructurePalette />
          <PlayerDashboard />
        </div>

        <div className="game-main">
          <div className="game-canvas-container">
            <canvas
              ref={canvasRef}
              width={GRID_WIDTH * CELL_SIZE}
              height={GRID_HEIGHT * CELL_SIZE}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              className="game-canvas"
            />
          </div>
        </div>

        <div className="game-sidebar-right">
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
