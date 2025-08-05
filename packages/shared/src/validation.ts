import { 
  Position, 
  GameAction, 
  ActionType, 
  PlaceStructureAction, 
  StructureType,
  GameState,
  Player 
} from './types';
import { canPlaceStructure, positionToKey } from './game-logic';
import { getTemplate } from './structure-templates';

/**
 * Validation functions for game actions and state
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Validates a game action before processing
 */
export function validateGameAction(action: GameAction, gameState: GameState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!action.playerId) {
    errors.push('Player ID is required');
  }

  if (!action.type) {
    errors.push('Action type is required');
  }

  if (!action.timestamp) {
    errors.push('Timestamp is required');
  }

  // Check if player exists and is online
  const player = gameState.players.get(action.playerId);
  if (!player) {
    errors.push('Player not found');
  } else if (!player.isOnline) {
    errors.push('Player is not online');
  }

  // Action-specific validation
  switch (action.type) {
    case ActionType.PLACE_STRUCTURE:
      const placeErrors = validatePlaceStructureAction(action.data as PlaceStructureAction, gameState, action.playerId);
      errors.push(...placeErrors.errors);
      if (placeErrors.warnings) warnings.push(...placeErrors.warnings);
      break;
      
    case ActionType.REMOVE_STRUCTURE:
      const removeErrors = validateRemoveStructureAction(action.data, gameState, action.playerId);
      errors.push(...removeErrors.errors);
      break;
      
    case ActionType.CHAT_MESSAGE:
      const chatErrors = validateChatMessage(action.data);
      errors.push(...chatErrors.errors);
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validates a place structure action
 */
function validatePlaceStructureAction(
  actionData: PlaceStructureAction, 
  gameState: GameState, 
  playerId: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!actionData.structureType) {
    errors.push('Structure type is required');
  }

  if (!actionData.positions || actionData.positions.length === 0) {
    errors.push('Positions are required');
  }

  if (actionData.rotation < 0 || actionData.rotation > 3) {
    errors.push('Rotation must be between 0 and 3');
  }

  // Validate structure type exists
  if (!Object.values(StructureType).includes(actionData.structureType)) {
    errors.push('Invalid structure type');
  }

  // Validate positions
  if (actionData.positions) {
    for (const pos of actionData.positions) {
      if (!isValidPosition(pos)) {
        errors.push(`Invalid position: ${pos.x}, ${pos.y}`);
      }
    }

    // Check if positions form a valid shape for the structure type
    const template = getTemplate(actionData.structureType, 'default'); // You might need to modify this
    if (template && !isValidShapePlacement(actionData.positions, template.shape)) {
      errors.push('Positions do not match structure template');
    }

    // Check if structure can be placed at these positions
    const placementCheck = canPlaceStructure(actionData.positions, gameState, playerId);
    if (!placementCheck.canPlace) {
      errors.push(placementCheck.reason || 'Cannot place structure');
    }
  }

  // Resource validation
  const player = gameState.players.get(playerId);
  if (player && actionData.structureType) {
    const template = getTemplate(actionData.structureType, 'default');
    if (template && player.resources < template.baseCost) {
      errors.push('Insufficient resources');
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validates a remove structure action
 */
function validateRemoveStructureAction(
  actionData: { structureId: string }, 
  gameState: GameState, 
  playerId: string
): ValidationResult {
  const errors: string[] = [];

  if (!actionData.structureId) {
    errors.push('Structure ID is required');
  }

  const structure = gameState.structures.get(actionData.structureId);
  if (!structure) {
    errors.push('Structure not found');
  } else if (structure.playerId !== playerId) {
    errors.push('Cannot remove structure owned by another player');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates a chat message
 */
function validateChatMessage(actionData: { message: string }): ValidationResult {
  const errors: string[] = [];

  if (!actionData.message) {
    errors.push('Message is required');
  }

  if (actionData.message && actionData.message.length > 500) {
    errors.push('Message too long (max 500 characters)');
  }

  if (actionData.message && actionData.message.trim().length === 0) {
    errors.push('Message cannot be empty');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates a position
 */
function isValidPosition(pos: Position): boolean {
  return (
    typeof pos.x === 'number' &&
    typeof pos.y === 'number' &&
    Number.isInteger(pos.x) &&
    Number.isInteger(pos.y) &&
    Math.abs(pos.x) <= 10000 && // Reasonable grid limits
    Math.abs(pos.y) <= 10000
  );
}

/**
 * Checks if placed positions match a template shape
 */
function isValidShapePlacement(positions: Position[], templateShape: Position[]): boolean {
  if (positions.length !== templateShape.length) {
    return false;
  }

  // Normalize both sets of positions to start from (0,0)
  const normalizedPositions = normalizePositions(positions);
  const normalizedTemplate = normalizePositions(templateShape);

  // Check if they match (allowing for rotations)
  for (let rotation = 0; rotation < 4; rotation++) {
    const rotatedTemplate = rotatePositions(normalizedTemplate, rotation);
    if (positionsMatch(normalizedPositions, rotatedTemplate)) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes positions to start from (0,0)
 */
function normalizePositions(positions: Position[]): Position[] {
  if (positions.length === 0) return [];

  const minX = Math.min(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y));

  return positions.map(p => ({
    x: p.x - minX,
    y: p.y - minY
  }));
}

/**
 * Rotates positions by 90 degrees clockwise n times
 */
function rotatePositions(positions: Position[], rotations: number): Position[] {
  let result = [...positions];
  
  for (let i = 0; i < rotations % 4; i++) {
    result = result.map(pos => ({
      x: -pos.y,
      y: pos.x
    }));
    result = normalizePositions(result);
  }
  
  return result;
}

/**
 * Checks if two sets of positions match exactly
 */
function positionsMatch(positions1: Position[], positions2: Position[]): boolean {
  if (positions1.length !== positions2.length) {
    return false;
  }

  const set1 = new Set(positions1.map(p => `${p.x},${p.y}`));
  const set2 = new Set(positions2.map(p => `${p.x},${p.y}`));

  return set1.size === set2.size && [...set1].every(pos => set2.has(pos));
}

/**
 * Validates game state consistency
 */
export function validateGameState(gameState: GameState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check that all structure positions are properly registered in the grid
  gameState.structures.forEach((structure, structureId) => {
    structure.positions.forEach(pos => {
      const key = positionToKey(pos);
      const cell = gameState.grid.cells.get(key);
      
      if (!cell) {
        errors.push(`Structure ${structureId} position ${key} not found in grid`);
      } else if (cell.structureId !== structureId) {
        errors.push(`Grid cell ${key} references wrong structure`);
      }
    });
  });

  // Check that all grid cells with structures reference valid structures
  gameState.grid.cells.forEach((cell, key) => {
    if (cell.structureId && !gameState.structures.has(cell.structureId)) {
      errors.push(`Grid cell ${key} references non-existent structure ${cell.structureId}`);
    }
  });

  // Check player-team consistency
  gameState.players.forEach((player, playerId) => {
    if (!gameState.teams.has(player.teamId)) {
      errors.push(`Player ${playerId} references non-existent team ${player.teamId}`);
    }
  });

  gameState.teams.forEach((team, teamId) => {
    team.playerIds.forEach(playerId => {
      if (!gameState.players.has(playerId)) {
        errors.push(`Team ${teamId} references non-existent player ${playerId}`);
      }
    });
  });

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validates player data
 */
export function validatePlayer(player: Partial<Player>): ValidationResult {
  const errors: string[] = [];

  if (!player.username || player.username.trim().length === 0) {
    errors.push('Username is required');
  }

  if (player.username && player.username.length > 20) {
    errors.push('Username too long (max 20 characters)');
  }

  if (player.username && !/^[a-zA-Z0-9_-]+$/.test(player.username)) {
    errors.push('Username contains invalid characters');
  }

  if (player.resources !== undefined && player.resources < 0) {
    errors.push('Resources cannot be negative');
  }

  return { isValid: errors.length === 0, errors };
}
