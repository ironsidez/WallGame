# WallGame - Massive Multiplayer RTS

A browser-based real-time strategy game supporting hundreds of players simultaneously. Players compete by placing Tetris-like structures on a grid to capture territory through strategic positioning and combined structure values.

## Game Concept

- **Grid-based territorial control** - Place structures on a shared grid
- **Multi-shape building pieces** - Tetris-inspired structure shapes
- **Combat through adjacency** - Capture enemy structures by having higher combined values
- **Real-time multiplayer** - Hundreds of players in persistent battles
- **Strategic depth** - Resource management, alliances, and specialized building types

## Tech Stack

### Backend
- **Node.js + TypeScript** - Server runtime and type safety
- **Socket.io** - Real-time bidirectional communication
- **Redis** - Fast game state storage and pub/sub
- **PostgreSQL** - Player data and match persistence
- **Express** - REST API for non-real-time operations

### Frontend
- **React + TypeScript** - UI framework with type safety
- **Canvas API** - High-performance game rendering
- **Socket.io Client** - Real-time server communication
- **Zustand** - Lightweight state management

### Shared
- **Game logic library** - Shared validation and calculations
- **Type definitions** - Common interfaces and types

## Project Structure

```
├── packages/
│   ├── client/          # React frontend
│   ├── server/          # Node.js backend
│   └── shared/          # Shared game logic and types
├── tests/               # All testing files and results
│   ├── automated-tester.js
│   ├── ai-screenshot-analyzer.js
│   └── TESTING_GUIDE.md
├── docs/                # Game design and API documentation
└── docker/              # Container configurations
```

## Quick Start

```bash
# Install dependencies
npm install

# Start development environment
npm run dev

# Build for production
npm run build

# Run automated tests
npx playwright test tests/automated-tester.js --headed

# Analyze test results with AI
node tests/ai-screenshot-analyzer.js
```

## Testing

The project includes a comprehensive testing system with AI-powered screenshot analysis:

- **Automated Testing**: Complete game flow testing with Playwright
- **Screenshot Analysis**: AI visual analysis using OpenAI or Anthropic APIs
- **Metadata Fallback**: Works without API keys using metadata analysis
- **Visual Reports**: HTML reports with detailed results

See [tests/TESTING_GUIDE.md](tests/TESTING_GUIDE.md) for complete documentation.

## Game Features

### Core Mechanics
- **Grid System** - Infinite expandable game grid
- **Structure Placement** - Drag and drop Tetris-like pieces
- **Territory Capture** - Adjacent structures battle based on combined values
- **Real-time Updates** - Instant synchronization across all players

### Advanced Features (Planned)
- **Resource System** - Structures generate resources over time
- **Structure Types** - Generators, fortresses, amplifiers, scouts
- **Fog of War** - Limited vision and reconnaissance
- **Alliances** - Team up with other players
- **Campaigns** - Long-term persistent battles

## Development

- **Development Server**: http://localhost:3000 (client) + http://localhost:3001 (server)
- **Database**: PostgreSQL on port 5432
- **Redis**: Redis server on port 6379

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details
