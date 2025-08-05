import { useGameStore } from '../stores'

export function StructurePalette() {
  const { selectedStructure, selectStructure } = useGameStore()

  const structures = [
    { type: 'basic', name: 'Basic Block', symbol: '■', cost: 1, description: 'Simple building block' },
    { type: 'generator', name: 'Generator', symbol: '⚡', cost: 5, description: 'Produces resources over time' },
    { type: 'fortress', name: 'Fortress', symbol: '🏰', cost: 10, description: 'High defense structure' },
    { type: 'amplifier', name: 'Amplifier', symbol: '📡', cost: 8, description: 'Boosts nearby structures' },
    { type: 'scout', name: 'Scout', symbol: '👁', cost: 3, description: 'Reveals fog of war' },
    { type: 'saboteur', name: 'Saboteur', symbol: '💣', cost: 6, description: 'Weakens enemy structures' },
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
            {structures.find(s => s.type === selectedStructure)?.name}
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
