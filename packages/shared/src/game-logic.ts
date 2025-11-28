// Minimal game logic utilities for WallGame
// Only includes functions actually used by client/server

import { Position } from './types.js';

/**
 * Convert a position to a string key for Map lookups
 * Used for grid square indexing
 */
export function positionToKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

/**
 * Convert a string key back to a Position
 */
export function keyToPosition(key: string): Position {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/**
 * Calculate Manhattan distance between two positions
 */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
