# WallGame API Documentation

## Authentication Endpoints

### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "player1",
  "email": "player1@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "username": "player1",
    "email": "player1@example.com"
  },
  "token": "jwt-token"
}
```

### POST /api/auth/login
Authenticate an existing user.

**Request Body:**
```json
{
  "username": "player1",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "username": "player1",
    "email": "player1@example.com"
  },
  "token": "jwt-token"
}
```

### GET /api/auth/profile
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "id": "uuid",
  "username": "player1",
  "email": "player1@example.com",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

## Game Endpoints

### POST /api/game/create
Create a new game (requires authentication).

**Request Body:**
```json
{
  "name": "Epic Battle",
  "settings": {
    "maxPlayers": 50,
    "fogOfWar": true,
    "allowAlliances": true
  }
}
```

**Response:**
```json
{
  "message": "Game created successfully",
  "game": {
    "id": "game-uuid",
    "settings": {},
    "phase": "waiting",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### GET /api/game/active
Get list of active games.

**Response:**
```json
{
  "games": [
    {
      "id": "game-uuid",
      "name": "Epic Battle",
      "currentPlayers": 15,
      "maxPlayers": 50,
      "status": "active"
    }
  ]
}
```

### GET /api/game/:gameId
Get specific game state (requires authentication).

**Response:**
```json
{
  "gameState": {
    "id": "game-uuid",
    "players": {},
    "structures": {},
    "grid": {},
    "gamePhase": "active"
  }
}
```

### POST /api/game/:gameId/join
Join a specific game (requires authentication).

**Request Body:**
```json
{
  "teamId": "team-uuid",
  "color": "#ff0000"
}
```

**Response:**
```json
{
  "message": "Successfully joined game",
  "player": {
    "id": "player-uuid",
    "username": "player1",
    "teamId": "team-uuid",
    "color": "#ff0000"
  }
}
```

## WebSocket Events

### Client to Server Events

#### join-game
Join a game room for real-time updates.
```json
{
  "gameId": "game-uuid",
  "playerId": "player-uuid"
}
```

#### game-action
Perform a game action (place structure, etc.).
```json
{
  "gameId": "game-uuid",
  "action": {
    "type": "place_structure",
    "playerId": "player-uuid",
    "timestamp": "2024-01-01T00:00:00Z",
    "data": {
      "structureType": "basic",
      "positions": [{"x": 0, "y": 0}],
      "rotation": 0
    }
  }
}
```

#### chat-message
Send a chat message to the game.
```json
{
  "gameId": "game-uuid",
  "playerId": "player-uuid",
  "message": "Hello everyone!"
}
```

#### preview-structure
Show structure placement preview to other players.
```json
{
  "gameId": "game-uuid",
  "positions": [{"x": 0, "y": 0}],
  "structureType": "fortress"
}
```

### Server to Client Events

#### game-state
Initial game state when joining.
```json
{
  "id": "game-uuid",
  "players": {},
  "structures": {},
  "grid": {},
  "gamePhase": "active"
}
```

#### game-state-update
Real-time game state updates.
```json
{
  "id": "game-uuid",
  "lastUpdate": "2024-01-01T00:00:00Z",
  "changes": {
    "newStructures": [],
    "capturedStructures": [],
    "updatedCells": []
  }
}
```

#### action-processed
Confirmation that an action was processed.
```json
{
  "action": {},
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### action-failed
Notification that an action failed.
```json
{
  "action": {},
  "error": "Insufficient resources"
}
```

#### player-joined
Notification when a player joins the game.
```json
{
  "playerId": "player-uuid"
}
```

#### player-left
Notification when a player leaves the game.
```json
{
  "playerId": "player-uuid"
}
```

#### chat-message
Broadcast chat message from another player.
```json
{
  "playerId": "player-uuid",
  "message": "Hello everyone!",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### structure-preview
Preview of structure placement from another player.
```json
{
  "playerId": "player-uuid",
  "positions": [{"x": 0, "y": 0}],
  "structureType": "fortress"
}
```

## Data Models

### Player
```typescript
interface Player {
  id: string;
  username: string;
  teamId: string;
  color: string;
  resources: number;
  isOnline: boolean;
  lastSeen: Date;
}
```

### Structure
```typescript
interface Structure {
  id: string;
  type: StructureType;
  playerId: string;
  teamId: string;
  positions: Position[];
  value: number;
  health: number;
  maxHealth: number;
  specialEffects: SpecialEffect[];
  createdAt: Date;
  lastUpdated: Date;
}
```

### GameAction
```typescript
interface GameAction {
  type: ActionType;
  playerId: string;
  timestamp: Date;
  data: any;
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Missing required fields"
}
```

### 401 Unauthorized
```json
{
  "error": "Access token required"
}
```

### 403 Forbidden
```json
{
  "error": "Invalid or expired token"
}
```

### 404 Not Found
```json
{
  "error": "Game not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```
