# WallGame - Massive Multiplayer RTS

A browser-based real-time strategy game supporting hundreds of players simultaneously on persistent grid-based maps.

## Documentation

- **📋 Game Design Spec**: [docs/GAME_DESIGN_SPEC.md](docs/GAME_DESIGN_SPEC.md) - **The source of truth for all game mechanics**
- **🏗️ Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Technical architecture and scaling roadmap
- **🛠️ Development**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Setup and development guide

## Quick Start

```bash
# Install dependencies
npm install

# Start development environment (client + server)
npm run dev

# Run tests
npm run test
```

## Tech Stack

- **Backend**: Node.js + TypeScript + Socket.io + Redis + PostgreSQL
- **Frontend**: React + TypeScript + Canvas API
- **Testing**: Playwright with Page Object Model

## Project Structure

```
├── packages/
│   ├── client/          # React frontend
│   ├── server/          # Node.js backend
│   └── shared/          # Shared game logic and types
├── tests/               # Playwright tests and results
├── docs/                # Design specs and documentation
└── database/            # SQL setup scripts
```

## Development

- **Client**: http://localhost:3000
- **Server**: http://localhost:3001
- **PostgreSQL**: Port 5432
- **Redis**: Port 6379

## License

MIT License
