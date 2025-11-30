import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { io } from 'socket.io-client'
import { TerrainWeights, GameMetadata, LobbyUpdate, getLogger } from '@wallgame/shared'

const clientLogger = getLogger('client');

interface GameSettings {
  mapSource: 'custom'  // Currently only custom supported
  mapWidth: number
  mapHeight: number
  maxPlayers: number
  terrainWeights: TerrainWeights
  prodTickInterval: number
  popTickInterval: number
  artifactReleaseTime: number
  winConditionDuration: number
  maxDuration: number | null
}

// Default spawn frequencies (50 = standard rate, 0-200 range)
const DEFAULT_TERRAIN_WEIGHTS: TerrainWeights = {
  forest: 50,
  hills: 50,
  mountain: 50,
  desert: 50,
  swamp: 50,
  water: 50
}

const DEFAULT_SETTINGS: GameSettings = {
  mapSource: 'custom',
  mapWidth: 200,        // Smaller default for testing (spec says 1000)
  mapHeight: 200,       // Smaller default for testing (spec says 2000)
  maxPlayers: 100,
  terrainWeights: { ...DEFAULT_TERRAIN_WEIGHTS },
  prodTickInterval: 10,
  popTickInterval: 600,
  artifactReleaseTime: 12,
  winConditionDuration: 0.5,
  maxDuration: null
}

interface GameLobbyProps {
  user: any
  onLogout: () => void
}

export function GameLobby({ user, onLogout }: GameLobbyProps) {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const [games, setGames] = useState<GameMetadata[]>([])
  const [onlinePlayerCount, setOnlinePlayerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newGameName, setNewGameName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [socket, setSocket] = useState<any>(null)

  useEffect(() => {
    // Connect to socket for lobby
    const newSocket = io('http://localhost:3001', {
      auth: { token }
    })
    
    newSocket.on('connect', () => {
      clientLogger.info('✅ Connected to lobby')
      // Join lobby room for real-time updates
      newSocket.emit('lobby:join')
    })
    
    // Listen for lobby updates (new event-driven system)
    newSocket.on('lobby:update', (update: LobbyUpdate) => {
      clientLogger.info('📡 Lobby update:', update.games.length, 'games,', update.onlinePlayerCount, 'online')
      setGames(update.games)
      setOnlinePlayerCount(update.onlinePlayerCount)
      setLoading(false)
    })
    
    // Legacy games-list support (fallback)
    newSocket.on('games-list', (gameList: GameMetadata[]) => {
      clientLogger.info('📡 Received games list:', gameList.length, 'games')
      setGames(gameList)
      setLoading(false)
    })
    
    newSocket.on('game-created', (data: { gameId: string }) => {
      clientLogger.info('✅ Game created:', data.gameId)
      setNewGameName('')
      setCreating(false)
    })
    
    newSocket.on('error', (error: { message: string }) => {
      clientLogger.error('❌ Socket error:', error.message)
      alert(error.message)
      setCreating(false)
    })
    
    setSocket(newSocket)
    
    // Cleanup on unmount
    return () => {
      newSocket.emit('lobby:leave')
      newSocket.close()
    }
  }, [token])

  const createGame = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGameName.trim() || creating || !socket) return

    setCreating(true)
    
    socket.emit('create-game', { 
      name: newGameName.trim(),
      settings: {
        mapWidth: settings.mapWidth,
        mapHeight: settings.mapHeight,
        maxPlayers: settings.maxPlayers,
        terrainWeights: settings.terrainWeights,
        prodTickInterval: settings.prodTickInterval,
        popTickInterval: settings.popTickInterval,
        artifactReleaseTime: settings.artifactReleaseTime,
        winConditionDuration: settings.winConditionDuration,
        maxDuration: settings.maxDuration
      }
    })
  }

  const joinGame = (gameId: string) => {
    // Navigate to game page (which will trigger join-game socket event)
    navigate(`/game/${gameId}`)
  }

  const deleteGame = (gameId: string, gameName: string) => {
    if (!confirm(`Are you sure you want to delete "${gameName}"?`)) {
      return
    }

    if (socket) {
      socket.emit('delete-game', { gameId })
    }
  }

  const handleLogout = () => {
    onLogout()
  }

  if (loading) {
    return (
      <div className="lobby-container">
        <div className="lobby-header">
          <h1>🏰 WallGame Lobby</h1>
          <p>Loading games...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lobby-container">
      <div className="lobby-header">
        <div className="lobby-title">
          <h1>🏰 WallGame Lobby</h1>
          <p>Welcome back, <strong>{user?.username}</strong>! <span className="online-count">({onlinePlayerCount} players online)</span></p>
        </div>
        <button onClick={handleLogout} className="btn-secondary">
          Logout
        </button>
      </div>

      <div className="lobby-content">
        {user?.isAdmin && (
          <div className="create-game-section">
            <h2>Create New Game (Admin)</h2>
            <form onSubmit={createGame} className="create-game-form">
              <div className="form-row">
                <label htmlFor="gameName">Game Name</label>
                <input
                  id="gameName"
                  type="text"
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  placeholder="Enter game name..."
                  maxLength={50}
                  disabled={creating}
                  data-testid="game-name-input"
                  required
                />
              </div>

              <div className="form-row form-row-inline">
                <div className="form-field">
                  <label htmlFor="mapWidth">Map Width</label>
                  <input
                    id="mapWidth"
                    type="number"
                    value={settings.mapWidth}
                    onChange={(e) => setSettings({ ...settings, mapWidth: parseInt(e.target.value) || 100 })}
                    min={50}
                    max={2000}
                    disabled={creating}
                    data-testid="map-width-input"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="mapHeight">Map Height</label>
                  <input
                    id="mapHeight"
                    type="number"
                    value={settings.mapHeight}
                    onChange={(e) => setSettings({ ...settings, mapHeight: parseInt(e.target.value) || 100 })}
                    min={50}
                    max={2000}
                    disabled={creating}
                    data-testid="map-height-input"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="maxPlayers">Max Players</label>
                  <input
                    id="maxPlayers"
                    type="number"
                    value={settings.maxPlayers}
                    onChange={(e) => setSettings({ ...settings, maxPlayers: parseInt(e.target.value) || 10 })}
                    min={2}
                    max={500}
                    disabled={creating}
                    data-testid="max-players-input"
                  />
              </div>
              </div>

              <div className="terrain-weights-section">
                <h4>Terrain Spawn Frequency</h4>
                <p className="terrain-hint">50% = standard, 0% = none, 200% = 4x frequency</p>
                <div className="terrain-sliders">
                  {Object.entries(settings.terrainWeights).map(([terrain, weight]) => (
                    <div key={terrain} className="terrain-slider">
                      <label htmlFor={`terrain-${terrain}`}>
                        <span className={`terrain-color terrain-${terrain}`}></span>
                        {terrain.charAt(0).toUpperCase() + terrain.slice(1)}
                      </label>
                      <input
                        id={`terrain-${terrain}`}
                        type="range"
                        min="0"
                        max="200"
                        value={weight}
                        onChange={(e) => setSettings({
                          ...settings,
                          terrainWeights: {
                            ...settings.terrainWeights,
                            [terrain]: parseInt(e.target.value)
                          }
                        })}
                        disabled={creating}
                        data-testid={`terrain-${terrain}-slider`}
                      />
                      <span className="weight-value">{weight}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                type="button" 
                className="btn-link"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? '▼ Hide Advanced Settings' : '▶ Show Advanced Settings'}
              </button>

              {showAdvanced && (
                <div className="advanced-settings">
                  <div className="form-row form-row-inline">
                    <div className="form-field">
                      <label htmlFor="prodTickInterval">Prod Tick Interval</label>
                      <input
                        id="prodTickInterval"
                        type="number"
                        value={settings.prodTickInterval}
                        onChange={(e) => setSettings({ ...settings, prodTickInterval: parseInt(e.target.value) || 10 })}
                        min={1}
                        max={100}
                        disabled={creating}
                        data-testid="prod-tick-input"
                      />
                      <span className="field-hint">Game ticks per prod tick</span>
                    </div>
                    <div className="form-field">
                      <label htmlFor="popTickInterval">Pop Tick Interval</label>
                      <input
                        id="popTickInterval"
                        type="number"
                        value={settings.popTickInterval}
                        onChange={(e) => setSettings({ ...settings, popTickInterval: parseInt(e.target.value) || 600 })}
                        min={10}
                        max={3600}
                        disabled={creating}
                        data-testid="pop-tick-input"
                      />
                      <span className="field-hint">Game ticks per pop tick</span>
                    </div>
                  </div>

                  <div className="form-row form-row-inline">
                    <div className="form-field">
                      <label htmlFor="artifactReleaseTime">Artifact Release</label>
                      <input
                        id="artifactReleaseTime"
                        type="number"
                        value={settings.artifactReleaseTime}
                        onChange={(e) => setSettings({ ...settings, artifactReleaseTime: parseInt(e.target.value) || 12 })}
                        min={1}
                        max={100}
                        disabled={creating}
                        data-testid="artifact-release-input"
                      />
                      <span className="field-hint">Pop ticks until artifacts</span>
                    </div>
                    <div className="form-field">
                      <label htmlFor="winConditionDuration">Win Duration (hrs)</label>
                      <input
                        id="winConditionDuration"
                        type="number"
                        step="0.5"
                        value={settings.winConditionDuration}
                        onChange={(e) => setSettings({ ...settings, winConditionDuration: parseFloat(e.target.value) || 0.5 })}
                        min={0.5}
                        max={24}
                        disabled={creating}
                        data-testid="win-duration-input"
                      />
                      <span className="field-hint">Hours to hold artifacts</span>
                    </div>
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                className="btn-primary btn-create"
                disabled={creating || !newGameName.trim()}
                data-testid="create-game-button"
              >
                {creating ? 'Creating...' : 'Create Game'}
              </button>
            </form>
          </div>
        )}

        <div className="games-section">
          <h2>Active Games ({games.length})</h2>
          
          {games.length === 0 ? (
            <div className="no-games">
              <p>No active games found.</p>
              <p>Create the first game to start playing!</p>
            </div>
          ) : (
            <div className="games-list">
              {games.map((game) => (
                <div key={game.id} className="game-card">
                  <div className="game-info">
                    <h3>{game.name}</h3>
                    <div className="game-stats">
                      <span className="player-count">
                        👥 {game.activePlayerCount}/{game.playerCount} players ({game.maxPlayers} max)
                      </span>
                      <span className={`game-status status-${game.status}`}>
                        {game.status}
                      </span>
                    </div>
                    <div className="game-map-size">
                      🗺️ {game.mapWidth}×{game.mapHeight}
                    </div>
                    <div className="game-time">
                      Created: {new Date(game.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="game-actions">
                    <button
                      onClick={() => joinGame(game.id)}
                      className="btn-primary"
                      disabled={game.status === 'finished'}
                    >
                      {game.status === 'paused' 
                        ? 'Join Game' 
                        : game.status === 'playing' 
                          ? 'Join Game' 
                          : 'Finished'}
                    </button>
                    {user?.isAdmin && (
                      <button
                        onClick={() => deleteGame(game.id, game.name)}
                        className="btn-danger"
                        style={{ marginLeft: '10px' }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lobby-info">
          <h3>🎮 How to Play</h3>
          <ul>
            <li>� <strong>Build Cities:</strong> Convert Settlers into 3×3 city structures</li>
            <li>🏗️ <strong>Construct Buildings:</strong> Resource production and unit training</li>
            <li>⚔️ <strong>Train Units:</strong> Raise armies to defend and conquer</li>
            <li>📈 <strong>Manage Resources:</strong> Food and materials for growth</li>
            <li>🌍 <strong>Massive Scale:</strong> Play with hundreds of other players simultaneously</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
