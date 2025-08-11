import { useGameStore } from '../stores'

export function StructurePalette() {
  const { selectedStructure, selectStructure } = useGameStore()

  const structures = [
    { type: 'BASIC', name: 'Basic Block', symbol: '■', cost: 5, description: 'Simple building block' },
    { type: 'GENERATOR', name: 'Generator', symbol: '⚡', cost: 30, description: 'Produces resources over time' },
    { type: 'FORTRESS', name: 'Fortress', symbol: '🏰', cost: 50, description: 'High defense structure' },
    { type: 'AMPLIFIER', name: 'Amplifier', symbol: '📡', cost: 40, description: 'Boosts nearby structures' },
    { type: 'SCOUT', name: 'Scout', symbol: '👁', cost: 20, description: 'Reveals fog of war' },
    { type: 'SABOTEUR', name: 'Saboteur', symbol: '💣', cost: 35, description: 'Weakens enemy structures' },
  ]

  return (
    <div className="structure-palette">
      <h3>🏗️ Build Structures</h3>
      <div className="structure-grid">
        {structures.map((structure) => (
          <button
            key={structure.type}
            className={`structure-btn ${selectedStructure === structure.type ? 'selected' : ''}`}
            onClick={() => selectStructure(structure.type)}
            title={`${structure.name} - ${structure.description} (Cost: ${structure.cost})`}
          >
            <div className="structure-symbol">{structure.symbol}</div>
            <div className="structure-name">{structure.name}</div>
            <div className="structure-cost">💰 {structure.cost}</div>
          </button>
        ))}
      </div>

      {selectedStructure && (
        <div className="structure-info">
          <h4>Selected Structure</h4>
          <div className="selected-structure">
            <div className="structure-details">
              <h5>{structures.find(s => s.type === selectedStructure)?.name}</h5>
              <p>{structures.find(s => s.type === selectedStructure)?.description}</p>
              <div className="structure-stats">
                <span>💰 Cost: {structures.find(s => s.type === selectedStructure)?.cost}</span>
                <span>⚔️ Value: 20</span>
                <span>❤️ Health: 100</span>
              </div>
            </div>
          </div>
          <p className="structure-help">
            Click on the game board to place this structure
          </p>
        </div>
      )}

      <div className="placement-tips">
        <h4>💡 Placement Tips</h4>
        <ul>
          <li>Place structures adjacent to capture territory</li>
          <li>Higher combined values win battles</li>
          <li>Use amplifiers to boost nearby structures</li>
          <li>Fortresses provide strong defense</li>
          <li>Generators produce resources over time</li>
        </ul>
      </div>
    </div>
  )
}
