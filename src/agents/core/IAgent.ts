import { AgentProfile } from '../../context/types';

export interface AgentRunInput {
    taskDescription: string;
    inputs?: Record<string, any>;
    contextId?: string;
    forceRefreshContext?: boolean;
}

export interface AgentRunResult {
    success: boolean;
    output: string;
    data?: Record<string, any>;
    errors?: string[];
}

export interface IAgent {
    readonly id: string;
    readonly profile: AgentProfile;
    run(input: AgentRunInput): Promise<AgentRunResult>;
}
