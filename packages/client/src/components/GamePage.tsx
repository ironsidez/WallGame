import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useGameStore } from '../stores'
import { useAuthStore } from '../stores/authStore'
import { GameGrid } from './GameGrid'
import { SelectedEntity } from './SelectedEntity'
import { GameInfo } from './GameInfo'
import { ChatPanel } from './ChatPanel'
import { getLogger } from '@wallgame/shared'

const clientLogger = getLogger('client')

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  
  const {
    joinGame,
    leaveGame,
    currentGame,
    connected,
    socket
  } = useGameStore()

  const { isAuthenticated, user } = useAuthStore()

  // Join game when component mounts
  useEffect(() => {
    clientLogger.info(`🎮 GamePage effect - gameId: ${gameId}, user: ${user?.username}, auth: ${isAuthenticated}, socket: ${!!socket}, connected: ${connected}`)
    
    if (!gameId || !user || !isAuthenticated || !socket || !connected) {
      clientLogger.warn('⏸️ GamePage waiting for requirements')
      return
    }

    // Join game room (socket already connected from login)
    clientLogger.info(`⏰ Scheduling join-game for ${gameId.substring(0, 8)}`)
    const joinTimer = setTimeout(() => {
      clientLogger.info(`📤 Calling joinGame(${gameId.substring(0, 8)})`)
      joinGame(gameId)
    }, 100)

    return () => {
      clearTimeout(joinTimer)
      // Leave game room when unmounting (but keep socket alive)
      clientLogger.info('🧹 GamePage cleanup - calling leaveGame()')
      // Cleanup can't be async, but we'll let leaveGame complete in background
      leaveGame().catch(err => clientLogger.error('Error in cleanup:', err))
    }
  }, [gameId, socket, connected, user, isAuthenticated, joinGame, leaveGame])

  const handleExitGame = async () => {
    // Wait for leave-game to complete before navigating
    await leaveGame()
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
