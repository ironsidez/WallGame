/**
 * Map Generator - Creates procedural maps for WallGame
 * 
 * Map File Format:
 * - First line: WIDTH HEIGHT
 * - Remaining lines: Terrain characters representing each grid square
 * 
 * Terrain Characters:
 * . = Plains
 * ^ = Mountain
 * ~ = Water
 * T = Forest (Tree)
 * # = Hills
 * % = Desert
 * * = Tundra
 * @ = Swamp
 */

import { TerrainType } from './types';

export interface MapDimensions {
  width: number;
  height: number;
}

export interface MapData {
  dimensions: MapDimensions;
  terrain: TerrainType[][];
}

// Terrain character to type mapping
export const TERRAIN_CHARS: Record<string, TerrainType> = {
  '.': TerrainType.PLAINS,
  '^': TerrainType.MOUNTAIN,
  '~': TerrainType.WATER,
  'T': TerrainType.FOREST,
  '#': TerrainType.HILLS,
  '%': TerrainType.DESERT,
  '*': TerrainType.TUNDRA,
  '@': TerrainType.SWAMP,
};

// Reverse mapping for encoding
export const TERRAIN_TO_CHAR: Record<TerrainType, string> = {
  [TerrainType.PLAINS]: '.',
  [TerrainType.MOUNTAIN]: '^',
  [TerrainType.WATER]: '~',
  [TerrainType.FOREST]: 'T',
  [TerrainType.HILLS]: '#',
  [TerrainType.DESERT]: '%',
  [TerrainType.TUNDRA]: '*',
  [TerrainType.SWAMP]: '@',
};

/**
 * Parse a map file string into MapData
 */
export function parseMapFile(mapFileContent: string): MapData {
  const lines = mapFileContent.trim().split('\n');
  
  // First line: dimensions
  const [width, height] = lines[0].split(' ').map(Number);
  
  if (!width || !height) {
    throw new Error('Invalid map file: missing or invalid dimensions');
  }
  
  // Remaining lines: terrain
  const terrain: TerrainType[][] = [];
  
  for (let y = 0; y < height; y++) {
    const lineIndex = y + 1;
    if (lineIndex >= lines.length) {
      throw new Error(`Invalid map file: missing line ${lineIndex} (height: ${height})`);
    }
    
    const line = lines[lineIndex];
    const row: TerrainType[] = [];
    
    for (let x = 0; x < width; x++) {
      const char = line[x];
      const terrainType = TERRAIN_CHARS[char];
      
      if (terrainType === undefined) {
        throw new Error(`Invalid terrain character '${char}' at position (${x}, ${y})`);
      }
      
      row.push(terrainType);
    }
    
    terrain.push(row);
  }
  
  return {
    dimensions: { width, height },
    terrain,
  };
}

/**
 * Encode MapData into a map file string
 */
export function encodeMapFile(mapData: MapData): string {
  const lines: string[] = [];
  
  // First line: dimensions
  lines.push(`${mapData.dimensions.width} ${mapData.dimensions.height}`);
  
  // Terrain lines
  for (const row of mapData.terrain) {
    const line = row.map(terrain => TERRAIN_TO_CHAR[terrain]).join('');
    lines.push(line);
  }
  
  return lines.join('\n');
}

/**
 * Generate a random map using Perlin-like noise and biome distribution
 */
export function generateRandomMap(width: number, height: number, seed?: number): MapData {
  const terrain: TerrainType[][] = [];
  
  // Simple pseudo-random generator with seed
  const random = seed !== undefined 
    ? seededRandom(seed)
    : Math.random;
  
  // Generate base noise map
  const noiseMap = generateNoiseMap(width, height, random);
  
  // Convert noise to terrain types
  for (let y = 0; y < height; y++) {
    const row: TerrainType[] = [];
    
    for (let x = 0; x < width; x++) {
      const noise = noiseMap[y][x];
      const terrainType = noiseToTerrain(noise, x, y, width, height);
      row.push(terrainType);
    }
    
    terrain.push(row);
  }
  
  return {
    dimensions: { width, height },
    terrain,
  };
}

/**
 * Generate a noise map (values 0-1)
 */
function generateNoiseMap(width: number, height: number, random: () => number): number[][] {
  const noise: number[][] = [];
  
  // Simple fractal noise (multiple octaves)
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    
    for (let x = 0; x < width; x++) {
      let value = 0;
      let amplitude = 1;
      let frequency = 0.02; // Base frequency
      
      // Multiple octaves for detail
      for (let octave = 0; octave < 4; octave++) {
        const sampleX = x * frequency;
        const sampleY = y * frequency;
        
        // Simple smooth noise using sine
        const noiseValue = (
          Math.sin(sampleX) * Math.cos(sampleY) +
          Math.sin(sampleX * 2.5 + random() * 0.1) * Math.cos(sampleY * 1.7) * 0.5
        );
        
        value += noiseValue * amplitude;
        
        amplitude *= 0.5;
        frequency *= 2;
      }
      
      // Normalize to 0-1
      value = (value + 2) / 4;
      value = Math.max(0, Math.min(1, value));
      
      row.push(value);
    }
    
    noise.push(row);
  }
  
  return noise;
}

/**
 * Convert noise value to terrain type with biome-like distribution
 */
function noiseToTerrain(
  noise: number, 
  x: number, 
  y: number, 
  width: number, 
  height: number
): TerrainType {
  // Temperature gradient (colder at top/bottom)
  const centerY = height / 2;
  const distanceFromEquator = Math.abs(y - centerY) / (height / 2);
  const temperature = 1 - distanceFromEquator;
  
  // Moisture is primarily based on noise
  const moisture = noise;
  
  // Water (low noise values)
  if (noise < 0.3) {
    return TerrainType.WATER;
  }
  
  // Mountains (very high noise)
  if (noise > 0.8) {
    return TerrainType.MOUNTAIN;
  }
  
  // Cold regions (far from equator)
  if (temperature < 0.3) {
    if (noise > 0.6) {
      return TerrainType.MOUNTAIN;
    }
    return TerrainType.TUNDRA;
  }
  
  // Hot and dry = Desert
  if (temperature > 0.7 && moisture < 0.5) {
    return TerrainType.DESERT;
  }
  
  // Moderate moisture = Forest
  if (moisture > 0.6 && moisture < 0.75) {
    return TerrainType.FOREST;
  }
  
  // Hills (medium-high elevation)
  if (noise > 0.65 && noise <= 0.8) {
    return TerrainType.HILLS;
  }
  
  // Swamp (low elevation, high moisture)
  if (noise > 0.3 && noise < 0.4 && moisture > 0.6) {
    return TerrainType.SWAMP;
  }
  
  // Default to plains
  return TerrainType.PLAINS;
}

/**
 * Seeded random number generator
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  
  return () => {
    // Simple LCG (Linear Congruential Generator)
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Create a small test map (useful for development)
 */
export function createTestMap(): MapData {
  // 20x15 test map with varied terrain
  const mapString = `20 15
..........~~~~......
..TTT.....~~~~......
..TTT......~~~....##
...TT.......~.....##
................####
..............######
.............@@@####
............@@@@....
...........@@@......
%%........@@@.......
%%%%.....^^^........
%%%%....^^^^........
%%%....^^^^^........
%%....******........
%.....*******........`;

  return parseMapFile(mapString);
}
