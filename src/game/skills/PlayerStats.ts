import { PlayerStatKey, PlayerStatValues, SkillData } from './SkillData';

const STAT_KEYS: PlayerStatKey[] = [
    'damage',
    'moveSpeed',
    'fireRateMs',
    'maxHealth',
    'bulletSpeed',
    'pickupRadius'
];

export class PlayerStats
{
    readonly stats: PlayerStatValues;
    private readonly baseStats: PlayerStatValues;
    private readonly activeSkills: SkillData[] = [];

    constructor (baseStats: PlayerStatValues)
    {
        this.baseStats = { ...baseStats };
        this.stats = { ...baseStats };
    }

    addSkill (skill: SkillData): void
    {
        this.activeSkills.push(skill);
        this.recalculate();
    }

    private recalculate (): void
    {
        const additive: PlayerStatValues = {
            damage: 0,
            moveSpeed: 0,
            fireRateMs: 0,
            maxHealth: 0,
            bulletSpeed: 0,
            pickupRadius: 0
        };
        const multiplicative: PlayerStatValues = {
            damage: 1,
            moveSpeed: 1,
            fireRateMs: 1,
            maxHealth: 1,
            bulletSpeed: 1,
            pickupRadius: 1
        };

        for (const skill of this.activeSkills) {
            for (const key of STAT_KEYS) {
                additive[key] += skill.modifiers.additive?.[key] ?? 0;
                multiplicative[key] *= skill.modifiers.multiplicative?.[key] ?? 1;
            }
        }

        for (const key of STAT_KEYS) {
            this.stats[key] = (this.baseStats[key] + additive[key]) * multiplicative[key];
        }
    }
}