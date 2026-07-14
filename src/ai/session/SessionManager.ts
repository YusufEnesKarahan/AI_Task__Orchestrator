import * as fs from 'fs';
import * as path from 'path';
import { AIChatMessage } from '../shared/aiTypes';

export interface AISession {
    id: string;
    createdAt: number;
    updatedAt: number;
    messages: AIChatMessage[];
}

export class SessionManager {
    private sessionsPath: string;

    constructor(workspaceRoot: string) {
        this.sessionsPath = path.join(workspaceRoot, '.aios', 'sessions');
        this.ensureSessionsDirectory();
    }

    private ensureSessionsDirectory() {
        if (!fs.existsSync(this.sessionsPath)) {
            fs.mkdirSync(this.sessionsPath, { recursive: true });
        }
    }

    public createSession(id?: string): AISession {
        const sessionId = id || `session_${Date.now()}`;
        const session: AISession = {
            id: sessionId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: []
        };
        this.saveSession(session);
        return session;
    }

    public getSession(id: string): AISession | null {
        const sessionFile = path.join(this.sessionsPath, `${id}.json`);
        if (fs.existsSync(sessionFile)) {
            const data = fs.readFileSync(sessionFile, 'utf-8');
            return JSON.parse(data) as AISession;
        }
        return null;
    }

    public addMessage(sessionId: string, message: AIChatMessage): void {
        const session = this.getSession(sessionId);
        if (session) {
            session.messages.push(message);
            session.updatedAt = Date.now();
            this.saveSession(session);
        } else {
            throw new Error(`[SessionManager] Session not found: ${sessionId}`);
        }
    }

    private saveSession(session: AISession): void {
        const sessionFile = path.join(this.sessionsPath, `${session.id}.json`);
        fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8');
    }
}
