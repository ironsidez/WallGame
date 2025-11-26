# Copilot Instructions for WallGame

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
WallGame is a browser-based classical real-time strategy game supporting hundreds of simultaneous players. Players build cities, gather resources, train armies, and compete for territorial dominance on persistent grid-based maps.

**📋 Game Design Spec**: See [docs/GAME_DESIGN_SPEC.md](../docs/GAME_DESIGN_SPEC.md) - **THE SOURCE OF TRUTH**
**🏗️ Architecture details**: See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for scaling roadmap  
**🛠️ Development setup**: See [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md) for environment setup

## 🚨 CRITICAL: Spec-Driven Development

**ALL features MUST be defined in `docs/GAME_DESIGN_SPEC.md` BEFORE implementation.**

### Feature Development Workflow
1. **Check the Spec**: Before building ANY feature, verify it exists in `GAME_DESIGN_SPEC.md`
2. **Ask Questions**: If the spec is unclear or incomplete, ASK the user for clarification
3. **Update Spec FIRST**: Add/update the spec with clear requirements BEFORE writing any code
4. **Write Tests FIRST**: Create/update tests that validate the new feature BEFORE implementation
5. **Implement Feature**: Only after spec and tests are in place
6. **Run Full Test Suite**: Verify ALL tests pass after implementation
7. **Never Guess**: Do not make assumptions about game mechanics - if it's not in the spec, ask

### What Requires Spec Updates
- New game mechanics or systems
- Changes to existing behavior
- New UI components or user flows
- New socket events or API endpoints
- Changes to data models or state management

## Tech Stack
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

## 🧪 MANDATORY TEST PROTOCOL
**⚠️ CRITICAL: Follow this protocol for ALL changes**

### Test-First Development
1. **Write/Update Tests FIRST** - Before implementing any feature
2. **Tests Should Initially Fail** - Confirms test is checking new behavior
3. **Implement Feature** - Make the tests pass
4. **Run Full Suite** - Ensure no regressions

### Before ANY code changes:
```bash
npm run test
```
**Document**: Note current test count and pass/fail status

### After implementing changes:
```bash
npm run test
```
**Required**: ALL tests must pass. Report any failures immediately.

### Test Results Analysis
- **JSON Report**: Analyze `tests/test-results/[timestamp]/test-results.json` for detailed behavior verification
- **Summary**: Check `tests/test-results/[timestamp]/summary.txt` for quick overview
- **Screenshots**: Review visual evidence in `screenshots/` folder
- **Regression Detection**: Compare JSON results before/after changes to spot behavioral differences

### Test Suite Maintenance
- **New Features**: Write tests BEFORE implementing the feature
- **Bug Fixes**: Write a failing test that reproduces the bug, then fix it
- **Refactoring**: Ensure existing tests still pass
- **Never**: Update tests AFTER implementation just to make them pass (this hides bugs)

### Failure Response
If tests fail:
1. **STOP** - Do not proceed with more changes
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
- **Page Object Model**: Clean, maintainable test structure in `tests/pages/`
- **Strict Validation**: Tests fail hard on mismatches - no tolerance for incorrect data
- **Comprehensive Coverage**: Full user journey with visual documentation
- **Data Collection**: JSON reports for behavioral analysis and debugging
