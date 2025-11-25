# WallGame Maps

This directory contains map files used to define terrain for game instances.

## Map File Format

Map files use a simple ASCII format:

```
WIDTH HEIGHT
TERRAIN_CHARS...
```

**Example:**
```
20 15
..........~~~~......
..TTT.....~~~~......
..TTT......~~~....##
...TT.......~.....##
................####
```

### Terrain Characters

| Character | Terrain Type | Movement Cost | Resource Mult | Defense Bonus |
|-----------|--------------|---------------|---------------|---------------|
| `.` | Plains | 1.0 | 1.2 | 0.0 |
| `T` | Forest | 1.5 | 1.0 | 0.2 |
| `^` | Mountain | 3.0 | 0.5 | 0.5 |
| `~` | Water | 999 (impassable) | 0.0 | 0.0 |
| `%` | Desert | 1.2 | 0.3 | 0.0 |
| `*` | Tundra | 1.8 | 0.4 | 0.1 |
| `#` | Hills | 2.0 | 0.8 | 0.3 |
| `@` | Swamp | 2.5 | 0.6 | -0.1 |

## Generating Maps

### Test Map (20x15, predefined)
```bash
npm run generate-map -- --test
```
Creates: `maps/test.map`

### Random Map
```bash
npm run generate-map -- --width 100 --height 100 --seed 12345
```
Creates: `maps/map_100x100_12345.map`

### Custom Output
```bash
npm run generate-map -- --width 50 --height 50 --output maps/custom.map
```

## Map Selection

When creating a game, you can specify which map to use:

```typescript
// Server-side game creation
gameManager.createGame({
  mapFile: 'default.map',  // Loads maps/default.map
  maxPlayers: 100
});
```

If no `mapFile` is specified, the test map is used by default.

## Available Maps

- **test.map** - Small 20x15 map for testing and development
- **default.map** - 100x100 map with balanced terrain distribution (seed: 12345)

## Map Generation Algorithm

Maps are generated using:
- Multi-octave Perlin-like noise for elevation
- Temperature gradient (colder at poles)
- Biome distribution based on temperature + moisture (noise)
- Seeded random generation for reproducibility

See `packages/shared/src/map-generator.ts` for implementation details.
