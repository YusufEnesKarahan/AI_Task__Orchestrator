import { PromptSection } from '../shared/aiTypes';
import { AIOSKnowledge, AIOSArchitectureMap } from '../../intelligence/shared/intelligenceTypes';

export class PromptSectionBuilder {
    
    public buildSystemRole(roleDescription: string): PromptSection {
        return {
            type: 'role',
            content: roleDescription,
            priority: 100
        };
    }

    public buildProjectContext(context: AIOSKnowledge): PromptSection {
        const content = `
Project Name: ${context.projectName}
Project Type: ${context.projectType}
Modules: ${context.modules.join(', ') || 'N/A'}
`;
        return {
            type: 'projectContext',
            content: content.trim(),
            priority: 90
        };
    }

    public buildArchitectureContext(context: AIOSArchitectureMap): PromptSection {
        const content = `
Architecture Layers:
${context.layers.map(l => `- ${l.name}: ${l.allowedDependencies.join(', ')}`).join('\n') || 'N/A'}

Key Entry Points:
${context.entryPoints.join(', ') || 'N/A'}
`;
        return {
            type: 'architectureContext',
            content: content.trim(),
            priority: 80
        };
    }

    public buildTaskContext(taskDescription: string): PromptSection {
        return {
            type: 'taskContext',
            content: `Task Description:\n${taskDescription}`,
            priority: 70
        };
    }

    public buildRules(rules: string[]): PromptSection {
        return {
            type: 'rules',
            content: `Rules:\n${rules.map(r => `- ${r}`).join('\n')}`,
            priority: 60
        };
    }

    public buildOutputFormat(formatInstructions: string): PromptSection {
        return {
            type: 'outputFormat',
            content: `Output Format:\n${formatInstructions}`,
            priority: 50
        };
    }
}
