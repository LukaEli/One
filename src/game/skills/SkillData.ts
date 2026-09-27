export type PlayerStatValues = {
    damage: number;
    moveSpeed: number;
    fireRateMs: number;
    maxHealth: number;
    bulletSpeed: number;
    pickupRadius: number;
    jumpVelocity: number;
    xpMultiplier: number;
    bulletRadius: number;
    roomHeal: number;
    damageReduction: number;
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
    },
    {
        id: 'spring-legs',
        name: 'Spring Legs',
        description: 'Jump 18% higher',
        modifiers: { multiplicative: { jumpVelocity: 1.18 } }
    },
    {
        id: 'scavenger',
        name: 'Scavenger',
        description: 'Gain 25% more battle XP',
        modifiers: { multiplicative: { xpMultiplier: 1.25 } }
    },
    {
        id: 'wide-shot',
        name: 'Wide Shot',
        description: 'Larger bullets are easier to land',
        modifiers: { additive: { bulletRadius: 2 } }
    },
    {
        id: 'room-rations',
        name: 'Room Rations',
        description: 'Restore 2 health when entering a room',
        modifiers: { additive: { roomHeal: 2 } }
    },
    {
        id: 'reinforced-skin',
        name: 'Reinforced Skin',
        description: 'Take 20% less damage',
        modifiers: { additive: { damageReduction: 0.2 } }
    },
    {
        id: 'power-core',
        name: 'Power Core',
        description: 'Deal 20% more damage',
        modifiers: { multiplicative: { damage: 1.2 } }
    }
];