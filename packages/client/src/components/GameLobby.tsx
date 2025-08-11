import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

interface GameRoom {
  id: string
  name: string
  playerCount: number
  maxPlayers: number
  status: 'waiting' | 'playing' | 'finished'
  createdAt: string
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

  useEffect(() => {
    loadGames()
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
        navigate(`/game/${result.game.id}`)
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

  const joinGame = async (gameId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/game/${gameId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        navigate(`/game/${gameId}`)
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to join game')
      }
    } catch (error) {
      console.error('Failed to join game:', error)
      alert('Failed to join game')
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
        <div className="create-game-section">
          <h2>Create New Game</h2>
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
                        👥 {game.playerCount}/{game.maxPlayers} players
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
                      onClick={() => joinGame(game.id)}
                      className="btn-primary"
                      disabled={game.status !== 'waiting' && game.status !== 'playing'}
                    >
                      {game.status === 'waiting' ? 'Join Game' : 
                       game.status === 'playing' ? 'Spectate' : 'Finished'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lobby-info">
          <h3>🎮 How to Play</h3>
          <ul>
            <li>🏗️ <strong>Build Structures:</strong> Place Tetris-like pieces on the grid</li>
            <li>⚔️ <strong>Capture Territory:</strong> Adjacent structures battle based on combined values</li>
            <li>📈 <strong>Grow Your Empire:</strong> Capture enemy structures to expand</li>
            <li>🏰 <strong>Strategic Placement:</strong> Use amplifiers and fortresses wisely</li>
            <li>🌍 <strong>Massive Scale:</strong> Play with hundreds of other players simultaneously</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
