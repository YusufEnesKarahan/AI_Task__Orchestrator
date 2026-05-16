import { z } from 'zod';

export const taskPlanPrioritySchema = z.enum(['high', 'medium', 'low']);

export const taskPlanTypeSchema = z.enum([
    'code_generation',
    'refactor',
    'bug_fix',
    'test_generation',
    'documentation',
    'code_review'
]);

export const taskPlanItemSchema = z
    .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1),
        type: taskPlanTypeSchema.optional(),
        priority: taskPlanPrioritySchema,
        dependencies: z.array(z.number().int().nonnegative()).default([]),
        expectedOutput: z.string().trim().min(1)
    })
    .strict();

export const taskPlanOutputSchema = z.array(taskPlanItemSchema).min(1);

export type TaskPlanOutput = z.infer<typeof taskPlanOutputSchema>;
