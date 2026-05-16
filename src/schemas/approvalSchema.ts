import { z } from 'zod';
import { actionTypeSchema } from './actionSchema';

export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export const approvalSeveritySchema = z.enum(['low', 'medium', 'high']);

export const approvalRequestSchema = z.object({
    id: z.string().trim().min(1),
    actionId: z.string().trim().min(1),
    taskId: z.string().trim().min(1),
    status: approvalStatusSchema,
    reason: z.string().trim().min(1),
    severity: approvalSeveritySchema,
    actionType: actionTypeSchema.optional(),
    actionSummary: z.string().trim().min(1).optional(),
    riskTags: z.array(z.string().trim().min(1)).optional(),
    requestedAt: z.number().int().nonnegative(),
    respondedAt: z.number().int().nonnegative().optional()
}).strict();

export type ApprovalRequestInput = z.infer<typeof approvalRequestSchema>;
