import { PromptRun, Task, TaskType } from '../types';
import { PROMPT_TEMPLATES, PromptTemplateDefinition } from './templates/PromptTemplates';

export interface GeneratedPrompt {
    templateId: string;
    templateName: string;
    systemPrompt: string;
    userPrompt: string;
}

export class PromptGenerator {
    public generate(task: Task, contextCode?: string): GeneratedPrompt {
        const template = this.getTemplate(task.type);
        const userPrompt = template.buildUserPrompt({ task, contextCode });

        return {
            templateId: template.id,
            templateName: template.name,
            systemPrompt: template.systemPrompt,
            userPrompt
        };
    }

    public createPromptRunRecord(task: Task, generatedPrompt: GeneratedPrompt, response?: string): PromptRun {
        return {
            id: `prun_${Date.now()}`,
            taskId: task.id,
            promptTemplateId: generatedPrompt.templateId,
            requestPayload: generatedPrompt.userPrompt,
            responsePayload: response,
            createdAt: Date.now()
        };
    }

    private getTemplate(taskType?: TaskType): PromptTemplateDefinition {
        const resolvedType = taskType || 'code_generation';
        const template = PROMPT_TEMPLATES[resolvedType];

        if (!template) {
            throw new Error(`Unknown task type: ${resolvedType}`);
        }

        return template;
    }
}
