import type { ConversationTargetKind } from './types.js';
export interface ParsedTargetName {
    fullName: string;
    rootName: string;
    forkName?: string;
    isRoot: boolean;
}
export declare function validateRootName(name: string): void;
export declare function validateForkName(name: string): void;
export declare function formatTargetName(rootName: string, forkName?: string): string;
export declare function parseTargetName(input: string): ParsedTargetName;
export declare function validateTargetName(input: string): void;
export declare function getTargetKind(forkName?: string): ConversationTargetKind;
