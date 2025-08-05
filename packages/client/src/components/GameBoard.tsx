import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore, useAuthStore } from '../stores'
import * as SharedTypes from '@wallgame/shared'
import { StructurePalette, PlayerDashboard, ChatPanel } from '.'

export function GameBoard() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  
  const { user } = useAuthStore()
  const { 
    socket,
    connected,
    currentGame,
    players,
    selectedStructure,
    previewPosition,
    connectSocket,
    joinGame,
    leaveGame,
    placeStructure,
    setPreviewPosition
  } = useGameStore()

  useEffect(() => {
    if (!gameId) {
      navigate('/lobby')
      return
    }

    connectSocket()
    
    if (socket && connected) {
      joinGame(gameId)
    }

    return () => {
      leaveGame()
    }
  }, [gameId, socket, connected, connectSocket, joinGame, leaveGame, navigate])

  useEffect(() => {
    if (!socket) return

    socket.on('error', (errorData: { message: string }) => {
      setError(errorData.message)
    })

    return () => {
      socket.off('error')
    }
  }, [socket])

  useEffect(() => {
    if (!canvasRef.current || !currentGame) return

    drawGame()
  }, [currentGame, selectedStructure, previewPosition])

  const drawGame = () => {
    const canvas = canvasRef.current
    if (!canvas || !currentGame) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set canvas size to fill container
    const container = canvas.parentElement
    if (container) {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height)

    // Draw structures
    if (currentGame.grid) {
      drawStructures(ctx, currentGame.grid)
    }

    // Draw preview
    if (selectedStructure && previewPosition) {
      drawStructurePreview(ctx, selectedStructure, previewPosition)
    }
  }

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 40
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1

    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  const drawStructures = (ctx: CanvasRenderingContext2D, grid: any) => {
    const gridSize = 40

    Object.entries(grid).forEach(([key, cell]: [string, any]) => {
      if (!cell || !cell.structure) return

      const [x, y] = key.split(',').map(Number)
      const structure = cell.structure

      // Draw structure
      ctx.fillStyle = getPlayerColor(structure.playerId)
      ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize)

      // Draw border
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 2
      ctx.strokeRect(x * gridSize, y * gridSize, gridSize, gridSize)

      // Draw structure type indicator
      ctx.fillStyle = '#fff'
      ctx.font = '20px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        getStructureSymbol(structure.type),
        x * gridSize + gridSize / 2,
        y * gridSize + gridSize / 2 + 7
      )
    })
  }

  const drawStructurePreview = (ctx: CanvasRenderingContext2D, structureType: string, position: { x: number; y: number }) => {
    const gridSize = 40
    
    // Draw preview with transparency
    ctx.globalAlpha = 0.5
    ctx.fillStyle = getPlayerColor(user?.id || 'preview')
    ctx.fillRect(position.x * gridSize, position.y * gridSize, gridSize, gridSize)
    
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.strokeRect(position.x * gridSize, position.y * gridSize, gridSize, gridSize)
    
    ctx.fillStyle = '#fff'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(
      getStructureSymbol(structureType),
      position.x * gridSize + gridSize / 2,
      position.y * gridSize + gridSize / 2 + 7
    )
    
    ctx.globalAlpha = 1.0
  }

  const getPlayerColor = (playerId: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ]
    const hash = playerId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    return colors[Math.abs(hash) % colors.length]
  }

  const getStructureSymbol = (type: string): string => {
    const symbols: { [key: string]: string } = {
      'basic': '■',
      'generator': '⚡',
      'fortress': '🏰',
      'amplifier': '📡',
      'scout': '👁',
      'saboteur': '💣'
    }
    return symbols[type] || '■'
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedStructure || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / 40)
    const y = Math.floor((event.clientY - rect.top) / 40)

    const action = {
      type: SharedTypes.ActionType.PLACE_STRUCTURE,
      playerId: user?.id || '',
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
    const x = Math.floor((event.clientX - rect.left) / 40)
    const y = Math.floor((event.clientY - rect.top) / 40)

    setPreviewPosition({ x, y })
  }

  const handleCanvasMouseLeave = () => {
    setPreviewPosition(null)
  }

  const handleLeaveGame = () => {
    leaveGame()
    navigate('/lobby')
  }

  if (error) {
    return (
      <div className="game-error">
        <h2>Game Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/lobby')} className="btn-primary">
          Back to Lobby
        </button>
      </div>
    )
  }

  if (!connected || !currentGame) {
    return (
      <div className="game-loading">
        <h2>Connecting to Game...</h2>
        <p>Please wait while we load the battlefield...</p>
      </div>
    )
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <h1>🏰 Game {gameId}</h1>
        <div className="game-controls">
          <span className="player-count">👥 {players.length} players</span>
          <button onClick={handleLeaveGame} className="btn-secondary">
            Leave Game
          </button>
        </div>
      </div>

      <div className="game-layout">
        <div className="game-sidebar">
          <PlayerDashboard />
          <StructurePalette />
        </div>

        <div className="game-main">
          <canvas
            ref={canvasRef}
            className="game-canvas"
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
          />
        </div>

        <div className="game-chat">
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
