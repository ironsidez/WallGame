import { 
  GameState, 
  Player, 
  Structure, 
  GameAction, 
  Position,
  ActionType,
  PlaceStructureAction,
  validateGameAction,
  evaluateConflict,
  canPlaceStructure,
  positionToKey,
  updateGridBounds
} from '@wallgame/shared';
import { RedisManager } from '../database/RedisManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private gameStates: Map<string, GameState> = new Map();
  
  constructor(
    private redisManager: RedisManager,
    private databaseManager: DatabaseManager
  ) {}

  /**
   * Creates a new game instance
   */
  async createGame(settings: any): Promise<GameState> {
    const gameId = uuidv4();
    
    const gameState: GameState = {
      id: gameId,
      players: new Map(),
      teams: new Map(),
      structures: new Map(),
      grid: {
        cells: new Map(),
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 }
      },
      gamePhase: 'waiting' as any,
      startTime: new Date(),
      lastUpdate: new Date(),
      settings: {
        maxPlayers: 100,
        gridSize: 1000,
        resourceGenerationRate: 1,
        structureCostMultiplier: 1,
        captureRadius: 1,
        fogOfWar: true,
        allowAlliances: true,
        ...settings
      }
    };

    this.gameStates.set(gameId, gameState);
    await this.saveGameState(gameState);
    
    return gameState;
  }

  /**
   * Gets a game state by ID
   */
  async getGameState(gameId: string): Promise<GameState | null> {
    // Try memory first
    let gameState = this.gameStates.get(gameId);
    
    if (!gameState) {
      // Try Redis
      const loadedState = await this.loadGameState(gameId);
      if (loadedState) {
        gameState = loadedState;
        this.gameStates.set(gameId, gameState);
      }
    }
    
    return gameState || null;
  }

  /**
   * Adds a player to a game
   */
  async addPlayerToGame(gameId: string, player: Player): Promise<boolean> {
    const gameState = await this.getGameState(gameId);
    if (!gameState) return false;

    if (gameState.players.size >= gameState.settings.maxPlayers) {
      return false;
    }

    gameState.players.set(player.id, player);
    await this.saveGameState(gameState);
    
    return true;
  }

  /**
   * Processes a game action
   */
  async processAction(gameId: string, action: GameAction): Promise<{ success: boolean; error?: string }> {
    const gameState = await this.getGameState(gameId);
    if (!gameState) {
      return { success: false, error: 'Game not found' };
    }

    // Validate the action
    const validation = validateGameAction(action, gameState);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    try {
      switch (action.type) {
        case ActionType.PLACE_STRUCTURE:
          await this.handlePlaceStructure(gameState, action);
          break;
        case ActionType.REMOVE_STRUCTURE:
          await this.handleRemoveStructure(gameState, action);
          break;
        default:
          return { success: false, error: 'Unsupported action type' };
      }

      gameState.lastUpdate = new Date();
      await this.saveGameState(gameState);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Handles placing a structure
   */
  private async handlePlaceStructure(gameState: GameState, action: GameAction): Promise<void> {
    const actionData = action.data as PlaceStructureAction;
    const player = gameState.players.get(action.playerId);
    
    if (!player) throw new Error('Player not found');

    // Check if structure can be placed
    const placementCheck = canPlaceStructure(actionData.positions, gameState, action.playerId);
    if (!placementCheck.canPlace) {
      throw new Error(placementCheck.reason || 'Cannot place structure');
    }

    // Create the structure
    const structure: Structure = {
      id: uuidv4(),
      type: actionData.structureType,
      playerId: action.playerId,
      teamId: player.teamId,
      positions: actionData.positions,
      value: 20, // Base value, should come from template
      health: 100, // Base health, should come from template
      maxHealth: 100,
      specialEffects: [],
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    // Add structure to game state
    gameState.structures.set(structure.id, structure);

    // Update grid cells
    actionData.positions.forEach(pos => {
      const key = positionToKey(pos);
      gameState.grid.cells.set(key, {
        position: pos,
        structureId: structure.id,
        controllerId: player.teamId,
        isVisible: true
      });
    });

    // Update grid bounds
    updateGridBounds(gameState.grid, actionData.positions);

    // Evaluate conflicts
    const conflictResult = evaluateConflict(structure, gameState);
    
    // Process captures
    if (conflictResult.capturedStructures.length > 0) {
      for (const capturedId of conflictResult.capturedStructures) {
        const capturedStructure = gameState.structures.get(capturedId);
        if (capturedStructure) {
          // Change ownership
          capturedStructure.teamId = structure.teamId;
          capturedStructure.playerId = action.playerId;
          
          // Update grid cells
          capturedStructure.positions.forEach(pos => {
            const key = positionToKey(pos);
            const cell = gameState.grid.cells.get(key);
            if (cell) {
              cell.controllerId = structure.teamId;
            }
          });
        }
      }
      
      // Award resources
      player.resources += conflictResult.resourcesAwarded;
    }
  }

  /**
   * Handles removing a structure
   */
  private async handleRemoveStructure(gameState: GameState, action: GameAction): Promise<void> {
    const { structureId } = action.data;
    const structure = gameState.structures.get(structureId);
    
    if (!structure) throw new Error('Structure not found');
    if (structure.playerId !== action.playerId) {
      throw new Error('Cannot remove structure owned by another player');
    }

    // Remove from structures
    gameState.structures.delete(structureId);

    // Clear grid cells
    structure.positions.forEach(pos => {
      const key = positionToKey(pos);
      gameState.grid.cells.delete(key);
    });
  }

  /**
   * Gets all active games
   */
  async getActiveGames(): Promise<string[]> {
    return Array.from(this.gameStates.keys());
  }

  /**
   * Saves game state to Redis
   */
  private async saveGameState(gameState: GameState): Promise<void> {
    // Convert Maps to objects for JSON serialization
    const serializable = {
      ...gameState,
      players: Object.fromEntries(gameState.players),
      teams: Object.fromEntries(gameState.teams),
      structures: Object.fromEntries(gameState.structures),
      grid: {
        ...gameState.grid,
        cells: Object.fromEntries(gameState.grid.cells)
      }
    };

    await this.redisManager.setGameState(gameState.id, serializable);
  }

  /**
   * Loads game state from Redis
   */
  private async loadGameState(gameId: string): Promise<GameState | null> {
    const data = await this.redisManager.getGameState(gameId);
    if (!data) return null;

    // Convert objects back to Maps
    return {
      ...data,
      players: new Map(Object.entries(data.players)),
      teams: new Map(Object.entries(data.teams)),
      structures: new Map(Object.entries(data.structures)),
      grid: {
        ...data.grid,
        cells: new Map(Object.entries(data.grid.cells))
      }
    };
  }
}
