# WallGame - Massive Multiplayer RTS

A browser-based real-time strategy game supporting hundreds of players simultaneously on persistent grid-based maps. Build cities, gather resources, train armies, and compete for territorial dominance in a classical RTS experience.

## Game Concept

**WallGame** is a classical RTS where players build civilizations from scratch on a shared grid-based map. Starting with just a handful of units including a vital Settler, players must establish cities, manage resources, construct buildings, and raise armies to compete with hundreds of other players in real-time.

### Core Gameplay Loop

1. **Start** - Join a game and receive starting units (including a Settler) at a random map location
2. **Settle** - Convert your Settler into a City (3×3 structure) to establish your base of operations
3. **Build** - Construct buildings around your city to gather resources and produce units
4. **Expand** - Create new Settlers from city population to establish additional cities
5. **Compete** - Train armies, control territory, and engage with other players
6. **Dominate** - Grow your civilization to become the dominant force on the map

## Key Game Systems

### 🗺️ Grid & Terrain System

**Map Grid**
- Finite-sized grid with configurable dimensions (set in game settings)
- Each square has X/Y coordinates and a terrain type
- Terrain types affect square attributes and gameplay

**Terrain Attributes** (influenced by terrain type and 8 surrounding squares)
- **Resources Available** - Base resources that can be harvested
- **Resource Refresh Rate** - How quickly resources regenerate
- **Movement Speed Modifier** - Affects unit travel time through the square
- Additional modifiers based on terrain combinations

**Terrain Types** (Examples)
- Plains, Forest, Mountain, Water, Desert, Tundra, etc.
- Each type provides different strategic advantages

### 🏰 Cities

Cities are the cornerstone of your civilization, created when a Settler unit converts itself into a City structure.

**City Properties**
- **Size**: 3×3 squares on the grid
- **Population**: Number of citizens living in the city
- **Morale**: Affects population growth and productivity (0-100%)
- **Education**: Influences growth rate and advancement (0-100%)
- **Fatigue**: Reduces growth, high fatigue can cause population loss (0-100%+)
- **Resources Stored**: Food, materials, and other resources

**Population System**
- Population updates occur on "Pop Ticks" (interval configurable in game settings)
- **Optimal Growth**: High food supply + 100% Morale + 100% Education + 0% Fatigue
- **Population Decline**: Insufficient food or excessive fatigue (fatigue compounds on decline)

**City Abilities**
- **Build Structures**: Place buildings adjacent to the city or other buildings
- **Create Settlers**: Convert population into new Settler units (decreases city population)
- **Resource Storage**: Central hub for collected resources
- **Build Zone**: Maximum build distance from city center (configurable in settings)

### 🏗️ Buildings

Buildings are constructed adjacent to your city or other buildings within the build zone.

**Building Categories**

**Resource Production**
- **Farms** - Food production
- **Lumber Mills** - Wood gathering
- **Quarries** - Stone extraction
- **Furnaces** - Ore processing/smelting

**Unit Production**
- **Barracks** - Train military units
- **City Center** - Create Settlers (uses population)

**Infrastructure**
- **Roads** - Special exception: can extend beyond normal build zone limits
- Many more types to be added

**Building Mechanics**
- Must be adjacent to city or another connected building
- Limited by build zone radius from city center
- Roads bypass standard zoning restrictions

### ⚔️ Units & Combat

Units are mobile entities that can move across the grid and engage in various actions.

**Starting Units**
- Players receive a collection of troops upon joining, always including at least one **Settler**
- Troops spawn at random locations, with system attempting to avoid close proximity to other players

**Unit Properties**
- **Location**: The grid square the unit currently occupies
- **Movement**: Speed determines travel time between squares
- **Attack**: Most units can attack (some specialized units cannot)
- **Special Abilities**: Transport, construction, scouting, etc.

**Movement System**
- Movement speed calculated from: Unit base speed + Terrain modifiers (departure & arrival squares)
- **Location Update**: Unit's location changes to target square immediately upon movement start
- **Movement Lock**: Units cannot issue new movement orders until current movement completes
- **Combat Resolution**: Uses current square location (immediate location update on move start)

**Combat**
- Units can attack enemy units and structures
- Positioning and terrain play strategic roles
- More advanced combat behaviors planned for future updates

**Special Unit: Settler**
- Can convert itself into a City (3×3 structure)
- Created from City population
- Essential for expansion

**Unit Types** (Examples, more to be added)
- Infantry, Cavalry, Archers, Siege units
- Transport units (carry other units, cannot attack)
- Scouts, Builders, etc.

## Game Configuration

Games can be customized with various settings:

- **Map Size** - Grid dimensions (width × height)
- **Game Tick Length** - Duration of each game simulation tick
- **Pop Tick Frequency** - How many game ticks between population updates
- **City Build Zone Radius** - Maximum build distance from city center
- **Starting Units** - Types and quantities of units players receive
- **Resource Rates** - Gathering and regeneration speeds
- And many more options...

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

### Current Mechanics
- **Authentication System** - Secure user registration and login
- **Game Lobby** - Create and join active games
- **Real-time Communication** - Socket.io for instant multiplayer updates
- **Grid Rendering** - Canvas-based map visualization

### Core Systems (In Development)
- **Terrain System** - Grid squares with terrain types and dynamic attributes
- **City Management** - Population, morale, education, and fatigue mechanics
- **Resource System** - Production, storage, and consumption
- **Building System** - Construction zones and adjacency rules
- **Unit System** - Movement, combat, and special abilities
- **Game Tick System** - Configurable simulation and population ticks

### Advanced Features (Planned)
- **Fog of War** - Limited vision and exploration
- **Diplomacy** - Alliances, trade, and player interaction
- **Technology Tree** - Unlock advanced units and buildings
- **Multiple Victory Conditions** - Conquest, economic, cultural
- **Seasons & Weather** - Dynamic environmental effects
- **Naval & Air Units** - Multi-domain warfare
- **Campaigns** - Long-term persistent civilization building

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
