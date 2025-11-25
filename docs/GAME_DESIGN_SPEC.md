# WallGame - Game Design Specification

> **Status**: In Development  
> **Last Updated**: November 24, 2025  
> **Purpose**: Document exact requirements as specified by project owner

---

## Document Purpose

This document captures ONLY the features and requirements explicitly specified by the project owner. Nothing in this document is assumed or invented.

**Development Rule**: If something is not in this document, ask before implementing it.

---

## 1. Player States

### Online/Offline Status
- **"Online"** = User is logged into the game
- **"Offline"** = User has logged out

### In-Game Status
- **"In-Game"** = Currently viewing and playing in a specific game
- **"Participating"** = Registered as a participant in a game (has units/cities in that game)

### Participation Rules
- Players can participate in up to **10 games** simultaneously
- Players can only be **"In-Game" in 1 game at a time**
- Cannot open multiple game windows simultaneously
- To switch games: Exit current game → Return to lobby → Enter different game

### Game Buttons
- **"Join Game"** = Become a participant in a new game
- **"Enter Game"** = Open a game you're already participating in

### Persistence
- Units and cities remain in games even when player is offline or In-Game in a different game
- Participation persists indefinitely once joined

---

## 2. Unit System

### Unit Count
- Each unit has a **count** property (represents quantity)
- **Maximum count**: 50,000 per unit
- **Default starting units**: 1 Settler unit with count 50,000

### Unit Splitting
- A unit can split into multiple smaller units
- Example: 1 unit (count 50,000) → 2 units (count 25,000 each)
- Example: 1 unit (count 50,000) → 5 units (count 10,000 each)

### Unit Merging
- Only units of **same type** and **same owner** can merge
- Example: 2 units (count 25,000 each) → 1 unit (count 50,000)

### Stacking Rules
- **Maximum 6 different units** per square per player/alliance (for movement)
- Exception: City deletion can create more units on one square (e.g., deleting a city with 1 million population creates ~20 units of count 50,000)
- Overflow units can exist but no additional units can move to that square

### City Creation
- Only **Settlers** with count **≥100** can convert to a City
- Conversion consumes the Settler unit

### Unit Count Visualization
Units display a segmented bar showing count:

**Segment Colors:**
- **Purple** = 10,000s (5 purple bars = 50,000)
- **Green** = 1,000s (1 green bar = 1,000)
- **Yellow** = 100s (1 yellow bar = 100)
- **Red** = 10s (1 bar = 1-10, 2 bars = 11-20, etc.)

**Examples:**
- Count 50,000 = 5 purple bars
- Count 10,000 = 1 purple bar
- Count 5,000 = 5 green bars
- Count 4,555 = 4 green + 5 yellow + 6 red bars

---

## 3. Chat System

### Channel Types

| Channel | Who Sees It | When Active | Can Leave? |
|---------|-------------|-------------|------------|
| **World Chat** | All online players | Always | No |
| **Help Chat** | All online players | Always | Yes |
| **Lobby Chat** | Players not In-Game | While in lobby | No (auto) |
| **Game Chat** | Players In-Game in specific game | While In-Game | No (auto) |
| **Alliance Chat** | Alliance members in specific game | While In-Game + in alliance | No (auto) |
| **Private Messages** | 1-on-1 with another player | Always (persists) | Yes |

### Tab Interface
- **Location**: Bottom of screen
- **Behavior**: All channels shown as tabs, only 1 active at a time
- **Unread Indicators**: Visual notification when messages arrive in non-active tabs

### Tab Ordering (Left to Right)
1. Game Chat (leftmost when In-Game)
2. Alliance Chat (if in alliance)
3. World Chat
4. Help Chat
5. Lobby Chat (only visible when in lobby)
6. Private Message tabs

### Channel Behavior
- Enter game → Game Chat tab opens (becomes active)
- In alliance → Alliance Chat tab appears
- Exit game → Game Chat and Alliance Chat tabs close
- Return to lobby → Lobby Chat tab appears

### Private Messages
- Right-click player name → "Message" option
- Creates 1-on-1 private channel tab
- Always 1-on-1 (no group channels)
- Persists when going offline

### Persistence
- **On Logout**: Removed from ALL channels
- **On Login**: Automatically rejoin World Chat, Help Chat (if not left), and Private Message channels
- **Game/Alliance Channels**: Only exist while In-Game in that specific game

### Chat History
- **Last 50 messages** per channel (in-memory)
- Lost on server restart
- No messages shown from when you were offline

### Channel Management
- **"+" Button**: Shows available channels to join
- Only admins can create new global channels
- Currently only World Chat and Help Chat exist

---

## 4. Spawn System

### Spawn Location Algorithm

**Priority Order:**
1. **100 squares from nearest enemy city** (mandatory, never relaxed)
2. **100 squares from enemy units** (ideal, can be relaxed)
3. **No spawning in water** (Ocean/River terrain)
4. **Avoid islands smaller than 10,000 blocks**

**Fallback Strategy:**
- If no location meets all criteria, reduce unit distance requirement:
  - Try 100 squares from units
  - Try 50 squares from units
  - Try 25 squares from units
  - Continue reducing until spawn found
- City distance (100 squares) is NEVER reduced

**Anti-Exploit:**
- Players cannot manipulate spawns by dispersing units

### Starting Unit Placement
- All starting units spawn on same square if ≤6 units
- If >6 units, place on surrounding squares in this order:

```
9 2 3
8 1 4  (1 = spawn point)
7 6 5
```

**Example**: 7 units → 6 on center, 1 on square 2 (north)

---

## 5. Game Ticks & Timing

### Tick System
- **1 Game Tick = 1 in-game second**
- Each game has its own independent clock
- NOT configurable (base time unit)
- Game clock runs continuously, even with 0 players In-Game

### Production Tick
- **1 Prod Tick = X Game Ticks** (configurable at game creation)
- **Default**: ~10 Game Ticks (10 seconds)
- When building construction progress updates

### Population Tick
- **1 Pop Tick = Y Game Ticks** (configurable at game creation)
- **Default**: ~600 Game Ticks (10 minutes)
- When city population updates

---

## 6. Terrain System

### Terrain Types

| Terrain | Resource Bonus | Move Speed | Special Effects |
|---------|----------------|------------|-----------------|
| **Plains** | More crops | Normal | Default terrain |
| **Hills** | Higher metal | Slightly reduced | - |
| **Mountain** | Higher stone | Greatly reduced | - |
| **River** | - | Medium reduced | Adds fatigue per prod tick |
| **Ocean** | - | Greatly reduced | Large fatigue per prod tick |
| **Desert** | Low crops | Medium reduced | - |
| **Forest** | More wood | Slightly reduced | - |

### Map Generation
- **Default terrain**: Plains
- **Terrain sliders**: Percentage-based for each non-plains terrain type
  - More Ocean = Island-heavy map
  - More Forest = Thick forest patches
- **Expected map size**: 1000 × 2000 squares

---

## 7. Artifacts

### Spawn Timing
- Configured at game creation
- **Default**: After 12 Pop Ticks or 7200 Game Ticks (2 hours)
- Artifacts exist on map from game start but are invisible/non-interactive until revealed

### Artifact Count
- **Default**: 10 artifacts per game

### Claiming
- Move any unit you control onto the artifact's square
- Cannot claim if enemy unit is on the square
- Unit carries the artifact while moving

### Movement (Auto-moving artifacts)
- Different artifacts have different rules
- Examples: Flying (no terrain restrictions), Walking (turns around at water)

---

## 8. Win Conditions

### Primary Win Condition
- Control **ALL artifacts** for X hours (configurable, e.g., 30 minutes)

### Fallback Win Condition
- If max game time reached: Player/Alliance with most total artifact control time wins

### Alliance Rules
- If player joins alliance while holding artifact, artifact time resets to 0
- Alliance artifact time = sum of time alliance members held artifacts while in alliance

---

## 9. Game Lifecycle

### Game Creation
- Games start immediately when created (no waiting period)
- Game clock begins ticking instantly
- Games run even with 0 players

### Game Status
```
Created → Playing (immediate)
Playing → Finished (when win condition met or time limit reached)
```

### Finished State
- Game state freezes (no further actions allowed)
- Winner message displayed
- Participating players can still enter and view
- Game chat remains active
- Marked as "Finished" in lobby with winner shown
- No new players can join

---

## 10. Game Settings (Configurable at Creation)

- Map selection (premade, random premade, or generated with terrain sliders)
- Game speed (prod tick interval, pop tick interval)
- Artifact release time (in ticks or pop ticks)
- Win condition (artifact control duration required)
- Max game duration (time limit)
- Max players
- Starting units (type and count)

---

## 11. Lobby

### Game List Display
- **Sorting**: Newest games at top
- **Scrolling**: Support scrolling if too many games
- Shows per game:
  - Game name
  - Player count: "X/Y" (X = In-Game, Y = total participants)
  - Ticks elapsed
  - Artifact release time
  - Win condition
  - Winner (if finished)

### Buttons
- **"Join Game"**: Become participant (if not already, game not full/finished)
- **"Enter Game"**: Open game you're participating in

### Game Creation
- Admin only
- Single form with all settings
- No presets currently

---

## 12. Right-Click Menu (Player Names)

- **Message**: Create 1-on-1 private chat
- **View Game Score**: If in same game
- **View Overall Stats**: Player statistics
- **Ignore**: Don't see their messages, block new message channels from them

---

## 13. Clans & Alliances (Future)

- **Clans**: Groups that persist outside individual games, have their own chat channels
- **Alliances**: Teams formed within individual games, have game-specific chat channels
- Cannot leave clan/alliance chat without leaving the clan/alliance

---

## 14. Implementation Priorities

### Phase 1: Foundation (Current)
- ✅ Authentication
- ✅ Lobby with game list
- ✅ Admin game creation/deletion
- ✅ Real-time lobby updates
- ✅ Game participation tracking

### Phase 2: Core Systems (Next)
- [ ] Chat system (all channel types)
- [ ] Unit count visualization
- [ ] Spawn location algorithm
- [ ] Game tick system
- [ ] Terrain loading
- [ ] Enter/exit game (single active game enforcement)

### Phase 3: RTS Mechanics
- [ ] Unit movement
- [ ] City creation (from Settler count ≥100)
- [ ] Building construction
- [ ] Resource production
- [ ] Population growth
- [ ] Combat

### Phase 4: Advanced
- [ ] Artifacts
- [ ] Alliances
- [ ] Win conditions
- [ ] Unit split/merge
- [ ] Map generation with sliders

---

**End of Specification**

This document contains ONLY features explicitly described by the project owner. If a feature or detail is not listed here, it has not been specified yet.
