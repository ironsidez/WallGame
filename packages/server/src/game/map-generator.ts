/**
 * Map Generator - Creates procedural terrain maps for WallGame
 * SERVER-SIDE ONLY - Maps generated once when game created, then stored in DB
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

import { TerrainType, TerrainWeights } from '@wallgame/shared';

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
 * 
 * Uses multi-octave Perlin-style noise for natural-looking terrain
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
  
  console.log(`🗺️  Generating ${width}×${height} map with noise-based terrain...`);
  const startTime = Date.now();
  
  // Generate elevation map (0-1 values) - controls mountains, hills, water
  const elevationMap = generateNoiseMap(width, height, random, 0.015);
  
  // Generate moisture map (0-1 values) - controls forests, deserts, swamps
  const moistureMap = generateNoiseMap(width, height, random, 0.02);
  
  // Generate temperature map (0-1 values) - adds variety to biomes
  const temperatureMap = generateNoiseMap(width, height, random, 0.01);
  
  // Convert noise to terrain using frequency weights
  for (let y = 0; y < height; y++) {
    const row: TerrainType[] = [];
    
    for (let x = 0; x < width; x++) {
      const elevation = elevationMap[y][x];
      const moisture = moistureMap[y][x];
      const temperature = temperatureMap[y][x];
      
      const terrainType = selectTerrain(elevation, moisture, temperature, weights, random);
      row.push(terrainType);
    }
    
    terrain.push(row);
  }
  
  const duration = Date.now() - startTime;
  console.log(`✅ Generated map in ${duration}ms`);
  
  return {
    dimensions: { width, height },
    terrain,
  };
}

/**
 * Convert frequency weights (0-200 scale) to spawn probabilities
 * 50 = standard (1x), 100 = 2x, 200 = 4x, 0 = disabled
 */
function frequencyToMultiplier(weight: number): number {
  if (weight === 0) return 0; // Completely disable terrain type
  return weight / 50; // 50 -> 1x, 100 -> 2x, 200 -> 4x
}

/**
 * Select terrain type based on elevation, moisture, temperature and frequency weights
 * Uses natural biome-like distribution for realistic terrain
 */
function selectTerrain(
  elevation: number,
  moisture: number,
  temperature: number,
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
  
  // WATER BODIES (elevation-based)
  // Ocean: very low elevation
  if (elevation < 0.20 * waterMult && weights.water > 0) {
    if (elevation < 0.10 * waterMult) {
      return TerrainType.OCEAN;
    }
    // River: shallow water, more common near coasts
    if (moisture > 0.4 || random() < 0.6) {
      return TerrainType.RIVER;
    }
    return TerrainType.OCEAN;
  }
  
  // MOUNTAINS (very high elevation)
  if (elevation > 0.85 && weights.mountain > 0) {
    const mountainThreshold = 0.85 - (0.10 * (mountainMult - 1));
    if (elevation > mountainThreshold) {
      return TerrainType.MOUNTAIN;
    }
  }
  
  // HILLS (high elevation, not quite mountain)
  if (elevation > 0.65 && weights.hills > 0) {
    const hillsThreshold = 0.65 - (0.10 * (hillsMult - 1));
    if (elevation > hillsThreshold) {
      // Occasionally blend with mountains for natural ridges
      if (elevation > 0.80 && random() < 0.15 * mountainMult && weights.mountain > 0) {
        return TerrainType.MOUNTAIN;
      }
      return TerrainType.HILLS;
    }
  }
  
  // BIOMES (moisture + temperature based)
  
  // SWAMP: low elevation + high moisture + moderate temperature
  if (elevation < 0.45 && moisture > 0.65 && temperature > 0.3 && temperature < 0.7 && weights.swamp > 0) {
    const swampChance = 0.4 * swampMult;
    if (random() < swampChance) {
      return TerrainType.SWAMP;
    }
  }
  
  // DESERT: low moisture + high temperature
  if (moisture < 0.30 && temperature > 0.55 && weights.desert > 0) {
    const desertChance = 0.5 * desertMult;
    if (random() < desertChance) {
      return TerrainType.DESERT;
    }
  }
  
  // FOREST: moderate-high moisture + moderate temperature
  if (moisture > 0.45 && temperature > 0.35 && temperature < 0.80 && weights.forest > 0) {
    // Dense forest at very high moisture
    if (moisture > 0.70) {
      const denseForestChance = 0.70 * forestMult;
      if (random() < denseForestChance) {
        return TerrainType.FOREST;
      }
    }
    // Regular forest at moderate moisture
    const forestChance = 0.45 * forestMult;
    if (random() < forestChance) {
      return TerrainType.FOREST;
    }
  }
  
  // DEFAULT: Plains (most versatile terrain)
  return TerrainType.PLAINS;
}

/**
 * Generate a 2D noise map using improved multi-octave Perlin-style noise
 * 
 * @param width - Map width
 * @param height - Map height  
 * @param random - Seeded random function
 * @param baseFrequency - Controls terrain feature size (lower = larger features)
 * @returns 2D array of noise values (0-1 range)
 */
function generateNoiseMap(
  width: number, 
  height: number, 
  random: () => number,
  baseFrequency: number = 0.015
): number[][] {
  const noise: number[][] = [];
  
  // Pre-generate random offsets for each octave (for variety)
  const octaveCount = 5; // More octaves = more detail
  const octaveOffsets: { x: number; y: number }[] = [];
  for (let i = 0; i < octaveCount; i++) {
    octaveOffsets.push({
      x: random() * 10000 - 5000,
      y: random() * 10000 - 5000
    });
  }
  
  let maxNoiseHeight = 0;
  let minNoiseHeight = Number.MAX_VALUE;
  
  // First pass: generate raw noise values
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    
    for (let x = 0; x < width; x++) {
      let amplitude = 1;
      let frequency = baseFrequency;
      let noiseValue = 0;
      
      // Combine multiple octaves for natural-looking terrain
      for (let octave = 0; octave < octaveCount; octave++) {
        const sampleX = (x + octaveOffsets[octave].x) * frequency;
        const sampleY = (y + octaveOffsets[octave].y) * frequency;
        
        // Perlin-style smooth noise
        const noise = perlinNoise(sampleX, sampleY);
        
        noiseValue += noise * amplitude;
        
        amplitude *= 0.5; // Each octave contributes less
        frequency *= 2.0; // Each octave has finer detail
      }
      
      maxNoiseHeight = Math.max(maxNoiseHeight, noiseValue);
      minNoiseHeight = Math.min(minNoiseHeight, noiseValue);
      
      row.push(noiseValue);
    }
    
    noise.push(row);
  }
  
  // Second pass: normalize to 0-1 range
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Normalize and apply slight contrast curve for better distribution
      let normalized = (noise[y][x] - minNoiseHeight) / (maxNoiseHeight - minNoiseHeight);
      
      // Apply subtle S-curve for better contrast (more varied terrain)
      normalized = normalized * normalized * (3 - 2 * normalized); // Smoothstep
      
      noise[y][x] = Math.max(0, Math.min(1, normalized));
    }
  }
  
  return noise;
}

/**
 * Perlin-style noise function using bicubic interpolation
 * Returns value in range approximately [-1, 1]
 */
function perlinNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  
  const fx = x - x0;
  const fy = y - y0;
  
  // Smoothstep interpolation (smoother than linear)
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  
  // Gradient vectors at grid corners (pseudo-random but consistent)
  const grad = (xi: number, yi: number, xf: number, yf: number) => {
    const hash = ((xi * 374761393) ^ (yi * 668265263)) | 0;
    const h = hash & 3;
    
    // Convert hash to gradient direction
    const u = h < 2 ? xf : yf;
    const v = h < 2 ? yf : xf;
    
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  };
  
  // Get gradients at four corners
  const n00 = grad(x0, y0, fx, fy);
  const n10 = grad(x0 + 1, y0, fx - 1, fy);
  const n01 = grad(x0, y0 + 1, fx, fy - 1);
  const n11 = grad(x0 + 1, y0 + 1, fx - 1, fy - 1);
  
  // Bilinear interpolation
  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;
  
  return nx0 * (1 - sy) + nx1 * sy;
}

/**
 * Seeded pseudo-random number generator (LCG)
 * Returns consistent random values for a given seed
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}
