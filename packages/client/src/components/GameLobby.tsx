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
        body: JSON.stringify({ name: newGameName.trim() }),
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
              <input
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder="Enter game name..."
                maxLength={50}
                disabled={creating}
                required
              />
              <button 
                type="submit" 
                className="btn-primary"
                disabled={creating || !newGameName.trim()}
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
