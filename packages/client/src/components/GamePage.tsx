import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useGameStore } from '../stores'
import { useAuthStore } from '../stores/authStore'
import { GameGrid } from './GameGrid'
import { SelectedEntity } from './SelectedEntity'
import { GameInfo } from './GameInfo'
import { ChatPanel } from './ChatPanel'

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  
  const {
    connectSocket,
    disconnectSocket,
    joinGame,
    leaveGame,
    currentGame,
    connected
  } = useGameStore()

  const { isAuthenticated, token, user } = useAuthStore()

  // Initialize socket connection and join game - only once when gameId is set
  useEffect(() => {
    if (!gameId || !user || !isAuthenticated || !token) return

    // Connect and join game
    connectSocket()
    const joinTimer = setTimeout(() => {
      joinGame(gameId)
    }, 100)

    return () => {
      clearTimeout(joinTimer)
      // Only cleanup when actually leaving the page (unmounting)
    }
  }, [gameId]) // Only depend on gameId - user/token shouldn't change while on page

  // Cleanup when leaving the page (separate effect)
  useEffect(() => {
    return () => {
      leaveGame()
      disconnectSocket()
    }
  }, []) // Empty deps = only runs on unmount

  const handleExitGame = () => {
    leaveGame()
    navigate('/lobby')
  }

  const gameName = currentGame?.name || 'Loading...'

  return (
    <div className="game-page">
      {/* Header Bar */}
      <header className="game-header">
        <div className="game-header-left">
          <h1 data-testid="game-name">{gameName}</h1>
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢' : '🔴'}
          </span>
        </div>
        <GameInfo />
        <div className="game-header-right">
          <span data-testid="player-username">{user?.username}</span>
          <button 
            onClick={handleExitGame} 
            className="btn-exit" 
            data-testid="leave-game-button"
          >
            Exit Game
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="game-main">
        {/* Game Grid (with Minimap overlay) */}
        <section className="game-grid-section">
          <GameGrid />
        </section>

        {/* Selected Entity Sidebar */}
        <aside className="game-sidebar">
          <SelectedEntity />
        </aside>
      </main>

      {/* Chat Bar */}
      <footer className="game-footer">
        <ChatPanel />
      </footer>
    </div>
  )
}
