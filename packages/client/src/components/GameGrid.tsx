import { useRef, useState, useEffect, useCallback } from 'react'
import { useGameStore } from '../stores'
import { TerrainType } from '@wallgame/shared'

const TILE_SIZE = 32
const VIEWPORT_PADDING = 2 // tiles of padding around viewport

// Position to key helper (matches server)
function positionToKey(x: number, y: number): string {
  return `${x},${y}`
}

export function GameGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null)
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null)
  
  const { currentGame } = useGameStore()

  // Get map dimensions from game state
  const mapWidth = currentGame?.settings?.mapWidth || currentGame?.grid?.width || 100
  const mapHeight = currentGame?.settings?.mapHeight || currentGame?.grid?.height || 100
  
  // Get grid squares from game state (can be object or Map)
  const gridSquares: Record<string, any> = currentGame?.grid?.squares || {}

  // Calculate viewport dimensions based on container size
  useEffect(() => {
    const updateViewport = () => {
      if (!containerRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const tilesWide = Math.ceil(rect.width / TILE_SIZE) + VIEWPORT_PADDING * 2
      const tilesHigh = Math.ceil(rect.height / TILE_SIZE) + VIEWPORT_PADDING * 2
      
      setViewport(prev => ({
        ...prev,
        width: tilesWide,
        height: tilesHigh
      }))
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  // Handle keyboard panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const panSpeed = 5
      const key = e.key.toLowerCase()
      
      if (key === 'w' || key === 'arrowup') {
        setViewport(prev => ({ ...prev, y: Math.max(0, prev.y - panSpeed) }))
      } else if (key === 's' || key === 'arrowdown') {
        setViewport(prev => ({ ...prev, y: Math.min(mapHeight - prev.height, prev.y + panSpeed) }))
      } else if (key === 'a' || key === 'arrowleft') {
        setViewport(prev => ({ ...prev, x: Math.max(0, prev.x - panSpeed) }))
      } else if (key === 'd' || key === 'arrowright') {
        setViewport(prev => ({ ...prev, x: Math.min(mapWidth - prev.width, prev.x + panSpeed) }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mapWidth, mapHeight])

  // Get terrain from actual game state, fallback to procedural
  const getTerrainAt = useCallback((x: number, y: number): TerrainType => {
    const key = positionToKey(x, y)
    const square = gridSquares[key]
    
    if (square?.terrain !== undefined) {
      return square.terrain
    }
    
    // Fallback procedural terrain if grid not loaded yet
    const hash = (x * 374761393 + y * 668265263) % 1000
    if (hash < 50) return TerrainType.WATER
    if (hash < 150) return TerrainType.FOREST
    if (hash < 200) return TerrainType.HILLS
    if (hash < 220) return TerrainType.MOUNTAIN
    if (hash < 250) return TerrainType.DESERT
    return TerrainType.PLAINS
  }, [gridSquares])

  const getTerrainColor = useCallback((terrain: TerrainType): string => {
    const colors: Record<TerrainType, string> = {
      [TerrainType.PLAINS]: '#7cba5f',
      [TerrainType.FOREST]: '#2d5a27',
      [TerrainType.HILLS]: '#8b7355',
      [TerrainType.MOUNTAIN]: '#5a5a5a',
      [TerrainType.WATER]: '#3b7dd8',
      [TerrainType.DESERT]: '#d4b871',
      [TerrainType.SWAMP]: '#4a5a3a',
      [TerrainType.TUNDRA]: '#c8d8e4',
    }
    return colors[terrain] || '#7cba5f'
  }, [])

  // Render the grid
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match container
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }

    // Clear canvas
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw visible tiles
    const startX = Math.floor(viewport.x)
    const startY = Math.floor(viewport.y)
    const endX = Math.min(startX + viewport.width + 1, mapWidth)
    const endY = Math.min(startY + viewport.height + 1, mapHeight)

    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        const screenX = (x - viewport.x) * TILE_SIZE
        const screenY = (y - viewport.y) * TILE_SIZE

        // Get terrain type (placeholder - will come from game state)
        const terrain = getTerrainAt(x, y)
        
        // Draw terrain tile
        ctx.fillStyle = getTerrainColor(terrain)
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE)
      }
    }

    // Highlight selected tile
    if (selectedTile) {
      const screenX = (selectedTile.x - viewport.x) * TILE_SIZE
      const screenY = (selectedTile.y - viewport.y) * TILE_SIZE
      
      ctx.strokeStyle = '#4ECDC4'
      ctx.lineWidth = 3
      ctx.strokeRect(screenX + 1, screenY + 1, TILE_SIZE - 2, TILE_SIZE - 2)
      ctx.lineWidth = 1
    }

    // Highlight hovered tile
    if (hoveredTile && (hoveredTile.x !== selectedTile?.x || hoveredTile.y !== selectedTile?.y)) {
      const screenX = (hoveredTile.x - viewport.x) * TILE_SIZE
      const screenY = (hoveredTile.y - viewport.y) * TILE_SIZE
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 2
      ctx.strokeRect(screenX + 1, screenY + 1, TILE_SIZE - 2, TILE_SIZE - 2)
      ctx.lineWidth = 1
    }

  }, [viewport, hoveredTile, selectedTile, currentGame, mapWidth, mapHeight, getTerrainAt, getTerrainColor])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE + viewport.x)
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE + viewport.y)
    
    if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
      setHoveredTile({ x, y })
    }
  }, [viewport, mapWidth, mapHeight])

  const handleMouseLeave = useCallback(() => {
    setHoveredTile(null)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE + viewport.x)
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE + viewport.y)
    
    if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
      setSelectedTile({ x, y })
    }
  }, [viewport, mapWidth, mapHeight])

  const handleMinimapNavigate = useCallback((x: number, y: number) => {
    setViewport(prev => ({
      ...prev,
      x: Math.max(0, Math.min(mapWidth - prev.width, x - prev.width / 2)),
      y: Math.max(0, Math.min(mapHeight - prev.height, y - prev.height / 2))
    }))
  }, [mapWidth, mapHeight])

  return (
    <div className="game-grid" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      
      {/* Minimap */}
      <div className="minimap">
        <Minimap 
          viewport={viewport} 
          mapWidth={mapWidth} 
          mapHeight={mapHeight}
          onNavigate={handleMinimapNavigate}
        />
      </div>

      {/* Coordinates display */}
      {hoveredTile && (
        <div className="coordinates-display">
          ({hoveredTile.x}, {hoveredTile.y})
        </div>
      )}
    </div>
  )
}

// Minimap subcomponent
interface MinimapProps {
  viewport: { x: number; y: number; width: number; height: number }
  mapWidth: number
  mapHeight: number
  onNavigate: (x: number, y: number) => void
}

function Minimap({ viewport, mapWidth, mapHeight, onNavigate }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const MINIMAP_SIZE = 150

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Calculate scale
    const scale = MINIMAP_SIZE / Math.max(mapWidth, mapHeight)
    const scaledWidth = mapWidth * scale
    const scaledHeight = mapHeight * scale

    // Clear and draw background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

    // Draw simplified terrain (just a colored rectangle for now)
    ctx.fillStyle = '#3d5a3d'
    ctx.fillRect(0, 0, scaledWidth, scaledHeight)

    // Draw viewport rectangle
    const vpX = viewport.x * scale
    const vpY = viewport.y * scale
    const vpWidth = viewport.width * scale
    const vpHeight = viewport.height * scale

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeRect(vpX, vpY, vpWidth, vpHeight)

  }, [viewport, mapWidth, mapHeight])

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scale = MINIMAP_SIZE / Math.max(mapWidth, mapHeight)
    
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    
    onNavigate(x, y)
  }

  return (
    <canvas
      ref={canvasRef}
      width={MINIMAP_SIZE}
      height={MINIMAP_SIZE}
      className="minimap-canvas"
      onClick={handleClick}
    />
  )
}
