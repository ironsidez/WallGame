import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { GameLobby, GameBoard, Login } from './components'
import { useAuthStore } from './stores/authStore'
import './App.css'

function App() {
  const { isAuthenticated, user, checkAuth, logout } = useAuthStore()

  // Check if user is already logged in on app start
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

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
              <Route path="/game/:gameId" element={<GameBoard user={user} />} />
              <Route path="*" element={<Navigate to="/lobby" />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  )
}

export default App
