import type { Command } from 'commander';
type ResolvedSkillSource = {
    content: string;
    source: string;
};
export declare function resolveSkillSource(skillName: string): ResolvedSkillSource;
export declare function registerSkillCommands(program: Command): void;
export {};
