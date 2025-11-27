import { 
  GameState, 
  Player, 
  GameAction, 
  Position,
  ActionType,
  positionToKey,
  GamePhase,
  GameSettings,
  TerrainType,
  UnitType
} from '@wallgame/shared';
import { DatabaseManager } from '../database/DatabaseManager';
import { v4 as uuidv4 } from 'uuid';
import { generateRandomMap, MapData } from './map-generator';

export class GameManager {
  private gameStates: Map<string, GameState> = new Map();
  
  constructor(
    private databaseManager: DatabaseManager
  ) {
    // Don't call async methods in constructor - use initialize() instead
  }

  /**
   * Initialize the GameManager by loading active games from database
   * MUST be called after DatabaseManager.initialize()
   */
  async initialize(): Promise<void> {
    await this.loadActiveGamesFromDatabase();
  }

  /**
   * Load active games from PostgreSQL on startup
   */
  private async loadActiveGamesFromDatabase(): Promise<void> {
    try {
      const activeGames = await this.databaseManager.getActiveGames();
      console.log(`📋 Loading ${activeGames.length} active games from database...`);
      
      for (const dbGame of activeGames) {
        // Try to load from Redis first
        let gameState = await this.loadGameState(dbGame.id);
        
        // Check if loaded game has terrain data - regenerate if missing
        if (gameState && (!gameState.terrainData || gameState.terrainData.length === 0)) {
          const mapWidth = gameState.settings?.mapWidth || 200;
          const mapHeight = gameState.settings?.mapHeight || 200;
          const mapSize = mapWidth * mapHeight;
          
          console.log(`🗺️ Game ${dbGame.name} missing terrainData (${mapWidth}x${mapHeight} = ${mapSize.toLocaleString()} tiles)`);
          
          // For large maps (>100k tiles), generate async in background
          if (mapSize > 100000) {
            console.log(`⏳ Large map detected - starting with plains, generating in background...`);
            // Start with placeholder terrain immediately (non-blocking)
            gameState.terrainData = this.createDefaultTerrainData(mapWidth, mapHeight);
            await this.saveGameState(gameState);
            
            // Generate actual terrain in background
            this.generateTerrainAsync(gameState.id, mapWidth, mapHeight, gameState.settings?.terrainWeights);
          } else {
            // Small maps can be generated synchronously
            console.log(`🗺️ Generating small map synchronously...`);
            const mapData = await this.loadMap(mapWidth, mapHeight, gameState.settings?.terrainWeights);
            if (mapData) {
              gameState.terrainData = this.convertTerrainToData(mapData);
              await this.saveGameState(gameState);
            }
          }
        }
        
        // If not in Redis, create a new game state
        if (!gameState) {
          console.log(`🎮 Creating new game state for ${dbGame.name} (${dbGame.id})`);
          const settings = typeof dbGame.settings === 'string' 
            ? JSON.parse(dbGame.settings) 
            : dbGame.settings || {};
            
          gameState = {
            id: dbGame.id,
            name: dbGame.name,
            players: new Map(),
            cities: new Map(),
            buildings: new Map(),
            units: new Map(),
            grid: {
              width: settings.mapWidth || 200,
              height: settings.mapHeight || 200,
              squares: new Map()
            },
            terrainData: [], // Will be populated after map generation
            gamePhase: dbGame.status === 'waiting' ? GamePhase.WAITING : GamePhase.ACTIVE,
            currentTick: 0,
            lastPopulationTick: 0,
            startTime: new Date(dbGame.created_at),
            lastUpdate: new Date(dbGame.updated_at || dbGame.created_at),
            settings: {
              maxPlayers: settings.maxPlayers || 100,
              mapWidth: settings.mapWidth || 200,
              mapHeight: settings.mapHeight || 200,
              mapSource: settings.mapSource || 'custom',
              terrainWeights: settings.terrainWeights,
              tickLengthMs: settings.tickLengthMs || 1000,
              ticksPerPopulationUpdate: settings.ticksPerPopulationUpdate || 10,
              cityBuildZoneRadius: settings.cityBuildZoneRadius || 10,
              startingUnitTypes: settings.startingUnitTypes || [UnitType.SETTLER],
              minPlayerDistance: settings.minPlayerDistance || 10
            }
          };
          
          // Load map terrain (generate procedural)
          const mapData = await this.loadMap(
            settings.mapWidth || 200,
            settings.mapHeight || 200,
            settings.terrainWeights
          );
          if (mapData && gameState) {
            // Store terrain as compact 2D array (not individual grid squares)
            gameState.terrainData = this.convertTerrainToData(mapData);
            console.log(`✅ Stored terrain data: ${settings.mapWidth}x${settings.mapHeight}`);
          } else if (gameState) {
            // Fallback: create default plains terrain data
            gameState.terrainData = this.createDefaultTerrainData(
              settings.mapWidth || 200,
              settings.mapHeight || 200
            );
            console.log(`✅ Created default terrain data: ${settings.mapWidth || 200}x${settings.mapHeight || 200}`);
          }
          
          // Load players from database and add to game state
          const dbPlayers = await this.databaseManager.getGamePlayers(dbGame.id);
          console.log(`👥 Loading ${dbPlayers.length} players for game ${dbGame.name} (${dbGame.id})`);
          
          if (dbPlayers.length > 0) {
            console.log('   Player details:', dbPlayers.map(p => ({ id: p.id, username: p.username, left_at: p.left_at })));
          }
          
          for (const dbPlayer of dbPlayers) {
            const player = {
              id: dbPlayer.id,
              username: dbPlayer.username,
              color: '#' + Math.floor(Math.random()*16777215).toString(16), // Generate random color
              isOnline: false, // Will be set to true when they connect via socket
              lastSeen: new Date(dbPlayer.joined_at),
              cityIds: [],
              unitIds: []
            };
            gameState.players.set(player.id, player);
          }
        }
        
        if (gameState) {
          this.gameStates.set(dbGame.id, gameState);
        }
      }
      
      console.log(`✅ Loaded ${this.gameStates.size} games into memory`);
    } catch (error) {
      console.error('❌ Failed to load active games:', error);
    }
  }

  /**
   * Creates a new game instance (called ONLY when admin creates game)
   */
  async createGame(settings: Partial<GameSettings>): Promise<GameState> {
    const gameId = uuidv4();
    
    // Generate map ONCE, store in terrainData
    const mapData = await this.loadMap(
      settings.mapWidth || 1000,
      settings.mapHeight || 2000,
      settings.terrainWeights
    );
    
    const gameState: GameState = {
      id: gameId,
      name: settings.name || `Game ${gameId.substring(0, 8)}`,
      players: new Map(),
      cities: new Map(),
      buildings: new Map(),
      units: new Map(),
      grid: {
        width: settings.mapWidth || 1000,
        height: settings.mapHeight || 2000,
        squares: new Map() // Only populated for squares with entities/resources
      },
      terrainData: this.convertTerrainToData(mapData), // ✅ Store map here
      gamePhase: GamePhase.WAITING,
      currentTick: 0,
      lastPopulationTick: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
      settings: {
        maxPlayers: settings.maxPlayers || 100,
        mapWidth: settings.mapWidth || 1000,
        mapHeight: settings.mapHeight || 2000,
        mapSource: settings.mapSource || 'custom',
        terrainWeights: settings.terrainWeights,
        tickLengthMs: settings.tickLengthMs || 1000,
        ticksPerPopulationUpdate: settings.ticksPerPopulationUpdate || 10,
        cityBuildZoneRadius: settings.cityBuildZoneRadius || 10,
        startingUnitTypes: settings.startingUnitTypes || [UnitType.SETTLER],
        minPlayerDistance: settings.minPlayerDistance || 10
      }
    };

    // Save to PostgreSQL
    await this.saveGameState(gameState);
    
    // Store in memory
    this.gameStates.set(gameId, gameState);
    
    return gameState;
  }

  /**
   * Generate a procedural map with specified dimensions and terrain weights
   * @param width - Width for procedural generation (default 200)
   * @param height - Height for procedural generation (default 200)
   * @param terrainWeights - Optional terrain weight configuration
   */
  private async loadMap(
    width: number = 200, 
    height: number = 200,
    terrainWeights?: any
  ): Promise<MapData | null> {
    try {
      // Generate procedural map with specified dimensions and weights
      console.log(`🗺️  Generating procedural map: ${width}x${height}`);
      const seed = Date.now(); // Use timestamp as seed for reproducibility
      const mapData = generateRandomMap(width, height, seed, terrainWeights);
      console.log(`✅ Generated map with seed ${seed}`);
      
      return mapData;
    } catch (error) {
      console.error('❌ Error generating map:', error);
      return null;
    }
  }

  /**
   * Initialize grid with terrain from map data
   */
  private initializeGridFromMap(gameState: GameState, mapData: MapData): void {
    const { terrain } = mapData;
    
    for (let y = 0; y < terrain.length; y++) {
      for (let x = 0; x < terrain[y].length; x++) {
        const terrainType = terrain[y][x];
        const key = positionToKey({ x, y });
        
        const square: any = {
          position: { x, y },
          terrain: terrainType,
          attributes: this.getTerrainAttributes(terrainType),
          occupiedBy: null,
          unitIds: []
        };
        
        gameState.grid.squares.set(key, square);
      }
    }
    
    console.log(`✅ Initialized ${gameState.grid.squares.size} grid squares from map`);
  }

  /**
   * Initialize grid with default plains terrain
   */
  private initializeDefaultGrid(gameState: GameState): void {
    for (let y = 0; y < gameState.grid.height; y++) {
      for (let x = 0; x < gameState.grid.width; x++) {
        const key = positionToKey({ x, y });
        
        const square: any = {
          position: { x, y },
          terrain: TerrainType.PLAINS,
          attributes: this.getTerrainAttributes(TerrainType.PLAINS),
          occupiedBy: null,
          unitIds: []
        };
        
        gameState.grid.squares.set(key, square);
      }
    }
    
    console.log(`✅ Initialized ${gameState.grid.squares.size} grid squares with default terrain`);
  }

  /**
   * Convert map data to compact terrain data array
   * terrain[y][x] = TerrainType enum value
   */
  private convertTerrainToData(mapData: { terrain: TerrainType[][] }): string[][] {
    const height = mapData.terrain.length;
    const width = height > 0 ? mapData.terrain[0].length : 0;
    
    console.log(`🔄 convertTerrainToData: ${height}x${width}`);
    console.log(`   Input terrain[0][0-9]:`, mapData.terrain?.[0]?.slice(0, 10));
    
    // Create compact 2D array of terrain type strings
    const terrainData: string[][] = [];
    for (let y = 0; y < height; y++) {
      const row: string[] = [];
      for (let x = 0; x < width; x++) {
        // TerrainType is a string enum ('plains', 'forest', etc.)
        // Just pass through the string values directly
        row.push(mapData.terrain[y][x]);
      }
      terrainData.push(row);
    }
    
    console.log(`   Output terrainData[0][0-9]:`, terrainData[0]?.slice(0, 10));
    
    return terrainData;
  }

  /**
   * Create default terrain data (all plains)
   */
  private createDefaultTerrainData(width: number, height: number): TerrainType[][] {
    const terrainData: TerrainType[][] = [];
    for (let y = 0; y < height; y++) {
      const row: TerrainType[] = new Array(width).fill(TerrainType.PLAINS);
      terrainData.push(row);
    }
    return terrainData;
  }

  /**
   * Generate terrain asynchronously in the background (for large maps)
   * This avoids blocking server startup with expensive map generation
   */
  private async generateTerrainAsync(
    gameId: string, 
    width: number, 
    height: number, 
    terrainWeights?: any
  ): Promise<void> {
    try {
      const startTime = Date.now();
      console.log(`🌍 Starting background terrain generation for game ${gameId} (${width}x${height})...`);
      
      // Generate the map (this will take several seconds for large maps)
      const mapData = await this.loadMap(width, height, terrainWeights);
      
      if (mapData) {
        const gameState = this.gameStates.get(gameId);
        if (gameState) {
          gameState.terrainData = this.convertTerrainToData(mapData);
          await this.saveGameState(gameState);
          
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`✅ Background terrain generation complete for ${gameId} in ${duration}s`);
          
          // Broadcast updated terrain to all connected clients
          // TODO: Implement terrain update broadcast via socket
        }
      }
    } catch (error) {
      console.error(`❌ Background terrain generation failed for ${gameId}:`, error);
    }
  }

  /**
   * Get terrain at a specific position from terrain data
   */
  getTerrainAt(gameState: GameState, x: number, y: number): TerrainType {
    if (gameState.terrainData && 
        y >= 0 && y < gameState.terrainData.length &&
        x >= 0 && x < (gameState.terrainData[0]?.length || 0)) {
      return gameState.terrainData[y][x] as unknown as TerrainType;
    }
    return TerrainType.PLAINS; // Default fallback
  }

  /**
   * Get default attributes for terrain type
   */
  private getTerrainAttributes(terrain: TerrainType): any {
    // Base attributes by terrain type (per GAME_DESIGN_SPEC.md)
    const attributes: Record<TerrainType, any> = {
      [TerrainType.PLAINS]: {
        movementCost: 1.0,
        resourceMultiplier: 1.2,
        defenseBonus: 0
      },
      [TerrainType.FOREST]: {
        movementCost: 0.8,
        resourceMultiplier: 1.0,
        defenseBonus: 0.2
      },
      [TerrainType.HILLS]: {
        movementCost: 0.6,
        resourceMultiplier: 0.8,
        defenseBonus: 0.3
      },
      [TerrainType.MOUNTAIN]: {
        movementCost: 0.4,
        resourceMultiplier: 0.5,
        defenseBonus: 0.5
      },
      [TerrainType.DESERT]: {
        movementCost: 0.7,
        resourceMultiplier: 0.3,
        defenseBonus: 0
      },
      [TerrainType.SWAMP]: {
        movementCost: 0.5,
        resourceMultiplier: 0.6,
        defenseBonus: -0.1
      },
      [TerrainType.RIVER]: {
        movementCost: 0.6,  // Transport only
        resourceMultiplier: 0.0,
        defenseBonus: 0
      },
      [TerrainType.OCEAN]: {
        movementCost: 0.3,  // Transport only
        resourceMultiplier: 0.0,
        defenseBonus: 0
      }
    };
    
    return attributes[terrain] || attributes[TerrainType.PLAINS];
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
   * Deletes a game completely
   */
  async deleteGame(gameId: string): Promise<void> {
    // Remove from memory
    this.gameStates.delete(gameId);
    
    // Remove from PostgreSQL (CASCADE will delete all related data)
    await this.databaseManager.deleteGame(gameId);
  }

  /**
   * Adds a player to a game
   */
  async addPlayerToGame(gameId: string, player: Player): Promise<boolean> {
    const gameState = await this.getGameState(gameId);
    if (!gameState) {
      console.error(`❌ Cannot add player to game ${gameId}: Game not found`);
      return false;
    }

    if (gameState.players.size >= gameState.settings.maxPlayers) {
      console.error(`❌ Cannot add player to game ${gameId}: Game full (${gameState.players.size}/${gameState.settings.maxPlayers})`);
      return false;
    }

    console.log(`✅ Adding player ${player.username} (${player.id}) to game ${gameState.name}`);
    gameState.players.set(player.id, player);
    await this.saveGameState(gameState);
    
    console.log(`📊 Game ${gameState.name} now has ${gameState.players.size} players`);
    return true;
  }

  /**
   * Removes a player from a game
   */
  async removePlayerFromGame(gameId: string, playerId: string): Promise<boolean> {
    const gameState = await this.getGameState(gameId);
    if (!gameState) return false;

    const removed = gameState.players.delete(playerId);
    if (removed) {
      await this.saveGameState(gameState);
    }
    
    return removed;
  }

  /**
   * Updates a player's online status
   */
  async setPlayerOnlineStatus(gameId: string, playerId: string, isOnline: boolean): Promise<boolean> {
    const gameState = await this.getGameState(gameId);
    if (!gameState) return false;

    const player = gameState.players.get(playerId);
    if (!player) return false;

    player.isOnline = isOnline;
    player.lastSeen = new Date();
    await this.saveGameState(gameState);
    
    return true;
  }

  /**
   * Initializes a game state if it doesn't exist
   * Loads from cache/DB - NEVER generates new map
   */
  async initializeGame(gameId: string): Promise<void> {
    // Check memory
    if (this.gameStates.get(gameId)) return;
    
    // Load from PostgreSQL
    const dbGame = await this.databaseManager.getGameById(gameId);
    if (dbGame) {
      // Reconstruct game state from database
      console.log('🔍 Loading game from DB:');
      console.log('   dbGame.terrain_data type:', typeof dbGame.terrain_data);
      console.log('   dbGame.terrain_data is array?', Array.isArray(dbGame.terrain_data));
      if (Array.isArray(dbGame.terrain_data)) {
        console.log('   dbGame.terrain_data.length:', dbGame.terrain_data.length);
        console.log('   dbGame.terrain_data[0]?.length:', dbGame.terrain_data[0]?.length);
        console.log('   dbGame.terrain_data[0]?.[0]:', dbGame.terrain_data[0]?.[0]);
      }
      console.log('   map_width:', dbGame.map_width);
      console.log('   map_height:', dbGame.map_height);
      
      const gameState: GameState = {
        id: dbGame.id,
        name: dbGame.name,
        players: new Map(),
        cities: new Map(),
        buildings: new Map(),
        units: new Map(),
        grid: {
          width: dbGame.map_width,
          height: dbGame.map_height,
          squares: new Map()
        },
        terrainData: dbGame.terrain_data || [], // Load terrain from DB
        gamePhase: this.mapStatusToGamePhase(dbGame.status),
        currentTick: 0,
        lastPopulationTick: 0,
        startTime: dbGame.start_time || new Date(),
        lastUpdate: new Date(),
        settings: {
          maxPlayers: dbGame.max_players,
          mapWidth: dbGame.map_width,
          mapHeight: dbGame.map_height,
          mapSource: 'database',
          tickLengthMs: 1000,
          ticksPerPopulationUpdate: dbGame.prod_tick_interval,
          cityBuildZoneRadius: 10,
          startingUnitTypes: [UnitType.SETTLER],
          minPlayerDistance: 10
        }
      };
      
      this.gameStates.set(gameId, gameState);
      console.log(`✅ Loaded game ${dbGame.name} from database with terrain ${gameState.terrainData?.length}x${gameState.terrainData?.[0]?.length}`);
    }
  }

  /**
   * Map database status to GamePhase enum
   * Database: 'paused' | 'playing' | 'finished'
   * GamePhase: 'waiting' | 'starting' | 'active' | 'paused' | 'ended'
   */
  private mapStatusToGamePhase(status: string): GamePhase {
    switch (status) {
      case 'paused':
        return GamePhase.PAUSED;
      case 'playing':
        return GamePhase.ACTIVE;
      case 'finished':
        return GamePhase.ENDED;
      default:
        return GamePhase.WAITING;
    }
  }

  /**
   * Gets all players in a game
   */
  async getGamePlayers(gameId: string): Promise<Player[]> {
    const gameState = await this.getGameState(gameId);
    if (!gameState) return [];

    return Array.from(gameState.players.values());
  }

  /**
   * Get count of online players (currently connected)
   */
  async getOnlinePlayerCount(gameId: string): Promise<number> {
    const gameState = await this.getGameState(gameId);
    if (!gameState) return 0;

    return Array.from(gameState.players.values()).filter(p => p.isOnline).length;
  }

  /**
   * Get total participant count (all players who joined, online or offline)
   */
  async getTotalPlayerCount(gameId: string): Promise<number> {
    const gameState = await this.getGameState(gameId);
    if (!gameState) return 0;

    return gameState.players.size;
  }

  /**
   * Processes a game action (RTS actions)
   */
  async processAction(gameId: string, action: GameAction): Promise<{ success: boolean; error?: string }> {
    const gameState = await this.getGameState(gameId);
    if (!gameState) {
      return { success: false, error: 'Game not found' };
    }

    try {
      switch (action.type) {
        case ActionType.MOVE_UNIT:
          // TODO: Implement unit movement
          break;
        case ActionType.CREATE_CITY:
          // TODO: Implement city creation from settler
          break;
        case ActionType.CONSTRUCT_BUILDING:
          // TODO: Implement building construction
          break;
        case ActionType.TRAIN_UNIT:
          // TODO: Implement unit training
          break;
        case ActionType.ATTACK:
          // TODO: Implement combat
          break;
        case ActionType.CHAT_MESSAGE:
          // Chat handled separately via socket
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
   * Gets all active games
   */
  async getActiveGames(): Promise<string[]> {
    return Array.from(this.gameStates.keys());
  }

  /**
   * Saves game state to PostgreSQL
   * TODO: Implement full game state persistence
   * For now, this is a placeholder - game state lives in memory
   */
  private async saveGameState(gameState: GameState): Promise<void> {
    try {
      console.log(`💾 Attempting to save game "${gameState.name}" (${gameState.id})`);
      
      // Check if game already exists in database
      const existingGame = await this.databaseManager.getGameById(gameState.id);
      
      // Map GamePhase to database status
      const dbStatus = this.mapGamePhaseToStatus(gameState.gamePhase);
      
      if (existingGame) {
        // Game exists - UPDATE it
        console.log(`   Game exists, updating...`);
        await this.databaseManager.updateGame(gameState.id, {
          name: gameState.name,
          status: dbStatus
        });
        console.log(`✅ Game "${gameState.name}" (${gameState.id}) updated in PostgreSQL`);
      } else {
        // Game doesn't exist - CREATE it
        console.log(`   Map size: ${gameState.settings.mapWidth}x${gameState.settings.mapHeight}`);
        console.log(`   Terrain data size: ${gameState.terrainData?.length}x${gameState.terrainData?.[0]?.length}`);
        
        await this.databaseManager.createGame(
          gameState.id,
          gameState.name,
          {
            mapWidth: gameState.settings.mapWidth,
            mapHeight: gameState.settings.mapHeight,
            prodTickInterval: gameState.settings.ticksPerPopulationUpdate,
            popTickInterval: 600,
            artifactReleaseTime: 12,
            winConditionDuration: 0.5,
            maxDuration: null,
            maxPlayers: gameState.settings.maxPlayers,
            startTime: gameState.startTime,
            status: dbStatus // Add status to creation
          },
          gameState.terrainData
        );
        
        console.log(`✅ Game "${gameState.name}" (${gameState.id}) created in PostgreSQL successfully!`);
      }
    } catch (error) {
      console.error(`❌ Failed to save game state for ${gameState.id}:`, error);
      throw error;
    }
  }

  /**
   * Map GamePhase enum to database status values
   * Database: 'paused' | 'playing' | 'finished'
   * GamePhase: 'waiting' | 'starting' | 'active' | 'paused' | 'ended'
   */
  private mapGamePhaseToStatus(phase: GamePhase): string {
    switch (phase) {
      case GamePhase.WAITING:
      case GamePhase.STARTING:
      case GamePhase.PAUSED:
        return 'paused';
      case GamePhase.ACTIVE:
        return 'playing';
      case GamePhase.ENDED:
        return 'finished';
      default:
        return 'paused';
    }
  }

  /**
   * Loads game state from PostgreSQL
   * TODO: Implement full game state loading
   * For now, returns null (game state built from database on startup)
   */
  private async loadGameState(gameId: string): Promise<GameState | null> {
    // TODO: Implement PostgreSQL game state loading
    // For MVP, game state is built from database on startup only
    return null;
  }
}
