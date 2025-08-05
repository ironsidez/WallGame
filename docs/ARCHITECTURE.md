# WallGame Architecture Overview

## 🏗️ **High-Level System Architecture**

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
