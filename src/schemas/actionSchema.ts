import { z } from 'zod';

export const actionTypeSchema = z.enum([
    'read_file',
    'write_file',
    'append_file',
    'open_file',
    'list_files',
    'search_in_project',
    'run_terminal_command',
    'apply_diff',
    'create_file',
    'delete_file'
]);

const actionBaseSchema = {
    id: z.string().trim().min(1)
};

export const actionInputSchema = z.discriminatedUnion('type', [
    z.object({
        ...actionBaseSchema,
        type: z.literal('read_file'),
        payload: z.object({
            path: z.string().trim().min(1)
        }).strict()
    }).strict(),
    z.object({
        ...actionBaseSchema,
        type: z.literal('write_file'),
        payload: z.object({
            path: z.string().trim().min(1),
            content: z.string()
        }).strict()
    }).strict(),
    z.object({
        ...actionBaseSchema,
        type: z.literal('append_file'),
        payload: z.object({
            path: z.string().trim().min(1),
            content: z.string()
        }).strict()
    }).strict(),
    z.object({
        ...actionBaseSchema,
        type: z.literal('open_file'),
        payload: z.object({
            path: z.string().trim().min(1)
        }).strict()
    }).strict(),
    z.object({
        ...actionBaseSchema,
        type: z.literal('list_files'),
        payload: z.object({
            directory: z.string().trim().min(1).optional()
        }).strict()
    }).strict(),
    z.object({
        ...actionBaseSchema,
        type: z.literal('search_in_project'),
        payload: z.object({
            query: z.string().trim().min(1)
        }).strict()
    }).strict(),
    z.object({
        ...actionBaseSchema,
        type: z.literal('run_terminal_command'),
        payload: z.object({
            command: z.string().trim().min(1)
        }).strict()
    }).strict(),
    z.object({
        ...actionBaseSchema,
        type: z.literal('apply_diff'),
        payload: z.object({
            diff: z.string().trim().min(1),
            paths: z.array(z.string().trim().min(1)).optional()
        }).strict()
    }).strict(),
    z.object({
        ...actionBaseSchema,
        type: z.literal('create_file'),
        payload: z.object({
            path: z.string().trim().min(1),
            content: z.string().optional()
        }).strict()
    }).strict(),
    z.object({
        ...actionBaseSchema,
        type: z.literal('delete_file'),
        payload: z.object({
            path: z.string().trim().min(1)
        }).strict()
    }).strict()
]);

export type ActionInput = z.infer<typeof actionInputSchema>;
