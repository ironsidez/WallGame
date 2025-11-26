import { useGameStore } from '../stores'

// Type interfaces for entity info
interface UnitInfo {
  id: string
  type: string
  count?: number
  fatigue?: number
  morale?: number
  training?: number
}

interface CityInfo {
  id: string
  name?: string
  population?: number
  morale?: number
  training?: number
  fatigue?: number
  damage?: number
}

interface FacilityInfo {
  id: string
  type: string
  upgradeProgress?: number
  damage?: number
  workerCount?: number
  mode?: string
}

export function SelectedEntity() {
  const { selectedUnit, selectedCity, selectedBuilding, currentGame } = useGameStore()

  // Look up selected entities from game state using IDs
  // Note: Maps from socket.io come as plain objects, need to handle both
  const getFromMap = <T,>(map: Map<string, T> | Record<string, T> | undefined, key: string): T | null => {
    if (!map) return null
    if (map instanceof Map) return map.get(key) || null
    return (map as Record<string, T>)[key] || null
  }

  const unit = selectedUnit ? getFromMap<UnitInfo>(currentGame?.units as Map<string, UnitInfo>, selectedUnit) : null
  const city = selectedCity ? getFromMap<CityInfo>(currentGame?.cities as Map<string, CityInfo>, selectedCity) : null
  const building = selectedBuilding ? getFromMap<FacilityInfo>(currentGame?.buildings as Map<string, FacilityInfo>, selectedBuilding) : null

  const hasSelection = unit || city || building

  if (!hasSelection) {
    return (
      <div className="selected-entity">
        <div className="selected-entity-empty">
          <p>Select a unit, city, or facility to view details</p>
          <p className="hint">Click on the map to select</p>
        </div>
      </div>
    )
  }

  return (
    <div className="selected-entity">
      {unit && <UnitDetails unit={unit} />}
      {city && <CityDetails city={city} />}
      {building && <FacilityDetails facility={building} />}
    </div>
  )
}

// Unit details subcomponent
interface UnitDetailsProps {
  unit: {
    id: string
    type: string
    count?: number
    fatigue?: number
    morale?: number
    training?: number
  }
}

function UnitDetails({ unit }: UnitDetailsProps) {
  return (
    <div className="entity-details unit-details">
      <h3>Unit: {unit.type}</h3>
      
      {/* Unit count with visual bars */}
      {unit.count !== undefined && (
        <div className="stat-row">
          <label>Count:</label>
          <span className="value">{unit.count.toLocaleString()}</span>
          <CountVisualization count={unit.count} />
        </div>
      )}
      
      {/* Fatigue bar */}
      {unit.fatigue !== undefined && (
        <div className="stat-row">
          <label>Fatigue:</label>
          <StatBar 
            value={unit.fatigue} 
            max={100} 
            color={unit.fatigue >= 80 ? '#ff6b6b' : '#ffd93d'} 
          />
        </div>
      )}
      
      {/* Morale bar */}
      {unit.morale !== undefined && (
        <div className="stat-row">
          <label>Morale:</label>
          <StatBar 
            value={unit.morale} 
            max={100} 
            color={unit.morale <= 20 ? '#ff6b6b' : '#4ECDC4'} 
          />
        </div>
      )}
      
      {/* Training bar */}
      {unit.training !== undefined && (
        <div className="stat-row">
          <label>Training:</label>
          <StatBar value={unit.training} max={100} color="#a78bfa" />
        </div>
      )}

      <div className="action-buttons">
        <button className="action-btn" disabled>Move</button>
        <button className="action-btn" disabled>Attack</button>
        <button className="action-btn" disabled>Guard</button>
      </div>
    </div>
  )
}

// City details subcomponent
interface CityDetailsProps {
  city: {
    id: string
    name?: string
    population?: number
    morale?: number
    training?: number
    fatigue?: number
    damage?: number
  }
}

function CityDetails({ city }: CityDetailsProps) {
  return (
    <div className="entity-details city-details">
      <h3>City: {city.name || 'Unknown'}</h3>
      
      {city.population !== undefined && (
        <div className="stat-row">
          <label>Population:</label>
          <span className="value">{city.population.toLocaleString()}</span>
        </div>
      )}
      
      {city.morale !== undefined && (
        <div className="stat-row">
          <label>Morale:</label>
          <StatBar value={city.morale} max={100} color="#4ECDC4" />
        </div>
      )}
      
      {city.training !== undefined && (
        <div className="stat-row">
          <label>Training:</label>
          <StatBar value={city.training} max={100} color="#a78bfa" />
        </div>
      )}
      
      {city.fatigue !== undefined && (
        <div className="stat-row">
          <label>Fatigue:</label>
          <StatBar value={city.fatigue} max={100} color="#ffd93d" />
        </div>
      )}
      
      {city.damage !== undefined && (
        <div className="stat-row">
          <label>Damage:</label>
          <StatBar value={city.damage} max={100} color="#ff6b6b" />
        </div>
      )}

      <div className="action-buttons">
        <button className="action-btn" disabled>Build</button>
        <button className="action-btn" disabled>Train</button>
      </div>
    </div>
  )
}

// Facility details subcomponent
interface FacilityDetailsProps {
  facility: {
    id: string
    type: string
    upgradeProgress?: number
    damage?: number
    workerCount?: number
    mode?: string
  }
}

function FacilityDetails({ facility }: FacilityDetailsProps) {
  return (
    <div className="entity-details facility-details">
      <h3>Facility: {facility.type}</h3>
      
      {facility.upgradeProgress !== undefined && (
        <div className="stat-row">
          <label>Progress:</label>
          <StatBar value={facility.upgradeProgress} max={100} color="#4ECDC4" />
        </div>
      )}
      
      {facility.damage !== undefined && (
        <div className="stat-row">
          <label>Damage:</label>
          <StatBar value={facility.damage} max={100} color="#ff6b6b" />
        </div>
      )}
      
      {facility.workerCount !== undefined && (
        <div className="stat-row">
          <label>Workers:</label>
          <span className="value">{facility.workerCount.toLocaleString()} / 50,000</span>
        </div>
      )}
      
      {facility.mode && (
        <div className="stat-row">
          <label>Mode:</label>
          <span className="value mode-badge">{facility.mode}</span>
        </div>
      )}

      <div className="action-buttons">
        <button className="action-btn" disabled>Produce</button>
        <button className="action-btn" disabled>Repair</button>
        <button className="action-btn" disabled>Upgrade</button>
        <button className="action-btn" disabled>Salvage</button>
      </div>
    </div>
  )
}

// Stat bar component
interface StatBarProps {
  value: number
  max: number
  color: string
}

function StatBar({ value, max, color }: StatBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  
  return (
    <div className="stat-bar-container">
      <div className="stat-bar-bg">
        <div 
          className="stat-bar-fill" 
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className="stat-bar-value">{value}%</span>
    </div>
  )
}

// Count visualization (segmented bars per spec)
interface CountVisualizationProps {
  count: number
}

function CountVisualization({ count }: CountVisualizationProps) {
  // Breakdown per spec: purple=10000s, green=1000s, yellow=100s, red=10s
  const tens = Math.floor(count / 10) % 10
  const hundreds = Math.floor(count / 100) % 10
  const thousands = Math.floor(count / 1000) % 10
  const tenThousands = Math.floor(count / 10000)

  const renderBars = (value: number, color: string) => {
    return Array.from({ length: Math.min(value, 5) }, (_, i) => (
      <div key={i} className="count-bar" style={{ backgroundColor: color }} />
    ))
  }

  return (
    <div className="count-visualization">
      {tenThousands > 0 && (
        <div className="count-segment purple">
          {renderBars(tenThousands, '#a855f7')}
        </div>
      )}
      {(thousands > 0 || tenThousands > 0) && (
        <div className="count-segment green">
          {renderBars(thousands, '#22c55e')}
        </div>
      )}
      {(hundreds > 0 || thousands > 0 || tenThousands > 0) && (
        <div className="count-segment yellow">
          {renderBars(hundreds, '#fbbf24')}
        </div>
      )}
      <div className="count-segment red">
        {renderBars(tens, '#ef4444')}
      </div>
    </div>
  )
}
