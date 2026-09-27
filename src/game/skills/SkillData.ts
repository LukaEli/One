export type PlayerStatValues = {
    damage: number;
    moveSpeed: number;
    fireRateMs: number;
    maxHealth: number;
    bulletSpeed: number;
    pickupRadius: number;
};

export type PlayerStatKey = keyof PlayerStatValues;

export type StatModifier = {
    additive?: Partial<PlayerStatValues>;
    multiplicative?: Partial<PlayerStatValues>;
};

export type SkillData = {
    id: string;
    name: string;
    description: string;
    modifiers: StatModifier;
};

export const SKILL_POOL: readonly SkillData[] = [
    {
        id: 'heavy-rounds',
        name: 'Heavy Rounds',
        description: '+1 damage per shot',
        modifiers: { additive: { damage: 1 } }
    },
    {
        id: 'quickdraw',
        name: 'Quickdraw',
        description: 'Fire 15% faster',
        modifiers: { multiplicative: { fireRateMs: 0.85 } }
    },
    {
        id: 'fleet-footed',
        name: 'Fleet-Footed',
        description: 'Move 12% faster',
        modifiers: { multiplicative: { moveSpeed: 1.12 } }
    },
    {
        id: 'vitality',
        name: 'Vitality',
        description: '+2 maximum health',
        modifiers: { additive: { maxHealth: 2 } }
    },
    {
        id: 'long-shot',
        name: 'Long Shot',
        description: 'Bullets travel 20% faster',
        modifiers: { multiplicative: { bulletSpeed: 1.2 } }
    },
    {
        id: 'magnetism',
        name: 'Magnetism',
        description: 'Collect pickups from farther away',
        modifiers: { additive: { pickupRadius: 60 } }
    }
];