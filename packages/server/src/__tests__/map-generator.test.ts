import { describe, it, expect } from '@jest/globals';
import { generateRandomMap, DEFAULT_TERRAIN_WEIGHTS } from '../game/map-generator';
import { TerrainType } from '@wallgame/shared';

describe('Map Generator', () => {
  describe('generateRandomMap', () => {
    it('should generate a map with correct dimensions', () => {
      const width = 100;
      const height = 100;
      const map = generateRandomMap(width, height);

      expect(map.dimensions.width).toBe(width);
      expect(map.dimensions.height).toBe(height);
      expect(map.terrain.length).toBe(height);
      expect(map.terrain[0].length).toBe(width);
    });

    it('should generate terrain for all tiles', () => {
      const width = 50;
      const height = 50;
      const map = generateRandomMap(width, height);

      // Check that every tile has a terrain type
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          expect(map.terrain[y][x]).toBeDefined();
          expect(Object.values(TerrainType)).toContain(map.terrain[y][x]);
        }
      }
    });

    it('should use seed for reproducible maps', () => {
      const seed = 12345;
      const map1 = generateRandomMap(100, 100, seed);
      const map2 = generateRandomMap(100, 100, seed);

      // Same seed should produce identical maps
      expect(map1.terrain).toEqual(map2.terrain);
    });

    it('should generate different maps with different seeds', () => {
      const map1 = generateRandomMap(100, 100, 12345);
      const map2 = generateRandomMap(100, 100, 67890);

      // Different seeds should produce different maps
      let differences = 0;
      for (let y = 0; y < 100; y++) {
        for (let x = 0; x < 100; x++) {
          if (map1.terrain[y][x] !== map2.terrain[y][x]) {
            differences++;
          }
        }
      }

      // Expect significant differences (>50%)
      expect(differences).toBeGreaterThan(5000);
    });

    it('should include multiple terrain types', () => {
      const map = generateRandomMap(200, 200);
      const terrainTypes = new Set<TerrainType>();

      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 200; x++) {
          terrainTypes.add(map.terrain[y][x]);
        }
      }

      // Should have at least 4 different terrain types
      expect(terrainTypes.size).toBeGreaterThanOrEqual(4);
    });

    it('should respect terrain weight of 0 (disabled terrain)', () => {
      const weights = {
        forest: 0,    // Disable forest
        hills: 50,
        mountain: 50,
        desert: 50,
        swamp: 50,
        water: 50
      };

      const map = generateRandomMap(200, 200, 12345, weights);
      
      // Count forest tiles
      let forestCount = 0;
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 200; x++) {
          if (map.terrain[y][x] === TerrainType.FOREST) {
            forestCount++;
          }
        }
      }

      expect(forestCount).toBe(0);
    });

    it('should increase terrain frequency with higher weights', () => {
      const lowWeight = generateRandomMap(200, 200, 12345, {
        forest: 25,   // Low frequency
        hills: 50,
        mountain: 50,
        desert: 50,
        swamp: 50,
        water: 50
      });

      const highWeight = generateRandomMap(200, 200, 12345, {
        forest: 100,  // High frequency
        hills: 50,
        mountain: 50,
        desert: 50,
        swamp: 50,
        water: 50
      });

      const countTerrain = (map: any, type: TerrainType) => {
        let count = 0;
        for (let y = 0; y < 200; y++) {
          for (let x = 0; x < 200; x++) {
            if (map.terrain[y][x] === type) count++;
          }
        }
        return count;
      };

      const lowForestCount = countTerrain(lowWeight, TerrainType.FOREST);
      const highForestCount = countTerrain(highWeight, TerrainType.FOREST);

      // Higher weight should produce more forest
      expect(highForestCount).toBeGreaterThan(lowForestCount);
    });

    it('should handle large maps (1000x2000)', () => {
      const startTime = Date.now();
      const map = generateRandomMap(1000, 2000);
      const duration = Date.now() - startTime;

      expect(map.dimensions.width).toBe(1000);
      expect(map.dimensions.height).toBe(2000);
      expect(map.terrain.length).toBe(2000);
      expect(map.terrain[0].length).toBe(1000);

      // Should complete in reasonable time (< 15 seconds for 2M tiles)
      expect(duration).toBeLessThan(15000);
    });

    it('should generate natural-looking terrain clusters', () => {
      const map = generateRandomMap(100, 100, 12345);

      // Check for terrain clustering (adjacent tiles often share terrain type)
      let adjacentMatches = 0;
      let totalChecks = 0;

      for (let y = 0; y < 99; y++) {
        for (let x = 0; x < 99; x++) {
          const current = map.terrain[y][x];
          const right = map.terrain[y][x + 1];
          const down = map.terrain[y + 1][x];

          if (current === right) adjacentMatches++;
          if (current === down) adjacentMatches++;
          totalChecks += 2;
        }
      }

      const clusteringRatio = adjacentMatches / totalChecks;
      
      // Natural terrain should have >30% adjacent similarity
      expect(clusteringRatio).toBeGreaterThan(0.3);
    });

    it('should generate water bodies (ocean/river)', () => {
      const map = generateRandomMap(200, 200);
      
      let waterCount = 0;
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 200; x++) {
          const terrain = map.terrain[y][x];
          if (terrain === TerrainType.OCEAN || terrain === TerrainType.RIVER) {
            waterCount++;
          }
        }
      }

      // Should have some water (at least 5% of map)
      expect(waterCount).toBeGreaterThan(2000);
    });

    it('should generate elevated terrain (mountains/hills)', () => {
      const map = generateRandomMap(200, 200);
      
      let elevatedCount = 0;
      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 200; x++) {
          const terrain = map.terrain[y][x];
          if (terrain === TerrainType.MOUNTAIN || terrain === TerrainType.HILLS) {
            elevatedCount++;
          }
        }
      }

      // Should have some elevated terrain (at least 10% of map)
      expect(elevatedCount).toBeGreaterThan(4000);
    });

    it('should use default weights when none provided', () => {
      const map1 = generateRandomMap(100, 100, 12345);
      const map2 = generateRandomMap(100, 100, 12345, DEFAULT_TERRAIN_WEIGHTS);

      // Should produce identical maps
      expect(map1.terrain).toEqual(map2.terrain);
    });

    it('should generate biome-appropriate terrain distributions', () => {
      const map = generateRandomMap(200, 200, 12345);
      
      const terrainCounts = {
        [TerrainType.PLAINS]: 0,
        [TerrainType.FOREST]: 0,
        [TerrainType.HILLS]: 0,
        [TerrainType.MOUNTAIN]: 0,
        [TerrainType.DESERT]: 0,
        [TerrainType.SWAMP]: 0,
        [TerrainType.RIVER]: 0,
        [TerrainType.OCEAN]: 0
      };

      for (let y = 0; y < 200; y++) {
        for (let x = 0; x < 200; x++) {
          terrainCounts[map.terrain[y][x]]++;
        }
      }

      // Plains should be most common (default terrain)
      expect(terrainCounts[TerrainType.PLAINS]).toBeGreaterThan(5000);
      
      // Mountains should exist but not dominate
      expect(terrainCounts[TerrainType.MOUNTAIN]).toBeGreaterThan(1000);
      expect(terrainCounts[TerrainType.MOUNTAIN]).toBeLessThan(10000);
      
      // Forest should be common (moderate moisture)
      expect(terrainCounts[TerrainType.FOREST]).toBeGreaterThan(1000);
    });

    it('should handle edge cases for map dimensions', () => {
      // Minimum viable map
      const smallMap = generateRandomMap(10, 10);
      expect(smallMap.terrain.length).toBe(10);
      expect(smallMap.terrain[0].length).toBe(10);

      // Non-square map
      const rectMap = generateRandomMap(50, 100);
      expect(rectMap.terrain.length).toBe(100);
      expect(rectMap.terrain[0].length).toBe(50);
    });

    it('should generate smooth transitions between terrain types', () => {
      const map = generateRandomMap(100, 100, 12345);
      
      // Count abrupt terrain changes (4+ different types in 3x3 area)
      let abruptChanges = 0;
      
      for (let y = 1; y < 99; y++) {
        for (let x = 1; x < 99; x++) {
          const neighbors = new Set<TerrainType>();
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              neighbors.add(map.terrain[y + dy][x + dx]);
            }
          }
          if (neighbors.size >= 4) abruptChanges++;
        }
      }

      // Should have smooth transitions (<20% abrupt changes)
      expect(abruptChanges / (98 * 98)).toBeLessThan(0.2);
    });
  });
});
