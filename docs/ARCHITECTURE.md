# WallGame Architecture Overview

> **Current Status**: Phase 1 - Monolithic Architecture  
> **Target Capacity**: 10-20 concurrent games, ~2,000 players  
> **Next Phase**: Optimized Monolithic (see Evolution Roadmap below)

## 🏗️ **Current Architecture (Phase 1)**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Web Browser   │    │   Web Browser   │
│                 │    │                 │    │                 │
│  Player Client  │    │  Player Client  │    │  Player Client  │
│  (React + TS)   │    │  (React + TS)   │    │  (React + TS)   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ HTTP/WebSocket       │ HTTP/WebSocket       │ HTTP/WebSocket
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │     Load Balancer       │
                    │    (Future: nginx)      │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   WallGame Server       │
                    │  (Node.js + Express)    │
                    │                         │
                    │  ┌─────────────────┐   │
                    │  │   Socket.io     │   │
                    │  │ (Real-time comm)│   │
                    │  └─────────────────┘   │
                    │                         │
                    │  ┌─────────────────┐   │
                    │  │ Game Manager    │   │
                    │  │ (Core Logic)    │   │
                    │  └─────────────────┘   │
                    └────────┬───────┬────────┘
                             │       │
                    ┌────────┴───┐   │
                    │   Redis    │   │
                    │ (Fast Cache│   │
                    │ Game State)│   │
                    └────────────┘   │
                                     │
                            ┌────────┴────────┐
                            │  PostgreSQL     │
                            │ (Persistent DB) │
                            │ Users, Games,   │
                            │ History, Stats  │
                            └─────────────────┘
```

## 📦 **Monorepo Structure**

```
WallGame/
├── packages/
│   ├── client/           # Frontend React Application
│   │   ├── src/
│   │   │   ├── components/    # React UI Components
│   │   │   ├── stores/        # Zustand State Management
│   │   │   ├── services/      # API & Socket Communication
│   │   │   └── game/          # Canvas Rendering & Game UI
│   │   ├── public/            # Static Assets
│   │   └── vite.config.ts     # Build Configuration
│   │
│   ├── server/           # Backend Node.js Application
│   │   ├── src/
│   │   │   ├── game/          # Core Game Logic
│   │   │   ├── database/      # DB Managers (PostgreSQL + Redis)
│   │   │   ├── routes/        # REST API Endpoints
│   │   │   ├── socket/        # Socket.io Real-time Handlers
│   │   │   └── index.ts       # Server Entry Point
│   │   └── .env              # Environment Configuration
│   │
│   └── shared/           # Shared Game Logic & Types
│       └── src/
│           ├── types.ts       # TypeScript Interfaces
│           ├── game-logic.ts  # Core Game Algorithms
│           ├── structure-templates.ts  # Building Shapes
│           └── validation.ts  # Action Validation
│
├── .vscode/             # VS Code Configuration
├── docs/                # Documentation
└── package.json         # Workspace Configuration
```

## 🔄 **Data Flow Architecture**

### **1. Real-time Game Flow**
```
Player Action (Place Structure)
         │
         ▼
┌─────────────────────┐
│   React Client     │ ──┐
│ (Structure Palette) │   │ 1. User clicks structure
└─────────────────────┘   │    and places on grid
         │                │
         │ Socket Emit    │
         ▼                │
┌─────────────────────┐   │
│   Socket.io        │ ◄─┘
│ (Real-time comm)   │
└─────────┬───────────┘
          │ 2. Validate action
          ▼
┌─────────────────────┐
│   Game Manager     │ ──┐
│ (Core Logic)       │   │ 3. Process territory capture
└─────────┬───────────┘   │    using shared algorithms
          │               │
          │ 4. Update     │
          ▼               │
┌─────────────────────┐   │
│      Redis         │ ◄─┘ 5. Cache new game state
│ (Game State Cache) │
└─────────┬───────────┘
          │ 6. Broadcast updates
          ▼
┌─────────────────────┐
│   All Clients      │ ──┐
│ (Live updates)     │   │ 7. Update UI for all players
└─────────────────────┘   │    in real-time
                          │
                    ┌─────┴──────┐
                    │ PostgreSQL │ 8. Persist important
                    │ (Database) │    events & statistics
                    └────────────┘
```

### **2. Authentication Flow**
```
User Registration/Login
         │
         ▼
┌─────────────────────┐
│   Login Form       │
│ (React Component)  │
└─────────┬───────────┘
          │ HTTP POST /api/auth/login
          ▼
┌─────────────────────┐
│   Express Route    │ ──┐
│ (/api/auth/login)  │   │ 1. Validate credentials
└─────────┬───────────┘   │
          │               │
          │ 2. Query      │
          ▼               │
┌─────────────────────┐   │
│   PostgreSQL       │ ◄─┘ 3. Check user in database
│ (Users table)      │
└─────────┬───────────┘
          │ 4. Generate JWT
          ▼
┌─────────────────────┐
│   JWT Token        │ ──┐
│ (Authentication)   │   │ 5. Return token to client
└─────────┬───────────┘   │
          │               │
          │ 6. Store      │
          ▼               │
┌─────────────────────┐   │
│   Client Storage   │ ◄─┘ 7. Use for authenticated requests
│ (localStorage)     │
└─────────────────────┘
```

## 🧩 **Component Architecture**

### **Frontend Components**
```
App.tsx
├── Router (react-router-dom)
├── AuthProvider (Authentication context)
└── Routes:
    ├── /login
    │   └── Login.tsx
    │       ├── LoginForm
    │       └── RegisterForm
    │
    ├── /lobby
    │   └── GameLobby.tsx
    │       ├── GameList
    │       ├── CreateGameForm
    │       └── PlayerStats
    │
    └── /game/:gameId
        └── GameBoard.tsx
            ├── GameCanvas (Main game area)
            ├── StructurePalette (Building selection)
            ├── PlayerDashboard (Resources, stats)
            ├── ChatPanel (Real-time chat)
            └── GameControls (Settings, quit)
```

### **Backend Modules**
```
index.ts (Server entry)
├── Express App
│   ├── Middleware (CORS, Helmet, Auth)
│   ├── Routes:
│   │   ├── /api/auth/* (Authentication)
│   │   └── /api/game/* (Game management)
│   └── Error handling
│
├── Socket.io Server
│   ├── Connection handler
│   ├── Room management
│   ├── Real-time game events
│   └── Chat system
│
├── Game Manager
│   ├── Game state management
│   ├── Action processing
│   ├── Conflict resolution
│   └── Player management
│
└── Database Layer
    ├── PostgreSQL (Persistent data)
    └── Redis (Fast cache)
```

## 🔌 **Communication Protocols**

### **HTTP REST API**
```
Authentication:
POST /api/auth/register    # Create new user
POST /api/auth/login       # Authenticate user
GET  /api/auth/profile     # Get user profile

Game Management:
GET  /api/game/active      # List active games
POST /api/game/create      # Create new game
GET  /api/game/:id         # Get game state
POST /api/game/:id/join    # Join specific game
GET  /api/game/:id/stats   # Game statistics
```

### **WebSocket Events (Socket.io)**
```
Client → Server:
- join-game           # Join game room
- leave-game          # Leave game room
- game-action         # Place/remove structures
- chat-message        # Send chat
- preview-structure   # Show placement preview

Server → Client:
- game-state          # Initial state on join
- game-state-update   # Real-time updates
- action-processed    # Action confirmation
- action-failed       # Action rejection
- player-joined       # Player notifications
- player-left         # Player notifications
- chat-message        # Broadcast chat
- structure-preview   # Show other players' previews
```

## 🎮 **Game Logic Architecture**

### **Core Game Mechanics**
```
Structure Placement:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Player selects  │ -> │ Validate        │ -> │ Calculate       │
│ structure type  │    │ placement       │    │ territory       │
│ and position    │    │ rules           │    │ capture         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Template system │    │ Grid collision  │    │ Adjacent value  │
│ (Tetris shapes) │    │ detection       │    │ comparison      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Territory Capture Algorithm**
```
New Structure Placed
         │
         ▼
┌─────────────────────┐
│ Find Adjacent       │ ──┐
│ Enemy Structures    │   │ 1. Scan 4-directional neighbors
└─────────┬───────────┘   │
          │               │
          │ 2. Group      │
          ▼               │
┌─────────────────────┐   │
│ Calculate Group     │ ◄─┘ 3. Use flood-fill algorithm
│ Values (Friendly)   │      to find connected structures
└─────────┬───────────┘
          │ 4. Compare values
          ▼
┌─────────────────────┐
│ Calculate Group     │ ──┐
│ Values (Enemy)      │   │ 5. Include amplifier bonuses
└─────────┬───────────┘   │    and special effects
          │               │
          │ 6. Battle     │
          ▼               │
┌─────────────────────┐   │
│ Friendly > Enemy?   │ ◄─┘
└─────────┬───────────┘
          │ YES
          ▼
┌─────────────────────┐
│ Capture Enemy       │ ──┐
│ Structures          │   │ 7. Change ownership
└─────────┬───────────┘   │    Award resources
          │               │
          │ 8. Broadcast  │
          ▼               │
┌─────────────────────┐   │
│ Update All Clients  │ ◄─┘ 9. Real-time notifications
└─────────────────────┘
```

## 🚀 **Performance Architecture**

### **Scalability Design**
```
Load Distribution:
┌─────────────────┐    ┌─────────────────┐
│   Game Room 1   │    │   Game Room 2   │
│ (100 players)   │    │ (100 players)   │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
          ┌──────────┴──────────┐
          │   Socket.io Rooms   │ ──┐
          │ (Isolated updates)  │   │ Events only sent
          └─────────────────────┘   │ to relevant players
                     │              │
          ┌──────────┴──────────┐   │
          │      Redis          │ ◄─┘ Fast game state
          │ (Game state cache)  │     access & pub/sub
          └─────────────────────┘
                     │
          ┌──────────┴──────────┐
          │   PostgreSQL        │ ──┐
          │ (Persistent data)   │   │ Async writes for
          └─────────────────────┘   │ non-critical data
```

### **Data Optimization**
```
Game State Management:
┌─────────────────┐
│ Active Game     │ ──┐ Stored in Redis
│ State (RAM)     │   │ for millisecond access
└─────────────────┘   │
                      │
┌─────────────────┐   │
│ Delta Updates   │ ◄─┘ Only send changes,
│ (Network)       │     not full state
└─────────────────┘
                      │
┌─────────────────┐   │
│ Periodic Saves  │ ◄─┘ Async PostgreSQL
│ (Disk)          │     writes for persistence
└─────────────────┘
```

## 🔧 **Technology Stack Summary**

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | UI Framework |
| | Vite | Fast build tool |
| | Zustand | State management |
| | Socket.io Client | Real-time communication |
| | Canvas API | Game rendering |
| **Backend** | Node.js + Express | Server runtime |
| | TypeScript | Type safety |
| | Socket.io | WebSocket communication |
| | JWT | Authentication |
| **Database** | PostgreSQL | Persistent data |
| | Redis | Fast cache & pub/sub |
| **Shared** | TypeScript | Game logic & types |
| **DevOps** | npm workspaces | Monorepo management |
| | VS Code | Development environment |
| | Nodemon | Development server |

## 🎯 **Key Architectural Benefits**

1. **Real-time Performance**: Socket.io + Redis for millisecond updates
2. **Scalability**: Room-based isolation, horizontal scaling ready
3. **Type Safety**: Full TypeScript coverage across stack
4. **Code Reuse**: Shared game logic between client/server
5. **Developer Experience**: Hot reload, debugging, task automation
6. **Persistence**: PostgreSQL for data integrity
7. **Modularity**: Clean separation of concerns

This architecture supports hundreds of concurrent players with real-time territorial battles while maintaining code quality and developer productivity! 🏰⚔️

---

## 🗺️ **Square-Based State Model**

> **Design Principle**: All game state is organized by map square coordinates. Every entity has an (x, y) position.

### **Why Square-Based Storage?**

1. **Spatial Queries Are Primary** - "What's at (x,y)?" and "What's near (x,y)?" are the most common operations
2. **Fog of War Filtering** - Easy to determine what updates to send per player based on visible squares
3. **Localized Updates** - Changing one area doesn't require reloading entire game state
4. **Dynamic Resources** - Terrain resources (crops, wood, stone, metal) change per square over time

### **Square State Structure**

```typescript
// Each map square maintains its own state
interface SquareState {
  position: { x: number, y: number };
  
  // Terrain (static after map generation)
  terrainType: TerrainType;
  
  // Resources (DYNAMIC - change every prod tick)
  resources: {
    crops: number;   // Renewable, based on surrounding terrain
    wood: number;    // Renewable, based on surrounding terrain
    stone: number;   // Finite, depletes when mined
    metal: number;   // Finite, depletes when mined
  };
  
  // Control
  ownerId: string | null;
  
  // Entities on this square
  unitIds: string[];        // Max 6 per player for movement
  buildingId: string | null;
  artifactId: string | null;
  
  // Vision (who can see this square)
  visionProviders: string[]; // Unit/building IDs providing vision here
}
```

### **Redis Key Structure (Per Game)**

```
game:{gameId}:meta                    # Game settings, phase, tick count
game:{gameId}:players                 # SET of player IDs
game:{gameId}:player:{playerId}       # Player session state

# Square-based storage (chunked for efficiency)
game:{gameId}:chunk:{cx}:{cy}         # 100x100 square chunks
game:{gameId}:chunk:{cx}:{cy}:resources  # Resource state for chunk

# Entity indexes (for fast entity lookups)
game:{gameId}:units                   # HASH { unitId: JSON }
game:{gameId}:cities                  # HASH { cityId: JSON }
game:{gameId}:buildings               # HASH { buildingId: JSON }

# Spatial index (for "what's near X,Y?" queries)
game:{gameId}:spatial:{cx}:{cy}       # SET of entity IDs in chunk
```

### **Resource Dynamics**

Terrain resources are NOT static:

| Resource | Behavior | Update Frequency |
|----------|----------|------------------|
| **Crops** | Renewable - regenerates based on adjacent plains | Every prod tick |
| **Wood** | Renewable - regenerates based on adjacent forest | Every prod tick |
| **Stone** | Finite - depletes when extracted | On extraction |
| **Metal** | Finite - depletes when extracted | On extraction |

```
Regeneration Example:
- Forest square with 100 wood
- Player extracts 10 wood → 90 remaining
- Adjacent squares average 80 wood
- Next prod tick: +5 regeneration → 95 wood
- Heavily harvested areas recover slower
```

### **Fog of War & Update Delivery**

```
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (processes everything)            │
│                                                             │
│  Combat in fog → Calculated normally, results stored        │
│  Resource regen → Happens on all squares                    │
│  Unit movement → Processed for all units                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    VISION FILTER                            │
│                                                             │
│  For each player:                                           │
│  1. Get visible squares (from their units/buildings)        │
│  2. Filter updates to only visible squares                  │
│  3. Send filtered updates via Socket.io                     │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐
         │Player A │    │Player B │    │Player C │
         │sees 500 │    │sees 300 │    │sees 450 │
         │squares  │    │squares  │    │squares  │
         └─────────┘    └─────────┘    └─────────┘
```

**Key Points:**
- Server processes ALL game logic (authoritative)
- Client is display-only
- Players receive NO information about events in their fog of war
- Combat between units in fog of war still happens, just isn't broadcast

---

## 🚀 **ARCHITECTURE EVOLUTION ROADMAP**

### **Scaling Target Analysis**

For **100 games × 100 players = 10,000 concurrent players** with:
- 2M grid squares per game (1000×2000)
- ~300K entities per game (3K entities × 100 players)
- Each player views 300-500 squares
- Real-time updates at 30 ticks/second

**Resource Requirements Per Game:**
```
Memory:
- Grid: 2M squares × 16 bytes = 32 MB
- Entities: 300K × 64 bytes = 19.2 MB  
- Player state: 100 × 10 KB = 1 MB
- Socket overhead: 100 × 50 KB = 5 MB
Total: ~60 MB per game

Network I/O:
- 100 players × 2 KB update × 30 ticks/sec = 6 MB/sec per game
- 100 games = 600 MB/sec = 4.8 Gbps
```

---

## 📈 **Phase 1: Current Monolithic Architecture**

**Capacity**: 10-20 games, ~2,000 players  
**Status**: ✅ **CURRENT IMPLEMENTATION**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Web Browser   │    │   Web Browser   │
│  Player Client  │    │  Player Client  │    │  Player Client  │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         │ HTTP/WebSocket       │                      │
         └──────────────────────┼──────────────────────┘
                                │
                   ┌────────────┴────────────┐
                   │   Node.js Server        │
                   │  (Express + Socket.io)  │
                   │                         │
                   │  - Game Manager         │
                   │  - Auth Routes          │
                   │  - Socket Handlers      │
                   └─────┬─────────┬─────────┘
                         │         │
                   ┌─────▼───┐  ┌──▼──────┐
                   │  Redis  │  │PostgreSQL│
                   └─────────┘  └──────────┘
```

**Bottlenecks:**
- ❌ Single process handles all games
- ❌ CPU bound on game loop calculations
- ❌ Memory limited to single Node.js instance
- ❌ All Socket.io connections to one process

**When to Evolve**: When approaching 15+ active games or 1,500+ players

---

## 📈 **Phase 2: Optimized Monolithic**

**Capacity**: 30-50 games, ~5,000 players  
**Target**: Q1 2026 (when hitting Phase 1 limits)

**Key Optimizations:**

### 1. **Spatial Partitioning** (Critical Performance Win)
```typescript
// Only check entities in relevant grid cells
class SpatialGrid {
  private cellSize = 100  // 100×100 grid cells
  private grid: Map<string, Entity[]>
  
  // O(1) lookup instead of O(n) scan
  getNearbyEntities(x: number, y: number): Entity[] {
    const cellKey = this.getCellKey(x, y)
    return this.grid.get(cellKey) || []
  }
}
```

### 2. **Delta Updates** (Reduce Network Traffic by 70%)
```typescript
// Only send what changed
interface DeltaUpdate {
  added: Entity[]
  removed: string[]
  updated: Partial<Entity>[]  // Only changed properties
}
```

### 3. **View Culling** (Send Only Visible Data)
```typescript
// Each player only receives entities in their viewport
function getPlayerUpdate(player: Player): Update {
  const viewport = calculateViewport(player)
  return {
    entities: spatialGrid.query(viewport),  // Not all entities!
    timestamp: Date.now()
  }
}
```

### 4. **Redis Clustering**
```
┌─────────────┐
│   Server    │
└──────┬──────┘
       │
   ┌───┴────┬─────────┬─────────┐
   │        │         │         │
┌──▼──┐  ┌─▼──┐   ┌──▼──┐   ┌──▼──┐
│Redis│  │Redis│  │Redis│  │Redis│
│  1  │  │  2  │  │  3  │  │  4  │
└─────┘  └─────┘  └─────┘  └─────┘
  Game     Game     Game     Game
 Shard 1  Shard 2  Shard 3  Shard 4
```

**Implementation Tasks:**
- [ ] Implement SpatialGrid class in shared package
- [ ] Add delta update compression to game state
- [ ] Implement viewport-based entity filtering
- [ ] Set up Redis Cluster (3-4 nodes)
- [ ] Add binary protocol (MessagePack) for Socket.io
- [ ] Implement update throttling (different tick rates per system)

**When to Evolve**: When CPU consistently above 70% or memory above 4GB

---

## 📈 **Phase 3: Dedicated Game Servers**

**Capacity**: 50-100 games, ~10,000 players  
**Target**: Q2-Q3 2026 (when Phase 2 optimized)

**Architecture:**

```
         ┌──────────────┐
         │Load Balancer │
         │   (nginx)    │
         └──────┬───────┘
                │
    ┌───────────┴────────────┐
    │                        │
┌───▼─────┐           ┌──────▼────┐
│  API    │           │   API     │
│ Server  │           │  Server   │
│(Auth +  │           │ (Auth +   │
│ Lobby)  │           │  Lobby)   │
└───┬─────┘           └─────┬─────┘
    │                       │
    └───────────┬───────────┘
                │
         ┌──────▼───────┐
         │    Redis     │
         │   Cluster    │
         │(Sessions +   │
         │  Lobby)      │
         └──────┬───────┘
                │
    ┌───────────┴────────────┬────────────┐
    │                        │            │
┌───▼────────┐    ┌──────────▼──┐   ┌─────▼──────┐
│Game Server │    │ Game Server │   │Game Server │
│     1      │    │      2      │   │     N      │
│ (10 games) │    │ (10 games)  │   │(10 games)  │
└─────┬──────┘    └──────┬──────┘   └─────┬──────┘
      │                  │                 │
      └──────────────────┼─────────────────┘
                         │
              ┌──────────┴─────────┐
              │                    │
         ┌────▼─────┐       ┌──────▼────┐
         │  Redis   │       │PostgreSQL │
         │  Cache   │       │ (Master)  │
         │(Game     │       │           │
         │ State)   │       │           │
         └──────────┘       └───────────┘
```

**Key Changes:**

### 1. **Game Orchestrator** (New Service)
```typescript
class GameOrchestrator {
  // Assigns games to servers based on load
  async createGame(gameId: string): Promise<string> {
    const servers = await this.getAvailableServers()
    const bestServer = servers.sort((a, b) => a.load - b.load)[0]
    
    await this.assignGameToServer(gameId, bestServer.id)
    return bestServer.wsEndpoint  // Return specific server
  }
  
  async getAvailableServers(): Promise<GameServer[]> {
    // Query Redis for server health
    const serverData = await redis.hgetall('game-servers')
    return Object.values(serverData)
      .filter(s => s.games < s.maxGames)
      .map(s => JSON.parse(s))
  }
}
```

### 2. **Service Discovery**
```typescript
// Client connects to API, gets routed to game server
app.post('/api/game/:gameId/join', async (req, res) => {
  const serverInfo = await redis.hget('game-locations', gameId)
  const server = JSON.parse(serverInfo)
  
  res.json({
    gameId,
    wsEndpoint: `wss://${server.hostname}:${server.port}`,
    token: generateGameToken(req.user.id, gameId)
  })
})
```

### 3. **Dedicated Game Server Process**
```typescript
// packages/game-server/src/index.ts
class GameServer {
  private games = new Map<string, GameEngine>()
  private maxGames = 10
  
  async assignGame(gameId: string): Promise<boolean> {
    if (this.games.size >= this.maxGames) return false
    
    const engine = new GameEngine(gameId, {
      tickRate: 30,
      maxPlayers: 100,
      gridSize: { width: 1000, height: 2000 }
    })
    
    await engine.initialize()
    this.games.set(gameId, engine)
    await this.reportCapacity()
    return true
  }
}
```

**New Package Structure:**
```
packages/
├── client/          # Existing
├── server/          # Becomes API server (auth, lobby)
├── game-server/     # NEW - Dedicated game hosting
│   ├── src/
│   │   ├── engine/       # Game loop & physics
│   │   ├── handlers/     # Socket event handlers
│   │   └── index.ts      # Game server process
│   └── package.json
└── shared/          # Existing
```

**Implementation Tasks:**
- [ ] Create game-server package
- [ ] Extract GameEngine into dedicated process
- [ ] Build GameOrchestrator service
- [ ] Implement service discovery with Redis
- [ ] Add server health monitoring
- [ ] Create server capacity reporting
- [ ] Build connection routing logic in API server

**When to Evolve**: When managing 40+ concurrent games

---

## 📈 **Phase 4: Kubernetes Orchestration**

**Capacity**: 100+ games, 10,000+ players  
**Target**: Q4 2026 / Q1 2027

**Architecture:**

```
                    ┌──────────────┐
                    │   Ingress    │
                    │ (nginx/ALB)  │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    ┌───▼─────┐      ┌─────▼────┐      ┌─────▼────┐
    │  API    │      │   API    │      │   API    │
    │  Pod 1  │      │  Pod 2   │      │  Pod N   │
    └────┬────┘      └────┬─────┘      └────┬─────┘
         │                │                  │
         └────────────────┼──────────────────┘
                          │
                   ┌──────▼───────┐
                   │ Redis Cluster│
                   │  (6 nodes)   │
                   └──────┬───────┘
                          │
      ┌───────────────────┼───────────────────┐
      │                   │                   │
  ┌───▼────┐         ┌────▼────┐        ┌────▼────┐
  │ Game   │         │  Game   │        │  Game   │
  │Server  │   ...   │ Server  │  ...   │ Server  │
  │ Pod 1  │         │  Pod 2  │        │  Pod 50 │
  │(10 gms)│         │(10 gms) │        │(10 gms) │
  └────┬───┘         └────┬────┘        └────┬────┘
       │                  │                   │
       └──────────────────┼───────────────────┘
                          │
              ┌───────────┴──────────┐
              │                      │
         ┌────▼─────┐         ┌──────▼────┐
         │PostgreSQL│         │   Redis   │
         │  Cluster │         │  (Cache)  │
         │(Master + │         │           │
         │Replicas) │         │           │
         └──────────┘         └───────────┘
```

**Key Components:**

### 1. **Horizontal Pod Autoscaling**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: game-server-hpa
spec:
  scaleTargetRef:
    kind: Deployment
    name: game-server
  minReplicas: 5
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: active_games
      target:
        type: AverageValue
        averageValue: "8"  # Scale when avg > 8 games/pod
```

### 2. **Game Server Deployment**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-server
spec:
  replicas: 10
  template:
    spec:
      containers:
      - name: game-server
        image: wallgame/game-server:latest
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        env:
        - name: MAX_GAMES_PER_SERVER
          value: "10"
```

**Implementation Tasks:**
- [ ] Containerize all services (Docker)
- [ ] Create Kubernetes manifests
- [ ] Set up K8s cluster (AWS EKS / GCP GKE)
- [ ] Configure Ingress controller
- [ ] Implement Pod autoscaling
- [ ] Set up PostgreSQL cluster with replicas
- [ ] Configure Redis Cluster on K8s
- [ ] Add health checks and liveness probes
- [ ] Implement graceful shutdown for game servers
- [ ] Set up monitoring (Prometheus + Grafana)

**When to Evolve**: When managing 80+ concurrent games or planning for launch

---

## 📈 **Phase 5: Global Scale**

**Capacity**: 500+ games, 50,000+ players  
**Target**: Post-launch growth phase

**Additional Features:**
- Regional game servers (US-East, US-West, EU, Asia)
- CDN for static assets
- Database sharding by region
- Message queue for async operations (RabbitMQ/Kafka)
- Dedicated analytics pipeline
- Game recording and replay system

---

## 🎯 **Optimization Techniques (Apply Across Phases)**

### **1. Interest Management**
```typescript
// Only send updates relevant to each player
class InterestManager {
  getRelevantUpdates(playerId: string, allUpdates: Update[]): Update[] {
    const player = this.players.get(playerId)
    const viewBounds = this.calculateViewBounds(player)
    
    return allUpdates.filter(update => 
      this.isInView(update.position, viewBounds) ||
      this.isPlayerRelevant(update.playerId, playerId)
    )
  }
}
```

### **2. Update Throttling**
```typescript
// Different systems update at different rates
const TICK_RATES = {
  physics: 30,        // 30 FPS - player movement, combat
  ai: 5,              // 5 FPS - AI decisions
  resources: 1,       // 1 FPS - resource generation
  persistence: 0.1    // Every 10 seconds - save to DB
}
```

### **3. Binary Protocol**
```typescript
// Use MessagePack instead of JSON (40-60% bandwidth reduction)
import msgpack from 'msgpack-lite'

socket.emit('update', msgpack.encode({
  entities: deltaUpdates,
  timestamp: Date.now()
}))
```

### **4. State Compression**
```typescript
interface CompressedState {
  full?: GameState           // Sent once on join
  delta?: DeltaUpdate        // Sent every tick
  checkpoint?: Partial<GameState>  // Every 10 seconds
}
```

---

## 📊 **Capacity Planning Summary**

| Phase | Games | Players | Infrastructure | Timeline |
|-------|-------|---------|----------------|----------|
| **Phase 1** (Current) | 10-20 | ~2,000 | Single Node.js server | Now |
| **Phase 2** (Optimized) | 30-50 | ~5,000 | Optimized monolith + Redis Cluster | Q1 2026 |
| **Phase 3** (Distributed) | 50-100 | ~10,000 | 10 game server processes | Q2-Q3 2026 |
| **Phase 4** (K8s) | 100-500 | 50,000 | K8s with 50 pods | Q4 2026 |
| **Phase 5** (Global) | 500+ | 100,000+ | Multi-region K8s | Post-launch |

---

## 🔍 **Decision Points**

**When to move Phase 1 → Phase 2:**
- [ ] Consistently hosting 15+ active games
- [ ] Player count approaching 1,500
- [ ] CPU usage consistently above 60%
- [ ] Memory usage above 3GB

**When to move Phase 2 → Phase 3:**
- [ ] Hosting 40+ active games
- [ ] Player count approaching 4,000
- [ ] Single server optimizations exhausted
- [ ] Need for better fault isolation

**When to move Phase 3 → Phase 4:**
- [ ] Hosting 80+ active games
- [ ] Manual server management becoming bottleneck
- [ ] Need auto-scaling for traffic spikes
- [ ] Planning for major launch/marketing

---

## 🛠️ **Current Development Focus**

**Active Phase**: Phase 1 - Monolithic Architecture  
**Next Milestone**: Complete core game features before optimizing

**Priorities:**
1. ✅ Authentication system
2. ✅ Game lobby and creation
3. ✅ Real-time game updates
4. 🔄 Admin system for game management
5. ⏳ Complete territory capture mechanics
6. ⏳ Resource system implementation
7. ⏳ Full game loop (win conditions)

**Then** → Start Phase 2 optimizations when needed

This roadmap ensures we build features first, then optimize for scale when we actually need it! 🚀
