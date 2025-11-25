import { useAuthStore, useGameStore } from '../stores'

export function PlayerDashboard() {
  const { user } = useAuthStore()
  const { currentGame, players } = useGameStore()

  // Extract player stats from game state
  const playerStats = {
    cities: 0,
    units: 0,
    population: 0,
    food: 0,
    materials: 0
  }

  // TODO: Calculate from actual game state when available
  if (currentGame && user) {
    // playerStats.cities = Object.values(currentGame.cities || {}).filter((c: any) => c.playerId === user.id).length
    // playerStats.units = Object.values(currentGame.units || {}).filter((u: any) => u.playerId === user.id).length
  }

  return (
    <div className="player-dashboard">
      <div className="player-info">
        <h3>👤 {user?.username}</h3>
        <div className="player-status online">Online</div>
      </div>

      <div className="player-stats">
        <h4>📊 Resources</h4>
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-label">🌾 Food</div>
            <div className="stat-value">{playerStats.food}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">🪵 Materials</div>
            <div className="stat-value">{playerStats.materials}</div>
          </div>
        </div>
      </div>

      <div className="player-stats">
        <h4>🏛️ Empire</h4>
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-label">� Cities</div>
            <div className="stat-value">{playerStats.cities}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">⚔️ Units</div>
            <div className="stat-value">{playerStats.units}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">👥 Population</div>
            <div className="stat-value">{playerStats.population}</div>
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
                  � {0} {/* TODO: Calculate city count */}
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
            <span className="info-label">Map Size:</span>
            <span className="info-value">50×50</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h4>⚡ Quick Actions</h4>
        <button className="action-btn" title="Center view on your cities">
          � My Cities
        </button>
        <button className="action-btn" title="View all units">
          ⚔️ My Units
        </button>
        <button className="action-btn" title="View game statistics">
          � Stats
        </button>
      </div>
    </div>
  )
}
