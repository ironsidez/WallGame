import { useRef, useState, useEffect, useCallback } from 'react'
import { useGameStore } from '../stores'
import { TerrainType, clientLogger } from '@wallgame/shared'

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
  
  // Get grid squares from game state (can be object or Map) - for entities
  const gridSquares: Record<string, any> = currentGame?.grid?.squares || {}
  
  // Get compact terrain data (2D array) for efficient terrain lookup
  const terrainData: TerrainType[][] | undefined = (currentGame as any)?.terrainData
  
  // Debug logging for terrainData
  useEffect(() => {
    clientLogger.debug('🗺️ GameGrid terrainData changed:', {
      hasTerrainData: !!terrainData,
      rows: terrainData?.length || 0,
      cols: terrainData?.[0]?.length || 0,
      sample: terrainData?.[0]?.[0]
    });
  }, [terrainData]);

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

  // Debug: Log terrainData once when it changes
  useEffect(() => {
    if (terrainData && terrainData.length > 0) {
      // Count terrain types
      const counts: Record<string, number> = {};
      for (let y = 0; y < Math.min(terrainData.length, 100); y++) {
        for (let x = 0; x < Math.min(terrainData[y]?.length || 0, 100); x++) {
          const t = terrainData[y][x];
          counts[t] = (counts[t] || 0) + 1;
        }
      }
      clientLogger.debug('🗺️ TerrainData received:', {
        rows: terrainData.length,
        cols: terrainData[0]?.length,
        sample: terrainData[0]?.slice(0, 10),
        distribution: counts
      });
    } else {
      clientLogger.warn('🗺️ No terrainData available');
    }
  }, [terrainData]);

  // Get terrain from actual game state, fallback to procedural
  const getTerrainAt = useCallback((x: number, y: number): TerrainType => {
    // First check compact terrainData (efficient 2D array format)
    if (terrainData && terrainData[y] && terrainData[y][x] !== undefined) {
      return terrainData[y][x] as TerrainType
    }
    
    // Fallback to gridSquares lookup (for partial updates)
    const key = positionToKey(x, y)
    const square = gridSquares[key]
    
    if (square?.terrain !== undefined) {
      return square.terrain
    }
    
    // Default to plains while waiting for terrain data to load
    // (avoids showing temporary procedural map that differs from server)
    return TerrainType.PLAINS
  }, [terrainData, gridSquares])

  const getTerrainColor = useCallback((terrain: TerrainType): string => {
    const colors: Record<TerrainType, string> = {
      [TerrainType.PLAINS]: '#7cba5f',
      [TerrainType.FOREST]: '#2d5a27',
      [TerrainType.HILLS]: '#8b7355',
      [TerrainType.MOUNTAIN]: '#5a5a5a',
      [TerrainType.DESERT]: '#d4b871',
      [TerrainType.SWAMP]: '#4a5a3a',
      [TerrainType.RIVER]: '#4a90d9',
      [TerrainType.OCEAN]: '#2563a8',
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
          terrainData={terrainData}
          getTerrainColor={getTerrainColor}
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
  terrainData?: any[][]
  getTerrainColor: (terrain: TerrainType) => string
  onNavigate: (x: number, y: number) => void
}

function Minimap({ viewport, mapWidth, mapHeight, terrainData, getTerrainColor, onNavigate }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // Calculate minimap dimensions based on map aspect ratio
  const BASE_SIZE = 200 // Target size for the larger dimension
  const MIN_SIZE = 100  // Minimum size for smaller dimension
  
  const aspectRatio = mapWidth / mapHeight
  let minimapWidth: number
  let minimapHeight: number
  
  if (aspectRatio > 1) {
    // Wider than tall
    minimapWidth = BASE_SIZE
    minimapHeight = Math.max(MIN_SIZE, BASE_SIZE / aspectRatio)
  } else {
    // Taller than wide
    minimapHeight = BASE_SIZE
    minimapWidth = Math.max(MIN_SIZE, BASE_SIZE * aspectRatio)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Calculate scale
    const scaleX = minimapWidth / mapWidth
    const scaleY = minimapHeight / mapHeight

    // Clear background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, minimapWidth, minimapHeight)

    // Draw terrain if available
    if (terrainData && terrainData.length > 0) {
      // Sample terrain at intervals for performance
      const sampleRate = Math.max(1, Math.floor(Math.max(mapWidth, mapHeight) / 200))
      
      const maxY = Math.min(mapHeight, terrainData.length)
      const maxX = terrainData[0] ? Math.min(mapWidth, terrainData[0].length) : 0
      
      for (let y = 0; y < maxY; y += sampleRate) {
        for (let x = 0; x < maxX; x += sampleRate) {
          if (terrainData[y] && terrainData[y][x] !== undefined) {
            const terrain = terrainData[y][x] as TerrainType
            ctx.fillStyle = getTerrainColor(terrain)
            ctx.fillRect(
              x * scaleX, 
              y * scaleY, 
              Math.max(1, sampleRate * scaleX), 
              Math.max(1, sampleRate * scaleY)
            )
          }
        }
      }
    } else {
      // Fallback: draw simplified terrain rectangle
      ctx.fillStyle = '#3d5a3d'
      ctx.fillRect(0, 0, minimapWidth, minimapHeight)
    }

    // Draw viewport rectangle
    const vpX = viewport.x * scaleX
    const vpY = viewport.y * scaleY
    const vpWidth = viewport.width * scaleX
    const vpHeight = viewport.height * scaleY

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeRect(vpX, vpY, vpWidth, vpHeight)

    // Semi-transparent fill for viewport
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(vpX, vpY, vpWidth, vpHeight)

  }, [viewport, mapWidth, mapHeight, terrainData, getTerrainColor, minimapWidth, minimapHeight])

  const handleMouseEvent = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = minimapWidth / mapWidth
    const scaleY = minimapHeight / mapHeight
    
    const x = (e.clientX - rect.left) / scaleX
    const y = (e.clientY - rect.top) / scaleY
    
    onNavigate(x, y)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    handleMouseEvent(e)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMouseEvent(e)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  return (
    <canvas
      ref={canvasRef}
      width={minimapWidth}
      height={minimapHeight}
      className="minimap-canvas"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
    />
  )
}
