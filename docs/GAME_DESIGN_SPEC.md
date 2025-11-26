# WallGame - Game Design Specification

> **Status**: In Development  
> **Last Updated**: November 25, 2025  
> **Version**: 3.0

---

## Document Structure

This spec is organized **entity-first**. Each data model defines:
- **Properties** - What attributes the entity has
- **Actions** - What behaviors the entity can perform
- **Rules** - Constraints and game logic

**Adding New Features**: Find the entity → Add property or action → Link from UI components.

---

## Table of Contents

### Common Types
- [Location](#location)

### Data Models (Core Entities)
- [Player](#player)
- [Game](#game)
- [Grid Square](#grid-square)
- [Unit](#unit)
- [City Center](#city-center)
- [Facility](#facility)
- [Artifact](#artifact)

### User Interface
- [Login Page](#login-page)
- [Lobby Page](#lobby-page)
- [Game Page](#game-page)

### Reference Tables
- [Terrain Types](#terrain-types)
- [Unit Types](#unit-types)
- [Facility Types](#facility-types)
- [Resource Types](#resource-types)
- [Supply Types](#supply-types)

### Implementation
- [Implementation Status](#implementation-status)

---

# Common Types

---

## Location

A position on the game map. Used by all entities that exist on the grid.

| Property | Type | Description |
|----------|------|-------------|
| x | number | X coordinate (0 to mapWidth-1) |
| y | number | Y coordinate (0 to mapHeight-1) |

---

# Data Models

---

## Player

A user account that persists across games.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| id | string | Unique identifier |
| username | string | Display name, unique |
| isAdmin | boolean | Can create/delete games |
| isOnline | boolean | Currently connected to server |
| currentGameId | string \| null | Game currently In-Game (max 1) |
| participatingGameIds | string[] | Games joined (max 10) |

### States

| State | Condition |
|-------|-----------|
| Online | Connected to server |
| Offline | Disconnected |
| In-Game | currentGameId is set |
| Participating | participatingGameIds.includes(gameId) |

### Actions

#### Login
- **Parameters**: username, password
- **Result**: Sets isOnline = true, returns JWT token
- **Failure**: Invalid credentials

#### Logout
- **Parameters**: none
- **Result**: Sets isOnline = false, clears currentGameId

#### Register
- **Parameters**: username, password
- **Result**: Creates Player, auto-login
- **Constraints**: Username must be unique

#### Join Game
- **Parameters**: gameId
- **Result**: Adds gameId to participatingGameIds
- **Constraints**: participatingGameIds.length < 10, game not full, game not finished

#### Enter Game
- **Parameters**: gameId
- **Result**: Sets currentGameId = gameId
- **Constraints**: Must be participating in game

#### Exit Game
- **Parameters**: none
- **Result**: Sets currentGameId = null
- **Note**: Remains in participatingGameIds

---

## Game

A single game instance with its own map, players, and state.

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| id | string | - | Unique identifier |
| name | string | - | Display name |
| status | enum | paused | `paused` \| `playing` \| `finished` |
| currentTick | number | 0 | Current game tick |
| popTicksRemaining | number \| null | maxDuration | Pop ticks until game ends (null = unlimited) |
| startTime | Date | - | When game will start (tick begins) |
| winnerId | string \| null | null | Player or Alliance who won |
| maxPlayers | number | 100 | Maximum participants |
| mapWidth | number | 1000 | Grid width in squares |
| mapHeight | number | 2000 | Grid height in squares |
| prodTickInterval | number | 10 | Game ticks per prod tick |
| popTickInterval | number | 600 | Game ticks per pop tick |
| artifactReleaseTime | number | 12 | Pop ticks until artifacts reveal |
| winConditionDuration | number | 0.5 | Hours to hold all artifacts |
| maxDuration | number \| null | null | Max game length in pop ticks (null = unlimited) |

### States

| State | Description |
|-------|-------------|
| paused | Before startTime - players can join, no tick running |
| playing | Game is active, tick running |
| finished | Win condition met, no actions allowed |

### Actions

#### Create Game (Admin Only)
- **Parameters**: name, startTime, maxPlayers, mapWidth, mapHeight, prodTickInterval, popTickInterval, artifactReleaseTime, winConditionDuration, maxDuration
- **Result**: Creates Game with status = paused, popTicksRemaining = maxDuration
- **Note**: Game remains paused until startTime, then automatically transitions to playing

#### Delete Game (Admin Only)
- **Parameters**: gameId
- **Result**: Removes game entirely

#### Tick
- **Trigger**: Automatic, continuous (1 tick = 1 second)
- **Result**: Increments currentTick, triggers prod/pop ticks

### Prod Tick
Triggers every `prodTickInterval` game ticks.

**Updates**:
- Facility upgrade/repair/salvage progress
- Resource extraction from terrain
- Resource regeneration (renewable only)
- Unit food consumption
- Unit fatigue recovery/increase
- Unit morale changes (if starving)
- Unit desertion (if morale = 0)
- Barracks unit production
- City fatigue/morale (if starving)

### Pop Tick
Triggers every `popTickInterval` game ticks.

**Updates**:
- City population growth/decline
- School training increases

---

## Grid Square

A single cell on the game map. All entities exist on grid squares.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| location | [Location](#location) | Position on the map |
| terrainType | [TerrainType](#terrain-types) | Type of terrain |
| ownerId | string \| null | Player who controls this square |
| visibleTo | string[] | Player/Alliance IDs that can currently see this square |

### Visibility

**Terrain Always Visible**: The entire map terrain is visible from spawn. `visibleTo` only affects entity visibility and resource inspection.

**visibleTo Array**:
- Contains IDs of players/alliances with vision on this square
- Empty = no one can see entities or inspect resources
- Used to push updates only to relevant players

**Visibility Updates**: Real-time (not on ticks). Player/Alliance added to `visibleTo` when within vision range of their Unit or Facility.

### Resources

Each square contains extractable resources based on terrain. Resources exist only in terrain - once harvested, they become [Supplies](#supplies) stored in cities.

| Property | Type | Behavior |
|----------|------|----------|
| crops | ResourceAmount | Renewable - regenerates each prod tick |
| wood | ResourceAmount | Renewable - regenerates each prod tick |
| stone | ResourceAmount | Finite - depletes when extracted |
| ore | ResourceAmount | Finite - depletes when extracted |

#### ResourceAmount

| Property | Type | Description |
|----------|------|-------------|
| count | number | Current amount available |
| maxAmount | number | Maximum capacity |
| regenRate | number | Per prod tick (0 for finite) |

**Regeneration**: Based on adjacent terrain. More forest nearby = faster wood regen. Heavily harvested areas recover slower.

**Visibility**: Resource details only visible when player is in visibleTo array for that square.

### Contained Entities

| Property | Type | Constraint |
|----------|------|------------|
| unitIds | string[] | Max 6 per player/alliance |
| facilityId | string \| null | Max 1 per square |
| cityCenterId | string \| null | If part of city's 3×3 |
| cityCenterPosition | `center` \| `edge` \| null | Position in city grid |
| artifactId | string \| null | Max 1 per square |

### Rules

**Unit Stacking**:
- Max 6 units per player/alliance per square
- Enemy units cannot occupy same square (movement blocked)
- If alliance breaks: units remain, cannot add more

**Building**:
- Cannot place Facility on square with hidden Artifact (fails silently - clue!)
- Only 1 Facility per square
- City Center spans 3×3 squares

---

## Unit

A group of troops that moves and acts as one entity.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| id | string | Unique identifier |
| type | [UnitType](#unit-types) | Category of unit |
| location | [Location](#location) | Current position on map |
| ownerId | string | Player who controls this unit |
| allianceId | string \| null | Alliance if owner is in one |
| count | number | Troop quantity (1-50,000) |
| fatigue | number | Exhaustion level (0-100) |
| morale | number | Fighting spirit (0-100) |
| training | number | Skill level (0-100) |
| carriedSupplies | SupplyBag | Supplies being transported |
| isOnGuard | boolean | Auto-attack enemies in range |
| movementQueue | [Location](#location)[] | Queued waypoints |
| visionRadius | number | Squares of visibility (default: 1) |

### Count

| Constraint | Value |
|------------|-------|
| Minimum | 1 |
| Maximum | 50,000 |
| On Zero | Unit is destroyed |

**Visualization**: Segmented bar display
| Color | Represents | Example |
|-------|------------|---------|
| Purple | 10,000s | 5 bars = 50,000 |
| Green | 1,000s | 5 bars = 5,000 |
| Yellow | 100s | 5 bars = 500 |
| Red | 10s | 5 bars = 50 |

### Fatigue

| Value | Effect |
|-------|--------|
| 0-79 | Normal operation |
| 80-100 | Cannot move until < 80 |

**Increases**: Movement, combat, standing on River/Ocean/Swamp (per prod tick)  
**Decreases**: Each prod tick while stationary, standing on Hospital

### Morale

| Value | Effect |
|-------|--------|
| 1-100 | Modifier to attack/defense |
| 0 | Desertion - loses troops each prod tick |

**Increases**: Combat victories, Theatre proximity, City Center proximity  
**Decreases**: Combat defeats, casualties, starvation

### Training

| Value | Effect |
|-------|--------|
| 0-100 | Modifier to attack/defense, slight speed boost |

**Increases**: Standing on School, created with higher training (slower production)

### Actions

#### Move
- **Parameters**: targetPosition, usePathfinding (default: true)
- **Execution**:
  1. Calculate path (if pathfinding enabled)
  2. Move one square at a time
  3. Speed = base × terrain modifier × training bonus
  4. Animation plays on client, server updates position immediately
- **Constraints**: Fatigue < 80, target has room (< 6 friendly units)
- **Pathfinding**: Avoids water, enemy units, prefers non-desert
- **Ctrl+Click**: Direct path (ignores obstacles)
- **Blocked**: If next square becomes blocked, unit stops

#### Move (Waypoint Queue)
- **Parameters**: positions[]
- **Execution**: Unit moves through each position in sequence
- **Shift+Click**: Adds to queue instead of replacing

#### Attack
- **Available To**: Infantry, Cavalry, Archer, Catapult
- **Parameters**: targetPosition
- **Execution**:
  1. If not in range, move toward target first
  2. Deal damage to all enemies on target square
  3. Defenders automatically return damage
  4. Update fatigue, morale for both sides
- **Range**: Melee = adjacent, Archer = 2 squares
- **Damage Formula**:
  ```
  attackPower = count × attackMod × (training/100) × (morale/100) × ((100-fatigue)/100)
  defensePower = count × defenseMod × (training/100) × (morale/100) × terrainBonus
  casualties = (attackPower - defensePower) / casualtyDivisor
  ```

#### On Guard (Toggle)
- **Parameters**: enabled (boolean)
- **Effect**: When enabled, auto-triggers Attack when enemy enters range

#### Split
- **Parameters**: newCounts[] (must sum to current count)
- **Result**: Creates multiple units from one
- **Example**: 1 unit (50,000) → 2 units (25,000 each)

#### Merge
- **Constraints**: Same UnitType, same owner, same square
- **Result**: Combines into single unit
- **Auto-Merge**: Units on Barracks auto-merge with compatible units

#### Disband
- **Constraints**: Must be on City Center
- **Result**: Population returns to city, resources return to stockpile

#### Pickup Supplies
- **Parameters**: supplyType, amount
- **Source**: City Center stockpile
- **Constraint**: carriedSupplies has capacity limit

#### Drop Supplies
- **Parameters**: supplyType, amount
- **Target**: City Center stockpile

#### Found City
- **Available To**: Settler only
- **Constraints**: count ≥ 100, 3×3 area clear
- **Result**: Consumes unit, creates City Center with population = count

---

## City Center

A 3×3 area controlled by a player. Stores resources and produces units.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| id | string | Unique identifier |
| location | [Location](#location) | Center position on map |
| ownerId | string | Player who controls |
| population | number | Citizens living in city |
| morale | number | City happiness (0-100) |
| training | number | Default training for new pop (0-100) |
| fatigue | number | City exhaustion (0-100) |
| damage | number | Structural damage (0-100%) |
| facilityIds | string[] | Facilities belonging to this city |
| visionRadius | number | Squares of visibility (default: 1) |

### Supplies

Supplies are processed resources stored in the city. Resources become supplies when harvested by facilities.

| Property | Type | Produced From |
|----------|------|---------------|
| food | number | crops (via Farm) |
| lumber | number | wood (via Lumber Mill) |
| bricks | number | stone (via Quarry) |
| metal | number | ore (via Furnace) |

### Grid Occupation

Occupies 9 Grid Squares in 3×3 pattern:
```
[edge]   [edge]   [edge]
[edge]   [center] [edge]
[edge]   [edge]   [edge]
```

Each square has `cityCenterId` set and `cityCenterPosition` = center or edge.

### Influence Radius

**30 squares from center** - Facilities can only be built within this radius.

### Population

**Growth** (each Pop Tick):
- Based on: food, morale, training, fatigue
- Percentage-based: larger cities grow/shrink faster
- New population starts untrained

**Consumption**:
- Creating Units costs population
- Facility workers come from population (max 50,000 per facility)

**Starvation** (no food):
- Each Prod Tick: fatigue++, morale--
- Fatigue > 80%: population dies each tick

### Actions

#### Build Facility
- **Parameters**: facilityType, position
- **Constraints**:
  - Within influence radius (30 squares)
  - No existing facility on square
  - No hidden artifact on square
  - Placement rules (see below)
- **Result**: Creates Facility at 20% upgrade progress
- **Cost**: Deducts resources from stockpile

**Placement Rules**:
- **Within 15 squares**: Can place adjacent to any facility
- **Beyond 15 squares**: Must be adjacent to facility at 40%+ upgrade

---

## Facility

A building that provides bonuses or produces resources. Belongs to a City Center.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| id | string | Unique identifier |
| type | [FacilityType](#facility-types) | Category of facility |
| location | [Location](#location) | Position on map |
| cityId | string | Owning City Center |
| upgradeProgress | number | Construction progress (0-100%) |
| damage | number | Structural damage (0-100%) |
| workerCount | number | Assigned population (0-50,000) |
| mode | enum | `produce` \| `repair` \| `salvage` \| `upgrade` |
| visionRadius | number | Squares of visibility (default: 1) |

### Construction Progress

| Progress | State |
|----------|-------|
| 20% | Just placed |
| 40% | Enters production (after 1 prod tick) |
| 100% | Fully upgraded |

**Max progress per prod tick**: 20%  
**Minimum ticks to 100%**: 4 prod ticks (20→40→60→80→100)

### Modes

| Mode | Effect (per Prod Tick) |
|------|------------------------|
| produce | Extracts resources from square, sends to city |
| repair | Reduces damage % |
| salvage | Destroys facility, returns partial resources |
| upgrade | Increases upgradeProgress |

### Resource Extraction

- Extracts from **own square only**
- Rate = baseRate × (upgradeProgress/100) × (workerCount/50000) × artifactBonuses
- Extracted resources → converted to supplies → City Center stockpile

### Actions

#### Set Mode
- **Parameters**: mode (produce/repair/salvage/upgrade)
- **Result**: Changes facility mode

#### Assign Workers
- **Parameters**: count
- **Constraints**: count ≤ 50,000, count ≤ city.population
- **Result**: Workers assigned from city population

---

## Artifact

A special object that determines game victory.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| id | string | Unique identifier |
| location | [Location](#location) | Position on map |
| isRevealed | boolean | Visible to players |
| holderId | string \| null | Player or Unit carrying |
| holdStartTime | Date \| null | When current holder claimed |

### States

**Hidden** (isRevealed = false):
- Exists from game start
- Invisible to all players
- Units can walk through
- Blocks facility building (fails silently)

**Revealed** (isRevealed = true):
- Visible on map
- Can be claimed

### Actions

#### Reveal
- **Trigger**: After artifactReleaseTime pop ticks
- **Result**: Sets isRevealed = true

#### Claim
- **Trigger**: Unit moves onto artifact square
- **Constraints**: No enemy units on square
- **Result**: Sets holderId, holdStartTime, unit carries artifact

### Win Condition

Hold **ALL artifacts** for `winConditionDuration` hours.
- Alliance: Combined time of all members while allied.

---

# User Interface

---

## Login Page

Entry point for unauthenticated users.

### Components

#### Login Tab
| Element | Type | Action |
|---------|------|--------|
| Username field | text input | - |
| Password field | password input | - |
| Login button | button | Calls [Player.Login](#login) |

**On Success**: Navigate to [Lobby Page](#lobby-page)  
**On Failure**: Display error message

#### Registration Tab
| Element | Type | Action |
|---------|------|--------|
| Username field | text input | Must be unique |
| Password field | password input | - |
| Confirm password | password input | Must match |
| Register button | button | Calls [Player.Register](#register) |

**On Success**: Auto-login, navigate to [Lobby Page](#lobby-page)  
**On Failure**: Display error message

---

## Lobby Page

Hub for authenticated users not currently In-Game.

**State**: Player.isOnline = true, Player.currentGameId = null

### Components

#### Header
| Element | Description |
|---------|-------------|
| Username display | Shows Player.username |
| Admin badge | Shown if Player.isAdmin |
| Logout button | Calls [Player.Logout](#logout) |

#### Active Games List

Displays all [Games](#game), sorted newest first. Scrollable.

| Column | Source |
|--------|--------|
| Name | Game.name |
| Players | "In-Game / Participating" counts |
| Ticks | Game.currentTick |
| Artifacts | Release time / status |
| Win Condition | Required hold duration |
| Status | Game.status |
| Winner | Game.winnerId (if finished) |

**Row Actions**:
| Button | Visibility | Action |
|--------|------------|--------|
| Join Game | Not participating, not full, not finished | Calls [Player.JoinGame](#join-game) |
| Enter Game | Participating | Calls [Player.EnterGame](#enter-game) |
| Delete Game | Player.isAdmin | Calls [Game.DeleteGame](#delete-game-admin-only) |

#### Create Game Form (Admin Only)

| Field | Type | Maps To |
|-------|------|---------|
| Game name | text | Game.name |
| Map selection | dropdown | mapType |
| Max players | number | settings.maxPlayers |
| Prod tick interval | number | settings.prodTickInterval |
| Pop tick interval | number | settings.popTickInterval |
| Artifact release time | number | settings.artifactReleaseTime |
| Win condition duration | number | settings.winConditionDuration |
| Max duration | number | settings.maxDuration |
| Starting units | config | spawnConfig |

**Submit**: Calls [Game.CreateGame](#create-game-admin-only)

#### Chat Panel
→ See [Chat Component](#chat-component)

**Available Channels**:
- World Chat (always visible)
- Help Chat (can leave/rejoin)
- Lobby Chat (auto-joined while in lobby)
- Private Messages

---

## Game Page

Main gameplay interface.

**State**: Player.currentGameId is set

### Layout

```
┌─────────────────────────────────────────┬──────────────────┐
│                                         │                  │
│          Game Grid Component            │    Selected      │
│            (majority)                   │    Entity        │
│                                         │    Component     │
│    ┌─────────┐                          │                  │
│    │ Minimap │                          │                  │
│    └─────────┘                          │                  │
├─────────────────────────────────────────┴──────────────────┤
│                    Chat Component                          │
└────────────────────────────────────────────────────────────┘
```

### Game Grid Component

Displays viewport of game map.

**Viewport**:
- Resizable to fit display
- Zoom: scroll wheel (min/max TBD)

**Rendering**:
- [Grid Squares](#grid-square) with terrain sprites
- [Units](#unit) with animated sprites
- [City Centers](#city-center) with sprites
- [Facilities](#facility) with sprites (show upgrade %, damage)
- [Artifacts](#artifact) (only if revealed)

**Fog Rendering**: Terrain always visible. Entities only visible where player is in GridSquare.visibleTo array.

**Panning**:
- Arrow keys or WASD
- Click tile: centers on that tile
- Click minimap: centers viewport

### Selection & Control

#### Selection Inputs

| Input | Action |
|-------|--------|
| Left-click unit | Select that Unit |
| Left-click facility | Select that Facility |
| Left-click terrain | Center camera, deselect |
| Click-drag box | Select all friendly Units in box |
| Shift + click | Add to selection |
| Shift + drag | Add box contents to selection |
| Double-click facility | Select all same-type facilities for that city |
| Escape | Deselect all |
| Right-click (nothing selected) | Deselect |

**Rules**:
- Box select only selects friendly units
- Cannot select enemy units
- Right-click on crowded square: context menu listing units

#### Command Inputs

| Input | Action |
|-------|--------|
| Right-click empty square | [Unit.Move](#move) |
| Right-click enemy unit | [Unit.Attack](#attack) |
| Ctrl + right-click | Move with usePathfinding = false |
| Shift + right-click | Add waypoint |

### Minimap Component

Small overview of entire map.
- Outline shows current viewport
- Click: centers Game Grid on that location
- Updates real-time for visible areas

### Selected Entity Component

Displays details of selected entity.

**When Unit Selected**:
| Display | Source |
|---------|--------|
| Type | Unit.type |
| Count | Unit.count (with visualization bars) |
| Owner | Unit.ownerId |
| Fatigue bar | Unit.fatigue (0-100) |
| Morale bar | Unit.morale (0-100) |
| Training bar | Unit.training (0-100) |
| Carried resources | Unit.carriedResources |
| On Guard toggle | Unit.isOnGuard |
| Action buttons | Available actions for unit type |

**When Multiple Units Selected**:
- Summary list
- Actions that apply to all

**When City Center Selected**:
| Display | Source |
|---------|--------|
| Owner | City.ownerId |
| Population | City.population |
| Morale/Training/Fatigue | Bars (0-100) |
| Resources | City.storedResources |
| Facilities list | City.facilityIds (click to select) |
| Action buttons | Build, etc. |

**When Facility Selected**:
| Display | Source |
|---------|--------|
| Type | Facility.type |
| Owning city | Facility.cityId |
| Upgrade progress | Facility.upgradeProgress (0-100%) |
| Damage | Facility.damage (0-100%) |
| Workers | Facility.workerCount / 50,000 |
| Mode selector | produce/repair/salvage/upgrade |

**When Grid Square Selected (no entity)**:
| Display | Source |
|---------|--------|
| Terrain | GridSquare.terrainType |
| Resources | GridSquare resources (only if player in visibleTo) |
| Coordinates | GridSquare.location.x, GridSquare.location.y |

### Game Info Component

| Display | Source |
|---------|--------|
| Game name | Game.name |
| Current tick | Game.currentTick |
| Artifact status | Release countdown or holder info |
| Win progress | Time remaining if holding all |
| Player list | Online/offline indicators |

### Chat Component

| Channel | Availability | Can Leave |
|---------|--------------|-----------|
| Game Chat | In-Game | No (auto) |
| Alliance Chat | In-Game + in alliance | No (auto) |
| World Chat | Always | No |
| Help Chat | Always | Yes |
| Private Messages | Always | Yes |

**Tab Order**: Game Chat → Alliance Chat → World Chat → Help Chat → PMs

**Not Available In-Game**: Lobby Chat (auto-left on enter)

---

# Reference Tables

---

## Terrain Types

| Type | Primary Resource | Speed Modifier | Fatigue Effect | Passable |
|------|------------------|----------------|----------------|----------|
| Plains | crops | 1.0 | Low | Yes |
| Forest | wood | 0.8 | Low | Yes |
| Hills | stone, metal | 0.6 | Medium | Yes |
| Mountain | stone, metal | 0.4 | High | Yes |
| Desert | crops (low) | 0.7 | Medium | Yes |
| Swamp | - | 0.5 | +Per prod tick | Yes |
| River | - | 0.6 | +Per prod tick | Transport only |
| Ocean | - | 0.3 | ++Per prod tick | Transport only |

---

## Unit Types

| Type | Can Attack | Range | Speed | Special | Available Actions |
|------|------------|-------|-------|---------|-------------------|
| Settler | No | - | Normal | - | Move, Found City |
| Infantry | Yes | Melee | Normal | - | Move, Attack |
| Cavalry | Yes | Melee | Fast | - | Move, Attack |
| Archer | Yes | 2 | Normal | Ranged | Move, Attack |
| Scout | No | - | Fast | Extended vision | Move |
| Transport | No | - | Normal | Crosses water, carries | Move |
| Catapult | Yes | TBD | Slow | Siege | Move, Attack |

**Common Actions (All Units)**: Split, Merge, Disband, Pickup Supplies, Drop Supplies, On Guard Toggle

---

## Facility Types

### Production

| Type | Extracts | Produces | Resource Type |
|------|----------|----------|---------------|
| Farm | crops | food | Renewable |
| Lumber Mill | wood | lumber | Renewable |
| Quarry | stone | bricks | Finite |
| Furnace | ore | metal | Finite |

### Military

| Type | Function |
|------|----------|
| Barracks | Produces Units (population + resources → units per prod tick) |

### Support

| Type | Effect |
|------|--------|
| School | Increases training (pop tick), units on school gain training |
| Theatre | Increases morale of nearby units/population |
| Hospital | Decreases fatigue of nearby units/population |
| Watchtower | Extended vision radius |

---

## Resource Types

Resources exist in terrain and are extracted by facilities.

| Resource | Found On | Behavior |
|----------|----------|----------|
| crops | Plains, Desert | Renewable |
| wood | Forest | Renewable |
| stone | Hills, Mountain | Finite |
| ore | Hills, Mountain | Finite |

---

## Supply Types

Supplies are stored in cities and used for production/consumption.

| Supply | Produced From | Used For |
|--------|---------------|----------|
| food | crops | Population, Units |
| lumber | wood | Buildings, Units |
| bricks | stone | Buildings |
| metal | ore | Buildings, Units |

---

# Implementation Status

## Phase 1: Foundation ✅
- ✅ [Login Page](#login-page)
- ✅ [Lobby Page](#lobby-page) (Active Games)
- ✅ [Player](#player) authentication
- ✅ Admin game create/delete
- ✅ Real-time lobby updates
- ✅ Game participation tracking

## Phase 2: Core Systems (Next)
- [ ] [Chat Component](#chat-component)
- [ ] [Game Page](#game-page) layout
- [ ] [Game Grid Component](#game-grid-component)
- [ ] [Minimap Component](#minimap-component)
- [ ] [Selection & Control](#selection--control)
- [ ] [Unit](#unit) count visualization
- [ ] Spawn system (spawn new players)
- [ ] [Game.Tick](#tick) system
- [ ] [Grid Square.visibleTo](#visibility)

## Phase 3: Gameplay
- [ ] [Unit.Move](#move)
- [ ] [Unit.Attack](#attack)
- [ ] [Unit.Found City](#found-city)
- [ ] [City.Build Facility](#build-facility)
- [ ] [Facility](#facility) modes
- [ ] [Grid Square](#grid-square) resource extraction
- [ ] [City Center](#city-center) population growth
- [ ] Unit fatigue/morale/training

## Phase 4: Advanced
- [ ] [Artifact](#artifact) system
- [ ] Alliances
- [ ] Win conditions
- [ ] [Unit.Split](#split) / [Unit.Merge](#merge)
- [ ] Map generation

---

**End of Specification**

*Add new features by: finding the entity → adding property or action → linking from UI.*
