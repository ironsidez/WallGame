import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../stores'
import { useAuthStore } from '../stores/authStore'
import { ChatPanel } from './ChatPanel'
import { PlayerDashboard } from './PlayerDashboard'

interface GameBoardProps {
  user: any
}

const CELL_SIZE = 40

export function GameBoard({ user }: GameBoardProps) {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredCell, setHoveredCell] = useState<{x: number, y: number} | null>(null)
  
  const {
    connectSocket,
    disconnectSocket,
    joinGame,
    leaveGame,
    selectedUnit,
    selectedCity,
    currentGame,
    players,
    connected
  } = useGameStore()

  const { isAuthenticated, token } = useAuthStore()

  // Get grid dimensions from game state
  const GRID_WIDTH = currentGame?.grid?.width || 50
  const GRID_HEIGHT = currentGame?.grid?.height || 30

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

    // Draw terrain (placeholder - will be populated from game state)
    if (currentGame?.grid?.squares) {
      Object.entries(currentGame.grid.squares).forEach(([key, square]: [string, any]) => {
        const terrain = square.terrain
        ctx.fillStyle = getTerrainColor(terrain)
        const [x, y] = key.split(',').map(Number)
        ctx.fillRect(
          x * CELL_SIZE,
          y * CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE
        )
      })
    }

    // Draw cities (placeholder - will be populated from game state)
    if (currentGame?.cities) {
      Object.values(currentGame.cities).forEach((city: any) => {
        ctx.fillStyle = getPlayerColor(city.playerId)
        ctx.fillRect(
          city.x * CELL_SIZE + 2,
          city.y * CELL_SIZE + 2,
          CELL_SIZE * 3 - 4,
          CELL_SIZE * 3 - 4
        )
        // Draw city icon
        ctx.fillStyle = '#fff'
        ctx.font = `${CELL_SIZE}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🏰', (city.x + 1.5) * CELL_SIZE, (city.y + 1.5) * CELL_SIZE)
      })
    }

    // Draw units (placeholder - will be populated from game state)
    if (currentGame?.units) {
      Object.values(currentGame.units).forEach((unit: any) => {
        ctx.fillStyle = getPlayerColor(unit.playerId)
        ctx.beginPath()
        ctx.arc(
          unit.x * CELL_SIZE + CELL_SIZE / 2,
          unit.y * CELL_SIZE + CELL_SIZE / 2,
          CELL_SIZE / 3,
          0,
          2 * Math.PI
        )
        ctx.fill()
        // Draw unit icon
        ctx.fillStyle = '#fff'
        ctx.font = `${CELL_SIZE / 2}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(getUnitIcon(unit.type), unit.x * CELL_SIZE + CELL_SIZE / 2, unit.y * CELL_SIZE + CELL_SIZE / 2)
      })
    }
  }, [currentGame, GRID_WIDTH, GRID_HEIGHT])

  const getTerrainColor = (terrain: string): string => {
    const colors: Record<string, string> = {
      'plains': '#90EE90',
      'forest': '#228B22',
      'mountain': '#808080',
      'water': '#4169E1',
      'desert': '#F4A460',
      'tundra': '#E0FFFF',
      'swamp': '#556B2F',
      'hills': '#8B7355'
    }
    return colors[terrain] || '#f0f0f0'
  }

  const getPlayerColor = (playerId: string): string => {
    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff']
    const hash = playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const getUnitIcon = (unitType: string): string => {
    const icons: Record<string, string> = {
      'settler': '👥',
      'infantry': '⚔️',
      'cavalry': '🐴',
      'archer': '🏹',
      'siege': '🎯'
    }
    return icons[unitType] || '▪'
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !user) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / CELL_SIZE)
    const y = Math.floor((event.clientY - rect.top) / CELL_SIZE)

    // Validate click bounds
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return

    // TODO: Handle unit selection, movement commands, city selection
    console.log(`Clicked on grid square: (${x}, ${y})`)
  }

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / CELL_SIZE)
    const y = Math.floor((event.clientY - rect.top) / CELL_SIZE)

    // Only update if position is valid
    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
      setHoveredCell({ x, y })
    }
  }

  const handleCanvasMouseLeave = () => {
    setHoveredCell(null)
  }

  const handleLeaveGame = () => {
    leaveGame()
    navigate('/lobby')
  }

  // Calculate player counts
  const onlinePlayerCount = players.filter(p => p.isOnline).length
  const totalPlayerCount = players.length
  const gameName = currentGame?.name || 'Loading...'

  return (
    <div className="game-board-container">
      <div className="game-header">
        <h1 data-testid="game-title">🎮 Game: <span data-testid="game-name">{gameName}</span></h1>
        <div className="game-info">
          <span data-testid="player-username">Player: {user?.username}</span>
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span data-testid="game-player-count">
            Players: <span data-testid="online-count">{onlinePlayerCount}</span>/<span data-testid="total-count">{totalPlayerCount}</span>
          </span>
        </div>
        <button onClick={handleLeaveGame} className="btn-secondary" data-testid="leave-game-button">
          Back to Lobby
        </button>
      </div>

      <div className="game-layout">
        <div className="game-sidebar-left">
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
