import { useAuthStore, useGameStore } from '../stores'

export function PlayerDashboard() {
  const { user } = useAuthStore()
  const { currentGame, players } = useGameStore()

  // Mock player stats - in a real game these would come from the game state
  const playerStats = {
    resources: 100,
    structures: 15,
    territory: 25,
    score: 340
  }

  return (
    <div className="player-dashboard">
      <div className="player-info">
        <h3>👤 {user?.username}</h3>
        <div className="player-status online">Online</div>
      </div>

      <div className="player-stats">
        <h4>📊 Statistics</h4>
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-label">💰 Resources</div>
            <div className="stat-value">{playerStats.resources}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">🏗️ Structures</div>
            <div className="stat-value">{playerStats.structures}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">🗺️ Territory</div>
            <div className="stat-value">{playerStats.territory}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">🏆 Score</div>
            <div className="stat-value">{playerStats.score}</div>
          </div>
        </div>
      </div>

      <div className="players-list">
        <h4>👥 Players ({players.length})</h4>
        <div className="players-container">
          {players.length === 0 ? (
            <p className="no-players">Loading players...</p>
          ) : (
            players.map((player) => (
              <div key={player.id} className="player-item">
                <div className="player-name">
                  {player.username}
                  {player.id === user?.id && ' (You)'}
                </div>
                <div className="player-score">
                  🏆 {player.resources || 0}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="game-info">
        <h4>🎮 Game Info</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Status:</span>
            <span className="info-value">
              {currentGame?.gamePhase || 'Active'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Players:</span>
            <span className="info-value">
              {currentGame?.players ? currentGame.players.size : 0}
            </span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h4>⚡ Quick Actions</h4>
        <button className="action-btn" title="Center view on your territory">
          🎯 Center View
        </button>
        <button className="action-btn" title="Show game statistics">
          📈 Stats
        </button>
        <button className="action-btn" title="View game rules">
          📖 Rules
        </button>
      </div>
    </div>
  )
}
