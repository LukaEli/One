import { SKILL_POOL, SkillData } from './SkillData';

export class SkillManager
{
    bankedPicks = 0;
    private offeredSkills: SkillData[] = [];

    bankPick (): void
    {
        this.bankedPicks += 1;
    }

    onLevelUp (): SkillData[]
    {
        if (this.bankedPicks === 0) {
            return [];
        }

        this.offeredSkills = [...SKILL_POOL]
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);
        return [...this.offeredSkills];
    }

    chooseSkill (skillId: string): SkillData | undefined
    {
        const selectedSkill = this.offeredSkills.find((skill) => skill.id === skillId);
        if (!selectedSkill || this.bankedPicks === 0) {
            return undefined;
        }

        this.bankedPicks -= 1;
        this.offeredSkills = [];
        return selectedSkill;
    }
}