import * as fs from 'fs/promises';
import * as path from 'path';
import {
    Task,
    TaskType,
    ValidationResult,
    ValidationRuleResult,
    ValidationStatus
} from '../types';

export type ValidationRuleType =
    | 'file_exists'
    | 'content_match'
    | 'output_exists'
    | 'string_match'
    | 'pattern_match'
    | 'build_check'
    | 'lint_check'
    | 'test_run';

export interface ValidationRule {
    type: ValidationRuleType;
    target?: string;
    expected?: string;
    pattern?: string;
    output?: string;
}

export interface ValidationCheckResult {
    status: ValidationStatus;
    message?: string;
}

export interface ValidationExecutionSummary {
    taskId: string;
    status: ValidationStatus;
    executedRules: ValidationRule[];
    ruleResults: ValidationRuleResult[];
    errors: string[];
}

export interface ValidationFailureRecommendation {
    nextStatus: 'error' | 'pending';
    shouldRetry: boolean;
    message: string;
}

export interface Validator {
    validate(rule: ValidationRule): Promise<ValidationCheckResult>;
}

abstract class BaseValidator implements Validator {
    constructor(protected readonly workspaceRoot: string) {}

    protected resolvePath(relativePath: string): string {
        return path.resolve(this.workspaceRoot, relativePath);
    }

    protected getTarget(rule: ValidationRule): string | undefined {
        return rule.target?.trim();
    }

    abstract validate(rule: ValidationRule): Promise<ValidationCheckResult>;
}

class FileExistsValidator extends BaseValidator {
    public async validate(rule: ValidationRule): Promise<ValidationCheckResult> {
        const target = this.getTarget(rule);

        if (!target) {
            return {
                status: 'not_applicable',
                message: 'file_exists doğrulaması için hedef dosya belirtilmedi.'
            };
        }

        try {
            await fs.access(this.resolvePath(target));
            return { status: 'success' };
        } catch {
            return {
                status: 'failed',
                message: `Beklenen dosya bulunamadı: ${target}`
            };
        }
    }
}

class ContentMatchValidator extends BaseValidator {
    public async validate(rule: ValidationRule): Promise<ValidationCheckResult> {
        const target = this.getTarget(rule);
        const expected = rule.expected?.trim();

        if (!target || !expected) {
            return {
                status: 'not_applicable',
                message: 'content_match doğrulaması için target ve expected alanları gerekli.'
            };
        }

        try {
            const content = await fs.readFile(this.resolvePath(target), 'utf8');

            if (!content.includes(expected)) {
                return {
                    status: 'failed',
                    message: `'${target}' dosyası beklenen içeriği barındırmıyor: ${expected}`
                };
            }

            return { status: 'success' };
        } catch {
            return {
                status: 'failed',
                message: `İçerik doğrulaması için dosya okunamadı: ${target}`
            };
        }
    }
}

class StringMatchValidator implements Validator {
    public async validate(rule: ValidationRule): Promise<ValidationCheckResult> {
        const output = rule.output?.trim();
        const expected = rule.expected?.trim();

        if (!output || !expected) {
            return {
                status: 'not_applicable',
                message: 'string_match doğrulaması için output ve expected alanları gerekli.'
            };
        }

        return output.includes(expected)
            ? { status: 'success' }
            : { status: 'failed', message: `Beklenen çıktı bulunamadı: ${expected}` };
    }
}

class PatternMatchValidator implements Validator {
    public async validate(rule: ValidationRule): Promise<ValidationCheckResult> {
        const output = rule.output?.trim();
        const pattern = rule.pattern?.trim();

        if (!output || !pattern) {
            return {
                status: 'not_applicable',
                message: 'pattern_match doğrulaması için output ve pattern alanları gerekli.'
            };
        }

        const expression = new RegExp(pattern, 'm');

        return expression.test(output)
            ? { status: 'success' }
            : { status: 'failed', message: `Çıktı beklenen pattern ile eşleşmiyor: ${pattern}` };
    }
}

class OutputExistsValidator implements Validator {
    public async validate(rule: ValidationRule): Promise<ValidationCheckResult> {
        if (rule.output === undefined) {
            return {
                status: 'not_applicable',
                message: 'output_exists doğrulaması için output alanı sağlanmadı.'
            };
        }

        return rule.output.trim()
            ? { status: 'success' }
            : { status: 'failed', message: 'Beklenen task çıktısı üretildi ancak boş döndü.' };
    }
}

class DeferredValidator implements Validator {
    public async validate(rule: ValidationRule): Promise<ValidationCheckResult> {
        return {
            status: 'skipped',
            message: `'${rule.type}' doğrulaması tasarımda mevcut ancak henüz aktif değil.`
        };
    }
}

export class ValidationEngine {
    private readonly validators: Record<ValidationRuleType, Validator>;

    constructor(private readonly workspaceRoot: string) {
        const fileExistsValidator = new FileExistsValidator(workspaceRoot);
        const contentMatchValidator = new ContentMatchValidator(workspaceRoot);
        const deferredValidator = new DeferredValidator();

        this.validators = {
            file_exists: fileExistsValidator,
            content_match: contentMatchValidator,
            output_exists: new OutputExistsValidator(),
            string_match: new StringMatchValidator(),
            pattern_match: new PatternMatchValidator(),
            build_check: deferredValidator,
            lint_check: deferredValidator,
            test_run: deferredValidator
        };
    }

    public async validateTask(task: Task, rules: ValidationRule[]): Promise<ValidationResult> {
        const summary = await this.runValidation(task, rules);

        return {
            taskId: task.id,
            status: summary.status,
            summary: this.buildSummaryMessage(summary),
            errors: summary.errors.length > 0 ? summary.errors : undefined,
            ruleResults: summary.ruleResults,
            validatedAt: Date.now()
        };
    }

    public async runValidation(task: Task, rules: ValidationRule[]): Promise<ValidationExecutionSummary> {
        const finalRules = this.selectRulesForTask(task, rules);
        const ruleResults: ValidationRuleResult[] = [];
        const errors: string[] = [];

        for (const rule of finalRules) {
            const validator = this.validators[rule.type];

            if (!validator) {
                const message = `Bilinmeyen doğrulama kuralı: ${rule.type}`;
                ruleResults.push({
                    ruleType: rule.type,
                    status: 'skipped',
                    message,
                    target: rule.target
                });
                continue;
            }

            const result = await validator.validate(rule);
            ruleResults.push({
                ruleType: rule.type,
                status: result.status,
                message: result.message,
                target: rule.target
            });

            if (result.status === 'failed' && result.message) {
                errors.push(result.message);
            }
        }

        return {
            taskId: task.id,
            status: this.aggregateStatus(ruleResults),
            executedRules: finalRules,
            ruleResults,
            errors
        };
    }

    public getFailureRecommendation(summary: ValidationExecutionSummary): ValidationFailureRecommendation {
        if (summary.status === 'failed') {
            return {
                nextStatus: 'error',
                shouldRetry: true,
                message: 'Doğrulama gerçekten başarısız oldu. Görev tekrar denenmeli veya kullanıcıya düzeltme için geri verilmeli.'
            };
        }

        return {
            nextStatus: 'pending',
            shouldRetry: false,
            message: 'Doğrulama atlandı veya uygulanabilir değildi. Manuel inceleme ya da ileride aktif validator gerekir.'
        };
    }

    private selectRulesForTask(task: Task, rules: ValidationRule[]): ValidationRule[] {
        const selectedRules = [...rules];

        switch (task.type) {
            case 'code_generation':
            case 'refactor':
            case 'bug_fix':
                this.pushRuleIfMissing(selectedRules, { type: 'build_check' });
                break;
            case 'test_generation':
                this.pushRuleIfMissing(selectedRules, { type: 'test_run' });
                break;
            case 'documentation':
            case 'code_review':
            default:
                break;
        }

        return selectedRules;
    }

    private pushRuleIfMissing(rules: ValidationRule[], rule: ValidationRule): void {
        if (!rules.some(item => item.type === rule.type)) {
            rules.push(rule);
        }
    }

    private aggregateStatus(ruleResults: ValidationRuleResult[]): ValidationStatus {
        if (ruleResults.length === 0) {
            return 'not_applicable';
        }

        if (ruleResults.some(result => result.status === 'failed')) {
            return 'failed';
        }

        if (ruleResults.some(result => result.status === 'success')) {
            return 'success';
        }

        if (ruleResults.some(result => result.status === 'skipped')) {
            return 'skipped';
        }

        return 'not_applicable';
    }

    private buildSummaryMessage(summary: ValidationExecutionSummary): string {
        switch (summary.status) {
            case 'success':
                return 'Doğrulama başarılı.';
            case 'failed':
                return 'Doğrulama başarısız oldu.';
            case 'skipped':
                return 'Doğrulama kuralları atlandı; henüz aktif olmayan kontroller var.';
            case 'not_applicable':
                return 'Bu görev için uygulanabilir doğrulama bulunamadı.';
            default:
                return 'Doğrulama tamamlandı.';
        }
    }
}
