import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'

interface LoginProps {}

export function Login({}: LoginProps) {
  const { login, register } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (activeTab === 'login') {
        await login(formData.username, formData.password)
        setMessage('Login successful!')
      } else {
        // Registration - validate passwords match
        if (formData.password !== formData.confirmPassword) {
          setMessage('Passwords do not match')
          return
        }
        await register(formData.email, formData.password, formData.username)
        setMessage('Registration successful!')
      }
    } catch (error: any) {
      setMessage(error.message || 'Connection error. Make sure the server is running.')
    }

    setLoading(false)
  }

  return (
    <div className="menu-container">
      <div className="menu-card">
        <h1>🏰 WallGame</h1>
        <h2 className="subtitle">Massive Multiplayer RTS</h2>
        
        <div className="auth-forms">
          <div className="form-tabs">
            <button 
              className={`tab-button ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Login
            </button>
            <button 
              className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => setActiveTab('register')}
            >
              Register
            </button>
          </div>
          
          <div className="form-content">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input 
                  type="text" 
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username" 
                  required
                />
              </div>
              
              {activeTab === 'register' && (
                <div className="form-group">
                  <label>Email</label>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email" 
                    required
                  />
                </div>
              )}
              
              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password" 
                  required
                />
              </div>
              
              {activeTab === 'register' && (
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input 
                    type="password" 
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password" 
                    required
                  />
                </div>
              )}
              
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Loading...' : (activeTab === 'login' ? 'Login' : 'Register')}
              </button>
            </form>
            
            {message && (
              <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}
          </div>
        </div>

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
