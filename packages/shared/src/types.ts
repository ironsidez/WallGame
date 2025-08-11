// Core game types and interfaces

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  username: string;
  teamId: string;
  color: string;
  resources: number;
  isOnline: boolean;
  lastSeen: Date;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  playerIds: string[];
  totalStructures: number;
  totalTerritory: number;
}

export interface Structure {
  id: string;
  type: StructureType;
  playerId: string;
  teamId: string;
  positions: Position[]; // Multiple positions for Tetris-like shapes
  value: number;
  health: number;
  maxHealth: number;
  specialEffects: SpecialEffect[];
  createdAt: Date;
  lastUpdated: Date;
}

export enum StructureType {
  GENERATOR = 'generator',
  FORTRESS = 'fortress',
  AMPLIFIER = 'amplifier',
  SCOUT = 'scout',
  SABOTEUR = 'saboteur',
  BASIC = 'basic'
}

export interface SpecialEffect {
  type: EffectType;
  value: number;
  radius: number;
  duration?: number; // undefined for permanent effects
}

export enum EffectType {
  RESOURCE_GENERATION = 'resource_generation',
  DEFENSE_BOOST = 'defense_boost',
  ATTACK_BOOST = 'attack_boost',
  VISION_RANGE = 'vision_range',
  AREA_DAMAGE = 'area_damage'
}

export interface GridCell {
  position: Position;
  structureId?: string;
  controllerId?: string; // Player or team controlling this cell
  isVisible: boolean;
  lastConflictAt?: Date;
}

export interface GameGrid {
  cells: Map<string, GridCell>; // Key: "x,y"
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface GameState {
  id: string;
  players: Map<string, Player>;
  teams: Map<string, Team>;
  structures: Map<string, Structure>;
  grid: GameGrid;
  gamePhase: GamePhase;
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

export interface GameSettings {
  maxPlayers: number;
  gridSize: number;
  resourceGenerationRate: number;
  structureCostMultiplier: number;
  captureRadius: number;
  fogOfWar: boolean;
  allowAlliances: boolean;
}

// Game actions
export enum ActionType {
  PLACE_STRUCTURE = 'place_structure',
  REMOVE_STRUCTURE = 'remove_structure',
  UPGRADE_STRUCTURE = 'upgrade_structure',
  MOVE_STRUCTURE = 'move_structure',
  FORM_ALLIANCE = 'form_alliance',
  BREAK_ALLIANCE = 'break_alliance',
  CHAT_MESSAGE = 'chat_message'
}

export interface GameAction {
  type: ActionType;
  playerId: string;
  timestamp: Date;
  data: any;
}

export interface PlaceStructureAction {
  structureType: StructureType;
  positions: Position[];
  rotation: number;
}

export interface ConflictResult {
  winningTeamId: string;
  capturedStructures: string[];
  newControlledCells: Position[];
  resourcesAwarded: number;
}

// Structure templates (Tetris-like shapes)
export interface StructureTemplate {
  type: StructureType;
  name: string;
  baseValue: number;
  baseCost: number;
  baseHealth: number;
  shape: Position[]; // Relative positions from origin
  effects: SpecialEffect[];
  description: string;
}
