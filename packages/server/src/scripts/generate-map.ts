#!/usr/bin/env node

/**
 * Map Generator CLI Tool
 * 
 * Usage:
 *   npm run generate-map -- --width 50 --height 50 --output maps/default.map
 *   npm run generate-map -- --test
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateRandomMap, createTestMap, encodeMapFile } from '@wallgame/shared';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const options: Record<string, string> = {};
const flags: Set<string> = new Set();

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const nextArg = args[i + 1];
    
    // Check if next arg is a value or another flag
    if (nextArg && !nextArg.startsWith('--')) {
      options[key] = nextArg;
      i++; // Skip next arg since we used it as value
    } else {
      // It's a boolean flag
      flags.add(key);
    }
  }
}

// Generate map based on options
let mapData;
let outputPath: string;

if (flags.has('test')) {
  console.log('🎮 Generating test map...');
  mapData = createTestMap();
  outputPath = path.join(__dirname, '../../maps/test.map');
} else {
  const width = parseInt(options.width || '50');
  const height = parseInt(options.height || '50');
  const seed = options.seed ? parseInt(options.seed) : Date.now();
  
  console.log(`🌍 Generating ${width}x${height} random map (seed: ${seed})...`);
  mapData = generateRandomMap(width, height, seed);
  
  outputPath = options.output 
    ? path.join(__dirname, '../..', options.output)
    : path.join(__dirname, `../../maps/map_${width}x${height}_${seed}.map`);
}

// Encode map to string
const mapContent = encodeMapFile(mapData);

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write to file
fs.writeFileSync(outputPath, mapContent, 'utf-8');

console.log(`✅ Map generated successfully!`);
console.log(`   Dimensions: ${mapData.dimensions.width}x${mapData.dimensions.height}`);
console.log(`   File: ${outputPath}`);
console.log(`   Size: ${mapContent.length} bytes`);

// Display terrain distribution
const terrainCounts: Record<string, number> = {};
for (const row of mapData.terrain) {
  for (const terrain of row) {
    terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
  }
}

console.log('\n📊 Terrain Distribution:');
for (const [terrain, count] of Object.entries(terrainCounts)) {
  const percentage = ((count / (mapData.dimensions.width * mapData.dimensions.height)) * 100).toFixed(1);
  console.log(`   ${terrain}: ${count} (${percentage}%)`);
}

console.log('\n💡 Preview (first 10 rows):');
const preview = mapContent.split('\n').slice(0, 11).join('\n');
console.log(preview);
