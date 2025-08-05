# WallGame Development Setup

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **PostgreSQL** (v13 or higher)
- **Redis** (v6 or higher)
- **Git**

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <your-repo-url>
   cd WallGame
   npm install
   ```

2. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb wallgame
   
   # Start Redis server
   redis-server
   ```

3. **Environment Configuration**
   ```bash
   cp packages/server/.env.example packages/server/.env
   # Edit the .env file with your database credentials
   ```

4. **Start Development Servers**
   ```bash
   npm run dev
   ```

   This will start both the client (port 3000) and server (port 3001).

## Development Workflow

### Building the Project
```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@wallgame/shared
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific package tests
npm test --workspace=@wallgame/server
```

### VS Code Tasks
- **Ctrl+Shift+P** → "Tasks: Run Task"
- Choose from available tasks:
  - Install Dependencies
  - Build All
  - Dev Server
  - Start Server Only
  - Start Client Only

## Project Structure

```
packages/
├── client/          # React frontend (Vite + TypeScript)
├── server/          # Node.js backend (Express + Socket.io)
└── shared/          # Shared game logic and types
```

## Game Architecture

### Backend Components
- **GameManager**: Core game logic and state management
- **DatabaseManager**: PostgreSQL operations
- **RedisManager**: Real-time state and caching
- **Socket Handlers**: Real-time multiplayer communication

### Frontend Components
- **Game Board**: Canvas-based game rendering
- **Structure Palette**: Building selection UI
- **Player Dashboard**: Resources and statistics
- **Chat System**: Real-time communication

### Shared Components
- **Game Logic**: Territory capture algorithms
- **Structure Templates**: Tetris-like building shapes
- **Validation**: Action and state validation
- **Types**: TypeScript interfaces

## Game Mechanics

### Core Gameplay
1. **Grid System**: Infinite expandable 2D grid
2. **Structure Placement**: Drag and drop Tetris-like pieces
3. **Territory Capture**: Adjacent structures battle based on combined values
4. **Resource Management**: Earn resources through captures and generators

### Structure Types
- **Basic**: Simple building blocks
- **Generator**: Produces resources over time
- **Fortress**: High defense structures
- **Amplifier**: Boosts nearby friendly structures
- **Scout**: Reveals fog of war
- **Saboteur**: Weakens enemy structures

## Debugging

### Server Debugging
1. Set breakpoints in VS Code
2. Press **F5** or use "Launch Server" configuration
3. Server will start with debugger attached

### Client Debugging
1. Start the dev server: `npm run dev:client`
2. Open Chrome DevTools
3. Use React Developer Tools extension

## Performance Considerations

### Backend Optimization
- Redis for fast game state access
- PostgreSQL for persistent data
- Efficient grid algorithms for large player counts
- WebSocket connection pooling

### Frontend Optimization
- Canvas rendering for smooth performance
- Efficient update mechanisms
- Lazy loading for large game states
- Memory management for long sessions

## Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Variables
Make sure to set production values for:
- `DB_PASSWORD`: Secure database password
- `JWT_SECRET`: Strong JWT signing key
- `REDIS_URL`: Production Redis instance
- `CLIENT_URL`: Production client URL

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Run the test suite
5. Submit a pull request

## Troubleshooting

### Common Issues

**Database Connection Error**
- Ensure PostgreSQL is running
- Check connection credentials in `.env`
- Verify database exists

**Redis Connection Error**
- Ensure Redis server is running
- Check Redis URL in `.env`

**Module Not Found Errors**
- Run `npm install` in the root directory
- Ensure workspace dependencies are linked

**Build Errors**
- Clear node_modules and reinstall
- Check TypeScript configuration
- Verify all imports are correct
