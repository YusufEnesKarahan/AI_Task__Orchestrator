import { BaseAgent } from '../core/BaseAgent';
import { AgentRunInput, AgentRunResult } from '../core/IAgent';
import { ContextPackage } from '../../context/types';
import { PromptComposer } from '../../ai/composer/PromptComposer';
import { PromptSectionBuilder } from '../../ai/composer/PromptSectionBuilder';
import { PromptValidator } from '../../ai/composer/PromptValidator';
import { ReasoningResult } from '../../reasoning/shared/reasoningTypes';

export class PromptEngineerAgent extends BaseAgent {
    private readonly sectionBuilder = new PromptSectionBuilder();
    private readonly validator = new PromptValidator();

    constructor(workspaceRoot: string) {
        super('prompt_engineer_agent', 'prompt_engineer', workspaceRoot);
    }

    protected async execute(input: AgentRunInput, context: ContextPackage): Promise<AgentRunResult> {
        const reasoningResult: ReasoningResult = input.inputs?.reasoningResult;
        
        if (!reasoningResult) {
            return {
                success: false,
                output: 'No reasoning results provided for prompt engineering.',
                errors: ['Missing input: reasoningResult']
            };
        }

        try {
            const composer = new PromptComposer();

            // 1. Sistem rolünü ekle
            composer.addSection(this.sectionBuilder.buildSystemRole(
                'You are an expert software engineer assistant designed to execute plans precisely.'
            ));

            // 2. Reasoning bağlamını ekle
            composer.addSection(this.sectionBuilder.buildReasoningContext(reasoningResult));

            // 3. Kuralları ekle
            if (context.rules && context.rules.length > 0) {
                composer.addSection(this.sectionBuilder.buildRules(context.rules));
            }

            // 4. Çıktı format kurallarını ekle
            composer.addSection(this.sectionBuilder.buildOutputFormat(
                'Provide clean code implementation or report matching each plan step. No unnecessary explanation.'
            ));

            // 5. Prompt birleştir
            const finalPrompt = composer.composeString();
            const messages = composer.composeMessages();

            // 6. Token sınırını doğrula
            const modelId = input.inputs?.modelId || 'mock-model';
            const isValid = this.validator.validate(modelId, messages);

            return {
                success: true,
                output: 'Prompt successfully composed and optimized.',
                data: {
                    composedPrompt: finalPrompt,
                    chatMessages: messages,
                    tokenValidationPassed: isValid
                }
            };
        } catch (error: any) {
            return {
                success: false,
                output: '',
                errors: [error?.message || String(error)]
            };
        }
    }
}
