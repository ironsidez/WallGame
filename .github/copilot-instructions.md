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

## 🧪 MANDATORY TEST PROTOCOL
**⚠️ CRITICAL: Follow this protocol for ALL significant changes**

### Before ANY code changes:
```bash
npm run test
```
**Expected Result**: 7-10 seconds, 12 steps, all ✅

### After implementing changes:
```bash
npm run test
```
**Required**: Report any timing changes or test failures

### Test Results Analysis
- **JSON Report**: Analyze `tests/test-results/[timestamp]/test-results.json` for detailed behavior verification
- **Application State**: Use JSON data to understand user flows, timing, and interaction patterns
- **Regression Detection**: Compare JSON results before/after changes to spot behavioral differences

### Test Suite Maintenance
- **New Features**: Update existing tests to cover new functionality
- **New User Flows**: Create entirely new test specs for new user journeys
- **Test Coverage**: Ensure all critical paths have automated verification
- **Selector Updates**: Maintain test selectors when UI changes

### Test Suite Details
- **Full User Journey**: Login → Lobby → Game Creation → Gameplay → Logout
- **Duration**: 7-10 seconds for complete flow
- **Artifacts**: Screenshots + HTML reports + JSON data in `tests/test-results/[timestamp]/`
- **12 Steps**: Comprehensive end-to-end validation
- **Task Integration**: Uses VS Code tasks for streamlined execution

### Failure Response
If tests fail:
1. **STOP** - Do not proceed with changes
2. **Debug**: Check `tests/test-results/[timestamp]/html-report/index.html`
3. **JSON Analysis**: Review `test-results.json` for behavioral insights
4. **Screenshots**: Review visual evidence in `screenshots/` folder
5. **Fix**: Address root cause before continuing

### Quick Commands
```bash
npm run dev                    # Start development server
npm run test                   # Run test suite (preferred method)
```

### Test Architecture
- **Optimized Performance**: Single page evaluation per step
- **Page Object Model**: Clean, maintainable test structure
- **Race Condition Handling**: Efficient stability waiting
- **Comprehensive Coverage**: Full user journey with visual documentation
- **Data Collection**: JSON reports for behavioral analysis and debugging
