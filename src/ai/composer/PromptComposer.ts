import { AIChatMessage, PromptSection } from '../shared/aiTypes';
import { PromptOptimizer } from './PromptOptimizer';

export class PromptComposer {
    private sections: PromptSection[] = [];
    private optimizer: PromptOptimizer;

    constructor() {
        this.optimizer = new PromptOptimizer();
    }

    public addSection(section: PromptSection): this {
        this.sections.push(section);
        return this;
    }

    public addSections(sections: PromptSection[]): this {
        this.sections.push(...sections);
        return this;
    }

    public composeString(): string {
        // Sort by priority descending (highest priority first)
        const sortedSections = [...this.sections].sort((a, b) => b.priority - a.priority);
        
        let combined = sortedSections
            .map(section => `--- ${section.type.toUpperCase()} ---\n${section.content}`)
            .join('\n\n');

        return this.optimizer.optimize(combined);
    }

    public composeMessages(): AIChatMessage[] {
        const systemPrompt = this.composeString();
        
        // Bu aşamada tamamı system mesajı gibi gönderilebilir
        // veya kullanıcı promptu ayrı bir mesaja bölünebilir.
        return [
            {
                role: 'system',
                content: systemPrompt
            }
        ];
    }
}
