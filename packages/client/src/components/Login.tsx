import { useState } from 'react'
import { useAuthStore } from '../stores'

export function Login() {
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { login, register } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isRegistering) {
        await register(email, password, username)
      } else {
        await login(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="menu-container">
      <div className="menu-card">
        <h1>🏰 WallGame</h1>
        <p className="subtitle">Massive Multiplayer Territory Control</p>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <h2>{isRegistering ? 'Create Account' : 'Login'}</h2>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {isRegistering && (
            <div className="form-group">
              <label htmlFor="username">Username:</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                minLength={3}
                maxLength={20}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isRegistering ? 'Create Account' : 'Login')}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsRegistering(!isRegistering)}
            disabled={loading}
          >
            {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
          </button>
        </form>

        <div className="game-info">
          <h3>🎮 Game Features</h3>
          <ul>
            <li>⚔️ Real-time territorial battles</li>
            <li>🧩 Tetris-like structure building</li>
            <li>🏰 Hundreds of simultaneous players</li>
            <li>📈 Strategic resource management</li>
            <li>🌍 Infinite expandable world</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
