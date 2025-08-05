import { 
  Position, 
  Structure, 
  StructureType, 
  GridCell, 
  GameGrid, 
  ConflictResult, 
  Player,
  GameState,
  SpecialEffect,
  EffectType
} from './types';

/**
 * Core game logic functions for WallGame
 */

/**
 * Converts a position to a grid key for efficient lookups
 */
export function positionToKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

/**
 * Converts a grid key back to a position
 */
export function keyToPosition(key: string): Position {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/**
 * Calculates the Manhattan distance between two positions
 */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Gets all positions adjacent to a given position (4-directional)
 */
export function getAdjacentPositions(pos: Position): Position[] {
  return [
    { x: pos.x + 1, y: pos.y },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x, y: pos.y - 1 }
  ];
}

/**
 * Gets all positions within a given radius (including diagonal)
 */
export function getPositionsInRadius(center: Position, radius: number): Position[] {
  const positions: Position[] = [];
  
  for (let x = center.x - radius; x <= center.x + radius; x++) {
    for (let y = center.y - radius; y <= center.y + radius; y++) {
      const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
      if (distance <= radius) {
        positions.push({ x, y });
      }
    }
  }
  
  return positions;
}

/**
 * Calculates the total value of a structure including special effects
 */
export function calculateStructureValue(structure: Structure, gameState: GameState): number {
  let totalValue = structure.value;
  
  // Apply amplifier effects from nearby friendly structures
  const nearbyAmplifiers = findNearbyStructures(
    structure.positions[0], // Use first position as reference
    gameState,
    3, // radius
    StructureType.AMPLIFIER,
    structure.teamId
  );
  
  nearbyAmplifiers.forEach(amplifier => {
    const amplifierEffect = amplifier.specialEffects.find(
      effect => effect.type === EffectType.ATTACK_BOOST
    );
    if (amplifierEffect) {
      totalValue += amplifierEffect.value;
    }
  });
  
  return totalValue;
}

/**
 * Finds nearby structures of a specific type and team
 */
export function findNearbyStructures(
  position: Position,
  gameState: GameState,
  radius: number,
  structureType: StructureType,
  teamId: string
): Structure[] {
  const nearbyPositions = getPositionsInRadius(position, radius);
  const structures: Structure[] = [];
  
  nearbyPositions.forEach(pos => {
    const key = positionToKey(pos);
    const cell = gameState.grid.cells.get(key);
    
    if (cell && cell.structureId) {
      const structure = gameState.structures.get(cell.structureId);
      if (structure && structure.type === structureType && structure.teamId === teamId) {
        structures.push(structure);
      }
    }
  });
  
  return structures;
}

/**
 * Evaluates a conflict when a new structure is placed
 * Returns the result of territorial capture
 */
export function evaluateConflict(
  newStructure: Structure,
  gameState: GameState
): ConflictResult {
  const capturedStructures: string[] = [];
  const newControlledCells: Position[] = [];
  let resourcesAwarded = 0;
  
  // Get all adjacent enemy structures
  const adjacentEnemyStructures = new Set<string>();
  
  newStructure.positions.forEach(pos => {
    const adjacentPositions = getAdjacentPositions(pos);
    
    adjacentPositions.forEach(adjPos => {
      const key = positionToKey(adjPos);
      const cell = gameState.grid.cells.get(key);
      
      if (cell && cell.structureId) {
        const structure = gameState.structures.get(cell.structureId);
        if (structure && structure.teamId !== newStructure.teamId) {
          adjacentEnemyStructures.add(structure.id);
        }
      }
    });
  });
  
  // Calculate friendly structure group value
  const friendlyStructures = getFriendlyStructureGroup(newStructure, gameState);
  const friendlyValue = friendlyStructures.reduce((total, struct) => {
    return total + calculateStructureValue(struct, gameState);
  }, 0);
  
  // Evaluate each enemy structure group
  adjacentEnemyStructures.forEach(enemyStructureId => {
    const enemyStructure = gameState.structures.get(enemyStructureId);
    if (!enemyStructure) return;
    
    const enemyGroup = getFriendlyStructureGroup(enemyStructure, gameState);
    const enemyValue = enemyGroup.reduce((total, struct) => {
      return total + calculateStructureValue(struct, gameState);
    }, 0);
    
    // If friendly value is higher, capture enemy structures
    if (friendlyValue > enemyValue) {
      enemyGroup.forEach(struct => {
        capturedStructures.push(struct.id);
        struct.positions.forEach(pos => {
          newControlledCells.push(pos);
        });
        resourcesAwarded += struct.value * 10; // Award resources for captures
      });
    }
  });
  
  return {
    winningTeamId: newStructure.teamId,
    capturedStructures,
    newControlledCells,
    resourcesAwarded
  };
}

/**
 * Gets all connected friendly structures (flood fill)
 */
function getFriendlyStructureGroup(structure: Structure, gameState: GameState): Structure[] {
  const visited = new Set<string>();
  const group: Structure[] = [];
  const queue = [structure];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    group.push(current);
    
    // Find adjacent friendly structures
    current.positions.forEach(pos => {
      const adjacentPositions = getAdjacentPositions(pos);
      
      adjacentPositions.forEach(adjPos => {
        const key = positionToKey(adjPos);
        const cell = gameState.grid.cells.get(key);
        
        if (cell && cell.structureId) {
          const adjacentStructure = gameState.structures.get(cell.structureId);
          if (
            adjacentStructure && 
            adjacentStructure.teamId === structure.teamId &&
            !visited.has(adjacentStructure.id)
          ) {
            queue.push(adjacentStructure);
          }
        }
      });
    });
  }
  
  return group;
}

/**
 * Checks if a structure can be placed at given positions
 */
export function canPlaceStructure(
  positions: Position[],
  gameState: GameState,
  playerId: string
): { canPlace: boolean; reason?: string } {
  // Check if any position is already occupied
  for (const pos of positions) {
    const key = positionToKey(pos);
    const cell = gameState.grid.cells.get(key);
    
    if (cell && cell.structureId) {
      return { canPlace: false, reason: 'Position already occupied' };
    }
  }
  
  // Check if player has enough resources (placeholder logic)
  const player = gameState.players.get(playerId);
  if (!player) {
    return { canPlace: false, reason: 'Player not found' };
  }
  
  // Add more validation rules here (e.g., resource costs, placement rules)
  
  return { canPlace: true };
}

/**
 * Updates grid bounds to accommodate new positions
 */
export function updateGridBounds(grid: GameGrid, positions: Position[]): void {
  positions.forEach(pos => {
    grid.bounds.minX = Math.min(grid.bounds.minX, pos.x);
    grid.bounds.maxX = Math.max(grid.bounds.maxX, pos.x);
    grid.bounds.minY = Math.min(grid.bounds.minY, pos.y);
    grid.bounds.maxY = Math.max(grid.bounds.maxY, pos.y);
  });
}
