import { Position, GridSquare, TerrainType, TerrainAttributes, Unit, City, GameState } from './types.js';

export function positionToKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

export function keyToPosition(key: string): Position {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function findPlayerSpawnPosition(gameState: GameState, minDistanceFromOthers: number): Position | null {
  const existingPlayerPositions: Position[] = [];
  gameState.units.forEach(unit => {
    existingPlayerPositions.push(unit.position);
  });
  
  const maxAttempts = 200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = Math.floor(Math.random() * gameState.grid.width);
    const y = Math.floor(Math.random() * gameState.grid.height);
    const candidate = { x, y };
    const key = positionToKey(candidate);
    const square = gameState.grid.squares.get(key);
    
    if (!square || square.unitIds.length > 0 || square.buildingId) continue;
    
    const tooClose = existingPlayerPositions.some(pos => manhattanDistance(candidate, pos) < minDistanceFromOthers);
    if (!tooClose) return candidate;
  }
  
  return null;
}
