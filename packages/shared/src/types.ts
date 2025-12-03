// Core types for WallGame - Phase 1 (Lobby & Authentication)
// Only includes types that are actually implemented and used

export interface Position {
  x: number;
  y: number;
}

// ============================================
// PLAYER SYSTEM (Phase 1)
// ============================================

export interface Player {
  id: string;
  username: string;
  isAdmin: boolean;
  isOnline: boolean;
  currentGameId: string | null;
  participatingGameIds: string[];
}

// ============================================
// GAME SYSTEM (Phase 1)
// ============================================

export enum GameStatus {
  PAUSED = 'paused',     // Before startTime
  PLAYING = 'playing',   // Active game
  FINISHED = 'finished'  // Ended
}

export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  currentTick: number;
  popTicksRemaining: number | null;
  startTime: Date;
  winnerId: string | null;
  maxPlayers: number;
  mapWidth: number;
  mapHeight: number;
  prodTickInterval: number;
  popTickInterval: number;
  artifactReleaseTime: number;
  winConditionDuration: number;
  maxDuration: number | null;
  playerIds: string[];
  createdAt: Date;
}

// ============================================
// TERRAIN SYSTEM (Phase 2 - Map Generation)
// ============================================

export enum TerrainType {
  PLAINS = 'P',
  FOREST = 'F',
  HILLS = 'H',
  MOUNTAIN = 'M',
  DESERT = 'D',
  SWAMP = 'S',
  RIVER = 'R',
  OCEAN = 'O'
}

/**
 * Terrain spawn frequency multipliers (0-200 scale)
 * Used for map generation only
 */
export interface TerrainWeights {
  forest: number;
  hills: number;
  mountain: number;
  desert: number;
  swamp: number;
  water: number;
}

/**
 * Compact terrain storage - 2D array of TerrainType values
 * terrain[y][x] = TerrainType enum string value
 */
export type TerrainData = string[][];

// ============================================
// GAME STATE (Temporary - until Phase 3)
// ============================================

// Legacy GameState interface - still used by GameManager
// TODO: Refactor to simpler structure in Phase 3
export interface GameState {
  id: string;
  name: string;
  players: Map<string, Player>;
  cities: Map<string, any>;
  buildings: Map<string, any>;
  units: Map<string, any>;
  grid: {
    width: number;
    height: number;
    squares: Map<string, any>;
  };
  terrainData: TerrainData;
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

// Legacy GameSettings - still used by GameManager
// TODO: Simplify in Phase 3
export interface GameSettings {
  maxPlayers: number;
  mapWidth: number;
  mapHeight: number;
  mapSource: 'custom' | 'premade';
  premadeMapId?: string;
  terrainWeights?: TerrainWeights;
  tickLengthMs: number;
  ticksPerPopulationUpdate: number;
  cityBuildZoneRadius: number;
  startingUnitTypes: any[];
  minPlayerDistance: number;
}

// ============================================
// LEGACY TYPES (Remove when GameManager refactored)
// ============================================

// Only kept for GameManager compatibility
export enum UnitType {
  SETTLER = 'settler',
  INFANTRY = 'infantry',
  CAVALRY = 'cavalry',
  ARCHER = 'archer',
  TRANSPORT = 'transport',
  SCOUT = 'scout'
}

export enum ActionType {
  MOVE_UNIT = 'move_unit',
  CREATE_CITY = 'create_city',
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

// ============================================
// EVENT-DRIVEN UPDATES (Lobby & Game Metadata)
// ============================================

/**
 * Game metadata - used for lobby display and in-game info panel
 * Single source of truth for game information across the app
 */
export interface GameMetadata {
  id: string;
  name: string;
  status: GameStatus;
  playerCount: number;        // Total participants
  activePlayerCount: number;  // Currently connected
  maxPlayers: number;
  mapWidth: number;
  mapHeight: number;
  popTicksRemaining: number | null;
  createdAt: Date;
}

/**
 * Lobby state update - sent to clients in the lobby room
 */
export interface LobbyUpdate {
  games: GameMetadata[];
  onlinePlayerCount: number;
}
