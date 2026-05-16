import { z } from 'zod';

export const validationRuleTypeSchema = z.enum([
    'file_exists',
    'content_match',
    'output_exists',
    'string_match',
    'pattern_match',
    'build_check',
    'lint_check',
    'test_run'
]);

export const validationRuleConfigSchema = z.object({
    type: validationRuleTypeSchema,
    target: z.string().trim().min(1).optional(),
    expected: z.string().optional(),
    pattern: z.string().optional(),
    output: z.string().optional()
}).strict();

export const validationConfigSchema = z.object({
    taskId: z.string().trim().min(1).optional(),
    rules: z.array(validationRuleConfigSchema).default([])
}).strict();

export type ValidationConfig = z.infer<typeof validationConfigSchema>;
