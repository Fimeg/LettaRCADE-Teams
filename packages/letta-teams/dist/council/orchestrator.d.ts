export declare function generateCouncilSessionId(): string;
export declare function runCouncilSession(input: {
    prompt: string;
    message?: string;
    participantNames?: string[];
    maxTurns?: number;
    sessionId?: string;
}): Promise<{
    sessionId: string;
}>;
