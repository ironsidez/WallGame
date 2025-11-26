// Core game types and interfaces for WallGame RTS

export interface Position {
  x: number;
  y: number;
}

// ============================================
// TERRAIN SYSTEM
// ============================================

export enum TerrainType {
  PLAINS = 'plains',
  FOREST = 'forest',
  HILLS = 'hills',
  MOUNTAIN = 'mountain',
  DESERT = 'desert',
  SWAMP = 'swamp',
  RIVER = 'river',
  OCEAN = 'ocean'
}

export interface TerrainAttributes {
  resourcesAvailable: number;
  resourceRefreshRate: number;
  movementSpeedModifier: number; // 1.0 = normal, <1 = slower, >1 = faster
}

export interface GridSquare {
  position: Position;
  terrainType: TerrainType;
  attributes: TerrainAttributes;
  occupiedBy?: string; // Unit ID or Building ID
  buildingId?: string;
  unitIds: string[]; // Multiple units can be in same square
}

// ============================================
// PLAYER SYSTEM
// ============================================

export interface Player {
  id: string;
  username: string;
  color: string;
  isOnline: boolean;
  lastSeen: Date;
  cityIds: string[];
  unitIds: string[];
}

// ============================================
// CITY SYSTEM
// ============================================

export interface City {
  id: string;
  playerId: string;
  centerPosition: Position; // Center of the 3x3 grid
  positions: Position[]; // All 9 positions of the 3x3 city
  population: number;
  morale: number; // 0-100
  education: number; // 0-100
  fatigue: number; // 0-100+
  resources: CityResources;
  buildings: string[]; // Building IDs connected to this city
  createdAt: Date;
  lastPopulationTick: Date;
}

export interface CityResources {
  food: number;
  wood: number;
  stone: number;
  ore: number;
}

// ============================================
// BUILDING SYSTEM
// ============================================

export enum BuildingType {
  // Resource Production
  FARM = 'farm',
  LUMBER_MILL = 'lumber_mill',
  QUARRY = 'quarry',
  FURNACE = 'furnace',
  
  // Unit Production
  BARRACKS = 'barracks',
  
  // Infrastructure
  ROAD = 'road',
  
  // Special
  CITY_CENTER = 'city_center' // The 3x3 city itself
}

export interface Building {
  id: string;
  type: BuildingType;
  playerId: string;
  cityId: string; // Which city this building belongs to
  position: Position;
  isConstructed: boolean;
  constructionProgress: number; // 0-100
  createdAt: Date;
}

// ============================================
// UNIT SYSTEM
// ============================================

export enum UnitType {
  SETTLER = 'settler',
  INFANTRY = 'infantry',
  CAVALRY = 'cavalry',
  ARCHER = 'archer',
  TRANSPORT = 'transport',
  SCOUT = 'scout'
}

export interface Unit {
  id: string;
  type: UnitType;
  playerId: string;
  position: Position;
  targetPosition?: Position; // Where unit is moving to
  movementProgress: number; // 0-1, progress to target
  baseMovementSpeed: number;
  health: number;
  maxHealth: number;
  canAttack: boolean;
  attackPower?: number;
  specialAbilities: UnitAbility[];
  isMoving: boolean;
  createdAt: Date;
}

export enum UnitAbility {
  CREATE_CITY = 'create_city', // Settler ability
  TRANSPORT = 'transport', // Can carry other units
  SCOUT = 'scout' // Extended vision
}

// ============================================
// GAME STATE
// ============================================

export interface GameGrid {
  width: number;
  height: number;
  squares: Map<string, GridSquare>; // Key: "x,y" - only contains squares with entities/resources
}

/**
 * Compact terrain storage - 2D array of TerrainType values
 * This is stored separately from grid squares for efficiency
 * Client fetches this once and uses it for rendering
 */
export type TerrainData = string[][]; // terrain[y][x] = TerrainType enum string value ('plains', 'forest', etc.)

export interface GameState {
  id: string;
  name: string;
  players: Map<string, Player>;
  cities: Map<string, City>;
  buildings: Map<string, Building>;
  units: Map<string, Unit>;
  grid: GameGrid;
  terrainData: TerrainData; // Compact terrain storage (generated once, never sent in updates)
  gamePhase: GamePhase;
  currentTick: number;
  lastPopulationTick: number;
  startTime: Date;
  lastUpdate: Date;
  settings: GameSettings;
}

export enum GamePhase {
  WAITING = 'waiting',
  STARTING = 'starting',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended'
}

/**
 * Terrain spawn frequency multipliers (0-200 scale)
 * - 0 = terrain never spawns
 * - 50 = standard/default spawn rate  
 * - 100 = 2x frequency
 * - 200 = 4x frequency
 * 
 * Plains is the default terrain - other terrains spawn on top based on these frequencies
 */
export interface TerrainWeights {
  forest: number;
  hills: number;
  mountain: number;
  desert: number;
  swamp: number;
  water: number; // Used for both River and Ocean
}

export interface GameSettings {
  maxPlayers: number;
  mapWidth: number;
  mapHeight: number;
  mapSource: 'custom' | 'premade'; // How the map is generated
  premadeMapId?: string; // ID of premade map if mapSource is 'premade'
  terrainWeights?: TerrainWeights; // Terrain generation weights (for custom maps)
  tickLengthMs: number; // Duration of each game tick in milliseconds
  ticksPerPopulationUpdate: number; // How many ticks between pop updates
  cityBuildZoneRadius: number; // Max build distance from city center
  startingUnitTypes: UnitType[]; // Units players start with
  minPlayerDistance: number; // Minimum distance between starting positions
}

// ============================================
// GAME ACTIONS
// ============================================

export enum ActionType {
  MOVE_UNIT = 'move_unit',
  CREATE_CITY = 'create_city', // Settler converts to city
  CONSTRUCT_BUILDING = 'construct_building',
  TRAIN_UNIT = 'train_unit',
  ATTACK = 'attack',
  CHAT_MESSAGE = 'chat_message'
}

export interface GameAction {
  type: ActionType;
  playerId: string;
  timestamp: Date;
  data: any;
}

export interface MoveUnitAction {
  unitId: string;
  targetPosition: Position;
}

export interface CreateCityAction {
  settlerId: string; // Settler unit that will convert
  centerPosition: Position; // Center of 3x3 city
}

export interface ConstructBuildingAction {
  buildingType: BuildingType;
  position: Position;
  cityId: string;
}

export interface TrainUnitAction {
  unitType: UnitType;
  buildingId?: string; // Which building is producing (barracks, etc)
  cityId?: string; // For settlers created from city
}
