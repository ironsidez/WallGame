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
  UnitType,
  generateRandomMap,
  MapData
} from '@wallgame/shared';
import { RedisManager } from '../database/RedisManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private gameStates: Map<string, GameState> = new Map();
  
  constructor(
    private redisManager: RedisManager,
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
          console.log(`🗺️ Regenerating terrain for game ${dbGame.name} (missing terrainData)`);
          const mapData = await this.loadMap(
            gameState.settings?.mapWidth || 200,
            gameState.settings?.mapHeight || 200,
            gameState.settings?.terrainWeights
          );
          if (mapData) {
            gameState.terrainData = this.convertTerrainToData(mapData);
            // Save updated state
            await this.saveGameState(gameState);
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
   * Creates a new game instance
   */
  async createGame(settings: Partial<GameSettings>): Promise<GameState> {
    const gameId = uuidv4();
    
    const defaultSettings: GameSettings = {
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
    };

    // Generate procedural map with specified dimensions and terrain weights
    const mapData = await this.loadMap(
      defaultSettings.mapWidth, 
      defaultSettings.mapHeight,
      settings.terrainWeights
    );
    
    // Use map dimensions if generated
    if (mapData) {
      defaultSettings.mapWidth = mapData.dimensions.width;
      defaultSettings.mapHeight = mapData.dimensions.height;
    }

    const gameState: GameState = {
      id: gameId,
      name: `Game ${gameId.substring(0, 8)}`,
      players: new Map(),
      cities: new Map(),
      buildings: new Map(),
      units: new Map(),
      grid: {
        width: defaultSettings.mapWidth,
        height: defaultSettings.mapHeight,
        squares: new Map() // Only populated for squares with entities/resources
      },
      terrainData: [], // Will be set from mapData
      gamePhase: GamePhase.WAITING,
      currentTick: 0,
      lastPopulationTick: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
      settings: defaultSettings
    };

    // Store terrain data from map (compact 2D array)
    if (mapData) {
      gameState.terrainData = this.convertTerrainToData(mapData);
      console.log(`✅ Stored terrain data: ${defaultSettings.mapWidth}x${defaultSettings.mapHeight}`);
      
      // Debug: Count terrain types
      const counts: Record<number, number> = {};
      for (const row of gameState.terrainData) {
        for (const t of row) {
          counts[t] = (counts[t] || 0) + 1;
        }
      }
      console.log(`🗺️  Terrain distribution:`, counts);
    } else {
      // Fallback: create plains terrain data
      gameState.terrainData = this.createDefaultTerrainData(defaultSettings.mapWidth, defaultSettings.mapHeight);
      console.log(`✅ Created default terrain data: ${defaultSettings.mapWidth}x${defaultSettings.mapHeight}`);
    }

    this.gameStates.set(gameId, gameState);
    
    // Save game state asynchronously (don't block the response)
    // For large maps, this can take several seconds
    this.saveGameState(gameState).catch(error => {
      console.error(`❌ Failed to save game state for ${gameId}:`, error);
    });
    
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
  private createDefaultTerrainData(width: number, height: number): number[][] {
    const terrainData: number[][] = [];
    const plainsValue = Number(TerrainType.PLAINS);
    for (let y = 0; y < height; y++) {
      const row: number[] = new Array(width).fill(plainsValue);
      terrainData.push(row);
    }
    return terrainData;
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
    
    // Remove from Redis
    await this.redisManager.deleteGameState(gameId);
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
   * Loads from database if available, otherwise creates new
   */
  async initializeGame(gameId: string): Promise<void> {
    // Check if already in memory
    const existingState = this.gameStates.get(gameId);
    if (existingState) {
      console.log(`✅ Game ${gameId} already in memory`);
      return;
    }

    // Try to load from Redis
    let gameState = await this.loadGameState(gameId);
    
    if (gameState) {
      console.log(`✅ Loaded game ${gameId} from Redis`);
      this.gameStates.set(gameId, gameState);
      return;
    }

    // Load from PostgreSQL
    try {
      const dbGames = await this.databaseManager.getActiveGames();
      const dbGame = dbGames.find((g: any) => g.id === gameId);
      
      if (dbGame) {
        console.log(`✅ Initializing game ${dbGame.name} from database`);
        const settings = typeof dbGame.settings === 'string' 
          ? JSON.parse(dbGame.settings) 
          : dbGame.settings || {};
        
        // Get dimensions from settings (passed from Create Game form)
        const requestedWidth = settings.mapWidth || 200;
        const requestedHeight = settings.mapHeight || 200;
        console.log(`📐 Requested map dimensions: ${requestedWidth}x${requestedHeight}`);
        
        // Load map with specified dimensions and terrain weights
        const mapData = await this.loadMap(
          requestedWidth, 
          requestedHeight,
          settings.terrainWeights
        );
        const mapWidth = mapData?.dimensions.width || requestedWidth;
        const mapHeight = mapData?.dimensions.height || requestedHeight;
          
        gameState = {
          id: dbGame.id,
          name: dbGame.name,
          players: new Map(),
          cities: new Map(),
          buildings: new Map(),
          units: new Map(),
          grid: {
            width: mapWidth,
            height: mapHeight,
            squares: new Map()
          },
          terrainData: [], // Will be populated from mapData
          gamePhase: dbGame.status === 'waiting' ? GamePhase.WAITING : GamePhase.ACTIVE,
          currentTick: 0,
          lastPopulationTick: 0,
          startTime: new Date(dbGame.created_at),
          lastUpdate: new Date(dbGame.updated_at || dbGame.created_at),
          settings: {
            maxPlayers: settings.maxPlayers || 100,
            mapWidth: mapWidth,
            mapHeight: mapHeight,
            mapSource: settings.mapSource || 'custom',
            terrainWeights: settings.terrainWeights,
            tickLengthMs: settings.tickLengthMs || 1000,
            ticksPerPopulationUpdate: settings.ticksPerPopulationUpdate || 10,
            cityBuildZoneRadius: settings.cityBuildZoneRadius || 10,
            startingUnitTypes: settings.startingUnitTypes || [UnitType.SETTLER],
            minPlayerDistance: settings.minPlayerDistance || 10
          }
        };
        
        // Store terrain as compact 2D array (not individual grid squares)
        if (mapData && gameState) {
          gameState.terrainData = this.convertTerrainToData(mapData);
          console.log(`✅ Stored terrain data: ${mapWidth}x${mapHeight}`);
        } else if (gameState) {
          // Fallback: create default plains terrain data
          gameState.terrainData = this.createDefaultTerrainData(mapWidth, mapHeight);
          console.log(`✅ Created default terrain data: ${mapWidth}x${mapHeight}`);
        }
        
        if (gameState) {
          this.gameStates.set(gameId, gameState);
          // Save asynchronously for large maps
          this.saveGameState(gameState).catch(error => {
            console.error(`❌ Failed to save game state for ${gameId}:`, error);
          });
        }
      } else {
        console.warn(`⚠️ Game ${gameId} not found in database`);
      }
    } catch (error) {
      console.error(`❌ Failed to initialize game ${gameId}:`, error);
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
   * Saves game state to Redis
   */
  private async saveGameState(gameState: GameState): Promise<void> {
    try {
      // Convert Maps to objects for JSON serialization
      const serializable = {
        ...gameState,
        players: gameState.players ? Object.fromEntries(gameState.players) : {},
        cities: gameState.cities ? Object.fromEntries(gameState.cities) : {},
        buildings: gameState.buildings ? Object.fromEntries(gameState.buildings) : {},
        units: gameState.units ? Object.fromEntries(gameState.units) : {},
        grid: {
          width: gameState.grid.width,
          height: gameState.grid.height,
          squares: gameState.grid.squares ? Object.fromEntries(gameState.grid.squares) : {}
        },
        terrainData: gameState.terrainData // Preserve terrain data
      };

      await this.redisManager.setGameState(gameState.id, serializable);
    } catch (error) {
      console.error(`❌ Failed to save game state for ${gameState.id}:`, error);
      throw error;
    }
  }

  /**
   * Loads game state from Redis
   */
  private async loadGameState(gameId: string): Promise<GameState | null> {
    const data = await this.redisManager.getGameState(gameId);
    if (!data) return null;

    try {
      // Convert objects back to Maps with null safety
      return {
        ...data,
        players: new Map(data.players ? Object.entries(data.players) : []),
        cities: new Map(data.cities ? Object.entries(data.cities) : []),
        buildings: new Map(data.buildings ? Object.entries(data.buildings) : []),
        units: new Map(data.units ? Object.entries(data.units) : []),
        grid: {
          width: data.grid?.width || 50,
          height: data.grid?.height || 50,
          squares: new Map(data.grid?.squares ? Object.entries(data.grid.squares) : [])
        },
        terrainData: data.terrainData || [] // Preserve terrain data
      };
    } catch (error) {
      console.error(`❌ Failed to parse game state for ${gameId}:`, error);
      return null;
    }
  }
}
