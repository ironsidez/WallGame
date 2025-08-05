# Copilot Instructions for WallGame

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
WallGame is a massive multiplayer real-time strategy game built for browsers. The game features:
- Grid-based territorial control mechanics
- Tetris-like structure placement
- Real-time multiplayer with hundreds of players
- Territory capture through adjacent structure value comparison

## Architecture
- **Monorepo structure** with client, server, and shared packages
- **Backend**: Node.js + TypeScript + Socket.io + Redis + PostgreSQL
- **Frontend**: React + TypeScript + Canvas API
- **Real-time communication** via Socket.io for game state synchronization

## Code Style Guidelines
- Use TypeScript for all new code
- Follow functional programming patterns where possible
- Implement proper error handling and validation
- Use descriptive variable and function names
- Add JSDoc comments for complex game logic
- Separate game logic from presentation code

## Game Development Patterns
- **Game State**: Immutable state updates with proper validation
- **Event System**: Socket.io events for real-time game actions
- **Rendering**: Canvas-based rendering for performance
- **Collision Detection**: Efficient grid-based spatial queries
- **Persistence**: Redis for temporary state, PostgreSQL for permanent data

## Key Components
- **Grid System**: 2D coordinate system for structure placement
- **Structure System**: Multi-cell Tetris-like building pieces
- **Territory System**: Adjacent structure value comparison logic
- **Player Management**: Authentication, sessions, and game lobbies
- **Resource System**: Building costs and generation mechanics

## Performance Considerations
- Optimize for hundreds of concurrent players
- Use efficient data structures for grid operations
- Implement proper caching strategies
- Minimize network traffic with delta updates
- Use web workers for heavy computations when needed
