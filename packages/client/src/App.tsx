import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { GameLobby, GameBoard, Login } from './components'
import { useAuthStore } from './stores'
import './App.css'

function App() {
  const { isAuthenticated, checkAuth } = useAuthStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth().finally(() => setLoading(false))
  }, [checkAuth])

  if (loading) {
    return (
      <div className="menu-container">
        <div className="menu-card">
          <h2>Loading WallGame...</h2>
          <p>Preparing your massive multiplayer RTS experience...</p>
        </div>
      </div>
    )
  }

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
              <Route path="/lobby" element={<GameLobby />} />
              <Route path="/game/:gameId" element={<GameBoard />} />
              <Route path="*" element={<Navigate to="/lobby" />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  )
}

export default App
