import { StructureTemplate, StructureType, EffectType, Position } from './types';

/**
 * Pre-defined structure templates with Tetris-like shapes
 */

export const STRUCTURE_TEMPLATES: Record<StructureType, StructureTemplate[]> = {
  [StructureType.BASIC]: [
    {
      type: StructureType.BASIC,
      name: 'Block',
      baseValue: 10,
      baseCost: 5,
      baseHealth: 50,
      shape: [{ x: 0, y: 0 }],
      effects: [],
      description: 'Simple single-cell structure'
    },
    {
      type: StructureType.BASIC,
      name: 'Line',
      baseValue: 25,
      baseCost: 15,
      baseHealth: 80,
      shape: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 }
      ],
      effects: [],
      description: 'Linear 3-cell structure'
    },
    {
      type: StructureType.BASIC,
      name: 'L-Shape',
      baseValue: 40,
      baseCost: 25,
      baseHealth: 120,
      shape: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 }
      ],
      effects: [],
      description: 'L-shaped 4-cell structure'
    },
    {
      type: StructureType.BASIC,
      name: 'Square',
      baseValue: 35,
      baseCost: 20,
      baseHealth: 100,
      shape: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 }
      ],
      effects: [],
      description: '2x2 square structure'
    }
  ],

  [StructureType.GENERATOR]: [
    {
      type: StructureType.GENERATOR,
      name: 'Resource Node',
      baseValue: 15,
      baseCost: 30,
      baseHealth: 60,
      shape: [{ x: 0, y: 0 }],
      effects: [
        {
          type: EffectType.RESOURCE_GENERATION,
          value: 2,
          radius: 0
        }
      ],
      description: 'Generates 2 resources per turn'
    },
    {
      type: StructureType.GENERATOR,
      name: 'Power Plant',
      baseValue: 30,
      baseCost: 75,
      baseHealth: 150,
      shape: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
        { x: 2, y: 1 }
      ],
      effects: [
        {
          type: EffectType.RESOURCE_GENERATION,
          value: 5,
          radius: 0
        }
      ],
      description: 'Large generator producing 5 resources per turn'
    }
  ],

  [StructureType.FORTRESS]: [
    {
      type: StructureType.FORTRESS,
      name: 'Bunker',
      baseValue: 50,
      baseCost: 40,
      baseHealth: 200,
      shape: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ],
      effects: [
        {
          type: EffectType.DEFENSE_BOOST,
          value: 20,
          radius: 0
        }
      ],
      description: 'High-value defensive structure'
    },
    {
      type: StructureType.FORTRESS,
      name: 'Castle',
      baseValue: 100,
      baseCost: 120,
      baseHealth: 400,
      shape: [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 }
      ],
      effects: [
        {
          type: EffectType.DEFENSE_BOOST,
          value: 50,
          radius: 0
        },
        {
          type: EffectType.VISION_RANGE,
          value: 5,
          radius: 5
        }
      ],
      description: 'Massive defensive structure with vision'
    }
  ],

  [StructureType.AMPLIFIER]: [
    {
      type: StructureType.AMPLIFIER,
      name: 'Beacon',
      baseValue: 20,
      baseCost: 35,
      baseHealth: 80,
      shape: [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ],
      effects: [
        {
          type: EffectType.ATTACK_BOOST,
          value: 15,
          radius: 3
        }
      ],
      description: 'Boosts nearby friendly structure values by 15'
    },
    {
      type: StructureType.AMPLIFIER,
      name: 'Command Center',
      baseValue: 40,
      baseCost: 80,
      baseHealth: 160,
      shape: [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 1, y: 2 }
      ],
      effects: [
        {
          type: EffectType.ATTACK_BOOST,
          value: 25,
          radius: 4
        },
        {
          type: EffectType.DEFENSE_BOOST,
          value: 10,
          radius: 2
        }
      ],
      description: 'Major amplifier providing attack and defense bonuses'
    }
  ],

  [StructureType.SCOUT]: [
    {
      type: StructureType.SCOUT,
      name: 'Watchtower',
      baseValue: 8,
      baseCost: 25,
      baseHealth: 40,
      shape: [{ x: 0, y: 0 }],
      effects: [
        {
          type: EffectType.VISION_RANGE,
          value: 4,
          radius: 4
        }
      ],
      description: 'Reveals fog of war in a 4-cell radius'
    },
    {
      type: StructureType.SCOUT,
      name: 'Radar Array',
      baseValue: 15,
      baseCost: 60,
      baseHealth: 70,
      shape: [
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 1 }
      ],
      effects: [
        {
          type: EffectType.VISION_RANGE,
          value: 8,
          radius: 8
        }
      ],
      description: 'Advanced scouting structure with long-range vision'
    }
  ],

  [StructureType.SABOTEUR]: [
    {
      type: StructureType.SABOTEUR,
      name: 'Virus Pod',
      baseValue: 12,
      baseCost: 45,
      baseHealth: 30,
      shape: [{ x: 0, y: 0 }],
      effects: [
        {
          type: EffectType.AREA_DAMAGE,
          value: -5,
          radius: 2,
          duration: 10
        }
      ],
      description: 'Weakens nearby enemy structures by 5 for 10 turns'
    },
    {
      type: StructureType.SABOTEUR,
      name: 'EMP Field',
      baseValue: 20,
      baseCost: 90,
      baseHealth: 50,
      shape: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 }
      ],
      effects: [
        {
          type: EffectType.AREA_DAMAGE,
          value: -10,
          radius: 3,
          duration: 15
        }
      ],
      description: 'Creates an electromagnetic field that disrupts enemy structures'
    }
  ]
};

/**
 * Get all templates for a specific structure type
 */
export function getTemplatesForType(type: StructureType): StructureTemplate[] {
  return STRUCTURE_TEMPLATES[type] || [];
}

/**
 * Get a specific template by type and name
 */
export function getTemplate(type: StructureType, name: string): StructureTemplate | undefined {
  return STRUCTURE_TEMPLATES[type]?.find(template => template.name === name);
}

/**
 * Get all available structure templates
 */
export function getAllTemplates(): StructureTemplate[] {
  return Object.values(STRUCTURE_TEMPLATES).flat();
}

/**
 * Rotate a structure shape by 90 degrees clockwise
 */
export function rotateShape(shape: Position[], rotations: number = 1): Position[] {
  let result = [...shape];
  
  for (let i = 0; i < rotations % 4; i++) {
    result = result.map(pos => ({
      x: -pos.y,
      y: pos.x
    }));
  }
  
  // Normalize to ensure all coordinates are non-negative
  const minX = Math.min(...result.map(pos => pos.x));
  const minY = Math.min(...result.map(pos => pos.y));
  
  return result.map(pos => ({
    x: pos.x - minX,
    y: pos.y - minY
  }));
}

/**
 * Get all possible rotations of a structure template
 */
export function getAllRotations(template: StructureTemplate): StructureTemplate[] {
  const rotations: StructureTemplate[] = [];
  
  for (let i = 0; i < 4; i++) {
    rotations.push({
      ...template,
      name: `${template.name} (${i * 90}°)`,
      shape: rotateShape(template.shape, i)
    });
  }
  
  return rotations;
}

/**
 * Calculate the bounding box of a structure shape
 */
export function getShapeBounds(shape: Position[]): { width: number; height: number } {
  if (shape.length === 0) return { width: 0, height: 0 };
  
  const minX = Math.min(...shape.map(pos => pos.x));
  const maxX = Math.max(...shape.map(pos => pos.x));
  const minY = Math.min(...shape.map(pos => pos.y));
  const maxY = Math.max(...shape.map(pos => pos.y));
  
  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}
