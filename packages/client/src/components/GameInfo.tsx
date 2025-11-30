import { useGameStore } from '../stores'

export function GameInfo() {
  const { currentGame, gameMetadata } = useGameStore()

  // Get player counts from gameMetadata (event-driven updates)
  const onlinePlayers = gameMetadata?.activePlayerCount ?? 0
  const totalPlayers = gameMetadata?.playerCount ?? 0

  return (
    <div className="game-info">
      <div className="game-info-left">
        <h1 className="game-name">{currentGame?.name || 'Loading...'}</h1>
        <div className="game-status">
          <StatusBadge status={currentGame?.gamePhase || 'waiting'} />
        </div>
      </div>

      <div className="game-info-center">
        <div className="tick-display">
          <label>Tick:</label>
          <span className="tick-value">{currentGame?.currentTick?.toLocaleString() || 0}</span>
        </div>
        
        <div className="artifact-status">
          <label>Artifacts:</label>
          <ArtifactStatus game={currentGame} />
        </div>
      </div>

      <div className="game-info-right">
        <div className="player-count" data-testid="game-player-count">
          <span className="online-count" data-testid="online-count">{onlinePlayers}</span>
          <span className="separator">/</span>
          <span className="total-count" data-testid="total-count">{totalPlayers}</span>
          <span className="label">players</span>
        </div>
      </div>
    </div>
  )
}

// Status badge subcomponent
interface StatusBadgeProps {
  status: string
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    waiting: { color: '#6b7280', label: 'Waiting' },
    starting: { color: '#fbbf24', label: 'Starting' },
    active: { color: '#22c55e', label: 'Active' },
    paused: { color: '#f59e0b', label: 'Paused' },
    ended: { color: '#6b7280', label: 'Ended' }
  }

  const config = statusConfig[status] || statusConfig.waiting

  return (
    <span className="status-badge" style={{ backgroundColor: config.color }}>
      {config.label}
    </span>
  )
}

// Artifact status subcomponent
interface ArtifactStatusProps {
  game?: {
    currentTick?: number
    popTickInterval?: number
    artifactReleaseTime?: number
    winnerId?: string | null
  } | null
}

function ArtifactStatus({ game }: ArtifactStatusProps) {
  if (!game) {
    return <span className="artifact-unknown">Unknown</span>
  }

  const { currentTick = 0, popTickInterval = 600, artifactReleaseTime = 12 } = game
  
  // Calculate pop ticks elapsed
  const popTicksElapsed = Math.floor(currentTick / popTickInterval)
  
  if (popTicksElapsed >= artifactReleaseTime) {
    // Artifacts are revealed
    if (game.winnerId) {
      return <span className="artifact-won">Victory!</span>
    }
    return <span className="artifact-revealed">Revealed</span>
  }

  // Countdown to reveal
  const popTicksRemaining = artifactReleaseTime - popTicksElapsed
  return (
    <span className="artifact-countdown">
      Reveals in {popTicksRemaining} pop ticks
    </span>
  )
}
