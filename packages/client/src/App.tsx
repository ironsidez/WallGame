import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { GameLobby, GamePage, Login } from './components'
import { useAuthStore } from './stores/authStore'
import { useGameStore } from './stores/gameStore'
import './App.css'

function App() {
  const { isAuthenticated, user, checkAuth, logout } = useAuthStore()
  const { currentGameId } = useGameStore()

  // Check if user is already logged in on app start
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Determine default redirect based on whether user was in a game
  const defaultRedirect = currentGameId ? `/game/${currentGameId}` : '/lobby'

  return (
    <Router>
      <div className="App">
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </>
          ) : (
            <>
              <Route path="/lobby" element={<GameLobby user={user} onLogout={logout} />} />
              <Route path="/game/:gameId" element={<GamePage />} />
              <Route path="*" element={<Navigate to={defaultRedirect} />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  )
}

export default App
