/**
 * Map Generator - Creates procedural terrain maps for WallGame
 * 
 * Terrain Types (per GAME_DESIGN_SPEC.md):
 * - Plains: Default, good for crops
 * - Forest: Wood resource
 * - Hills: Stone/metal resources
 * - Mountain: Stone/metal, high defense
 * - Desert: Low crops, medium speed
 * - Swamp: Fatigue penalty
 * - River: Transport only, fatigue penalty
 * - Ocean: Transport only, high fatigue
 */

import { TerrainType, TerrainWeights } from './types';

export interface MapDimensions {
  width: number;
  height: number;
}

export interface MapData {
  dimensions: MapDimensions;
  terrain: TerrainType[][];
}

// Default spawn frequencies (50 = standard rate)
export const DEFAULT_TERRAIN_WEIGHTS: TerrainWeights = {
  forest: 50,
  hills: 50,
  mountain: 50,
  desert: 50,
  swamp: 50,
  water: 50
};

/**
 * Generate a random map with configurable terrain frequency weights
 * Weights are on 0-200 scale where 50 = standard spawn rate
 */
export function generateRandomMap(
  width: number, 
  height: number, 
  seed?: number,
  weights: TerrainWeights = DEFAULT_TERRAIN_WEIGHTS
): MapData {
  const terrain: TerrainType[][] = [];
  
  // Create seeded random generator
  const random = seededRandom(seed ?? Date.now());
  
  // For very large maps (>1M tiles), use fast generation
  const totalTiles = width * height;
  if (totalTiles > 1000000) {
    return generateFastMap(width, height, random, weights);
  }
  
  // Generate elevation map (0-1 values)
  const elevationMap = generateNoiseMap(width, height, random, 0.02);
  
  // Generate moisture map (0-1 values) with different frequency
  const moistureMap = generateNoiseMap(width, height, random, 0.03);
  
  // Convert noise to terrain using frequency weights
  for (let y = 0; y < height; y++) {
    const row: TerrainType[] = [];
    
    for (let x = 0; x < width; x++) {
      const elevation = elevationMap[y][x];
      const moisture = moistureMap[y][x];
      
      const terrainType = selectTerrain(elevation, moisture, weights, random);
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
 * Fast map generation for very large maps (>1M tiles)
 * Uses simpler hash-based generation instead of multi-octave noise
 */
function generateFastMap(
  width: number,
  height: number,
  random: () => number,
  weights: TerrainWeights
): MapData {
  const terrain: TerrainType[][] = [];
  
  // Pre-calculate probability thresholds from weights (50 = 1x standard rate)
  const waterMult = weights.water / 50;
  const mountainMult = weights.mountain / 50;
  const hillsMult = weights.hills / 50;
  const swampMult = weights.swamp / 50;
  const desertMult = weights.desert / 50;
  const forestMult = weights.forest / 50;
  
  // Generate seed offsets for variety
  const seedX = random() * 10000;
  const seedY = random() * 10000;
  
  for (let y = 0; y < height; y++) {
    const row: TerrainType[] = [];
    
    for (let x = 0; x < width; x++) {
      // Fast hash-based pseudo-random (much faster than noise)
      const hash = fastHash(x + seedX, y + seedY);
      // Extract three independent values from the hash (0-1 range)
      const elevation = ((hash >>> 0) & 0xFF) / 255;
      const moisture = ((hash >>> 8) & 0xFF) / 255;
      const variety = ((hash >>> 16) & 0xFF) / 255;
      
      // Simple terrain selection based on hash values
      // These thresholds are tuned to give good terrain distribution
      let terrainType: TerrainType;
      
      // Ocean at very low elevation (about 5% of map with standard weights)
      if (elevation < 0.05 * waterMult) {
        terrainType = TerrainType.OCEAN;
      }
      // River at low elevation (about 5% of map)
      else if (elevation < 0.10 * waterMult && variety < 0.5) {
        terrainType = TerrainType.RIVER;
      }
      // Mountains at high elevation (about 8% of map)
      else if (elevation > (1.0 - 0.08 * mountainMult)) {
        terrainType = TerrainType.MOUNTAIN;
      }
      // Hills at medium-high elevation (about 12% of map)
      else if (elevation > (1.0 - 0.20 * hillsMult) && variety < 0.6) {
        terrainType = TerrainType.HILLS;
      }
      // Swamp at low elevation + high moisture (about 5% of map)
      else if (elevation < 0.35 && moisture > (1.0 - 0.15 * swampMult)) {
        terrainType = TerrainType.SWAMP;
      }
      // Desert at low moisture (about 10% of map)
      else if (moisture < 0.15 * desertMult && elevation > 0.15) {
        terrainType = TerrainType.DESERT;
      }
      // Forest at medium-high moisture (about 20% of map)
      else if (moisture > (1.0 - 0.25 * forestMult)) {
        terrainType = TerrainType.FOREST;
      }
      // Default to plains (remaining ~35%)
      else {
        terrainType = TerrainType.PLAINS;
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
 * Fast integer hash function (much faster than noise)
 */
function fastHash(x: number, y: number): number {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = (h * 1274126177) | 0;
  return (h ^ (h >> 16)) | 0;
}

/**
 * Convert frequency weights (0-200 scale) to spawn probabilities
 * 50 = standard (1x), 100 = 2x, 200 = 4x
 */
function frequencyToMultiplier(weight: number): number {
  return weight / 50; // 50 -> 1x, 100 -> 2x, 200 -> 4x
}

/**
 * Select terrain type based on elevation, moisture, and frequency weights
 * Plains is the default terrain - other terrains spawn on top based on conditions
 */
function selectTerrain(
  elevation: number,
  moisture: number,
  weights: TerrainWeights,
  random: () => number
): TerrainType {
  // Convert weights to multipliers
  const waterMult = frequencyToMultiplier(weights.water);
  const mountainMult = frequencyToMultiplier(weights.mountain);
  const hillsMult = frequencyToMultiplier(weights.hills);
  const swampMult = frequencyToMultiplier(weights.swamp);
  const desertMult = frequencyToMultiplier(weights.desert);
  const forestMult = frequencyToMultiplier(weights.forest);
  
  // Water at very low elevation (modified by frequency)
  if (elevation < 0.25 * waterMult && weights.water > 0) {
    // Deeper = ocean, shallower = river
    if (elevation < 0.12 * waterMult) {
      return TerrainType.OCEAN;
    }
    return TerrainType.RIVER;
  }
  
  // Mountains at very high elevation (modified by frequency)
  const mountainThreshold = 1 - (0.15 * mountainMult);
  if (elevation > mountainThreshold && weights.mountain > 0) {
    return TerrainType.MOUNTAIN;
  }
  
  // Hills at high elevation (modified by frequency)
  const hillsThreshold = 1 - (0.30 * hillsMult);
  if (elevation > hillsThreshold && weights.hills > 0) {
    // Mix with mountains occasionally
    if (random() < 0.2 * mountainMult && weights.mountain > 0) {
      return TerrainType.MOUNTAIN;
    }
    return TerrainType.HILLS;
  }
  
  // Swamp at low elevation with high moisture (modified by frequency)
  const swampChance = 0.3 * swampMult;
  if (elevation < 0.4 && moisture > 0.65 && weights.swamp > 0) {
    if (random() < swampChance) {
      return TerrainType.SWAMP;
    }
  }
  
  // Desert at low moisture (modified by frequency)
  const desertChance = 0.4 * desertMult;
  if (moisture < 0.35 && weights.desert > 0) {
    if (random() < desertChance) {
      return TerrainType.DESERT;
    }
  }
  
  // Forest based on moisture and frequency
  const forestChance = moisture * 0.5 * forestMult;
  if (moisture > 0.4 && weights.forest > 0) {
    if (random() < forestChance) {
      return TerrainType.FOREST;
    }
  }
  
  // Default to plains
  return TerrainType.PLAINS;
}

/**
 * Generate a 2D noise map using multi-octave value noise
 */
function generateNoiseMap(
  width: number, 
  height: number, 
  random: () => number,
  baseFrequency: number = 0.02
): number[][] {
  const noise: number[][] = [];
  
  // Pre-generate random offsets for each octave
  const octaveOffsets: { x: number; y: number }[] = [];
  for (let i = 0; i < 4; i++) {
    octaveOffsets.push({
      x: random() * 10000,
      y: random() * 10000
    });
  }
  
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    
    for (let x = 0; x < width; x++) {
      let value = 0;
      let amplitude = 1;
      let frequency = baseFrequency;
      let maxValue = 0;
      
      // Multiple octaves for natural-looking terrain
      for (let octave = 0; octave < 4; octave++) {
        const sampleX = (x + octaveOffsets[octave].x) * frequency;
        const sampleY = (y + octaveOffsets[octave].y) * frequency;
        
        // Simple smooth noise using interpolated hash
        const noiseValue = smoothNoise(sampleX, sampleY);
        
        value += noiseValue * amplitude;
        maxValue += amplitude;
        
        amplitude *= 0.5;
        frequency *= 2;
      }
      
      // Normalize to 0-1
      value = (value / maxValue + 1) / 2;
      value = Math.max(0, Math.min(1, value));
      
      row.push(value);
    }
    
    noise.push(row);
  }
  
  return noise;
}

/**
 * Smooth noise function using bilinear interpolation
 */
function smoothNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  
  const fx = x - x0;
  const fy = y - y0;
  
  // Smoothstep interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  
  // Hash function for pseudo-random values
  const hash = (xi: number, yi: number) => {
    const n = xi + yi * 57;
    const h = (n * 8191) ^ (n * 251);
    return Math.sin(h) * 0.5 + 0.5;
  };
  
  // Bilinear interpolation of corner values
  const n00 = hash(x0, y0);
  const n10 = hash(x0 + 1, y0);
  const n01 = hash(x0, y0 + 1);
  const n11 = hash(x0 + 1, y0 + 1);
  
  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;
  
  return (nx0 * (1 - sy) + nx1 * sy) * 2 - 1;
}

/**
 * Seeded pseudo-random number generator (LCG)
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// Export terrain weights type for use in other modules
export type { TerrainWeights as MapTerrainWeights };
