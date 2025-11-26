import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { io, Socket } from 'socket.io-client'

interface GameRoom {
  id: string
  name: string
  current_players: string // Format: "1/3" (online/total)
  online_players: number
  total_players: number
  maxPlayers: number
  status: 'waiting' | 'playing' | 'finished'
  createdAt: string
  isParticipating?: boolean
}

interface GameSettings {
  mapWidth: number
  mapHeight: number
  maxPlayers: number
  prodTickInterval: number
  popTickInterval: number
  artifactReleaseTime: number
  winConditionDuration: number
  maxDuration: number | null
}

const DEFAULT_SETTINGS: GameSettings = {
  mapWidth: 200,        // Smaller default for testing (spec says 1000)
  mapHeight: 200,       // Smaller default for testing (spec says 2000)
  maxPlayers: 100,
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
  const [games, setGames] = useState<GameRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newGameName, setNewGameName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    loadGames()
    
    // Connect to socket for real-time lobby updates
    const newSocket = io('http://localhost:3001', {
      auth: { token }
    })
    
    setSocket(newSocket)
    
    // Listen for lobby updates - trigger a reload to get user-specific isParticipating flag
    newSocket.on('lobby-update', () => {
      console.log('📡 Received lobby update notification, reloading games...')
      loadGames()
    })
    
    // Cleanup on unmount
    return () => {
      newSocket.close()
    }
  }, [])

  const loadGames = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/game/active', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const gameList = await response.json()
        setGames(gameList)
      }
    } catch (error) {
      console.error('Failed to load games:', error)
    } finally {
      setLoading(false)
    }
  }

  const createGame = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGameName.trim() || creating) return

    setCreating(true)
    try {
      const response = await fetch('http://localhost:3001/api/game/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: newGameName.trim(),
          settings: {
            mapWidth: settings.mapWidth,
            mapHeight: settings.mapHeight,
            maxPlayers: settings.maxPlayers,
            prodTickInterval: settings.prodTickInterval,
            popTickInterval: settings.popTickInterval,
            artifactReleaseTime: settings.artifactReleaseTime,
            winConditionDuration: settings.winConditionDuration,
            maxDuration: settings.maxDuration
          }
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setNewGameName('')
        // Reload the game list to show the new game
        await loadGames()
        alert(`Game "${result.game.name}" created successfully!`)
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to create game')
      }
    } catch (error) {
      console.error('Failed to create game:', error)
      alert('Failed to create game')
    } finally {
      setCreating(false)
    }
  }

  const joinGame = async (gameId: string, isParticipating: boolean = false) => {
    try {
      // If already participating, just navigate to the game
      if (isParticipating) {
        navigate(`/game/${gameId}`)
        return
      }

      // Otherwise, join via API first
      const response = await fetch(`http://localhost:3001/api/game/${gameId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        // Refresh game list to show updated player count before navigating
        await loadGames()
        navigate(`/game/${gameId}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to join game')
      }
    } catch (error) {
      console.error('Failed to join game:', error)
      alert('Failed to join game')
    }
  }

  const deleteGame = async (gameId: string, gameName: string) => {
    if (!confirm(`Are you sure you want to delete "${gameName}"?`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3001/api/game/${gameId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        // Refresh the game list
        await loadGames()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete game')
      }
    } catch (error) {
      console.error('Failed to delete game:', error)
      alert('Failed to delete game')
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
          <p>Welcome back, <strong>{user?.username}</strong>!</p>
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
                        👥 {game.current_players} players
                      </span>
                      <span className={`game-status status-${game.status}`}>
                        {game.status}
                      </span>
                    </div>
                    <div className="game-time">
                      Created: {new Date(game.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="game-actions">
                    <button
                      onClick={() => joinGame(game.id, game.isParticipating)}
                      className="btn-primary"
                      disabled={game.status === 'finished'}
                    >
                      {game.isParticipating 
                        ? 'Open Game' 
                        : game.status === 'waiting' 
                          ? 'Join Game' 
                          : game.status === 'playing' 
                            ? 'Spectate' 
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
