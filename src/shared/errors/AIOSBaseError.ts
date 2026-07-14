import { SystemLog } from '../types/sharedTypes';

export class AIOSBaseError extends Error {
    public readonly userMessage: string;
    public readonly technicalMessage: string;
    public readonly logRecord: SystemLog;

    constructor(userMessage: string, technicalMessage: string, module: string, source: string) {
        super(technicalMessage);
        this.userMessage = userMessage;
        this.technicalMessage = technicalMessage;
        this.logRecord = {
            id: `err_log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            level: 'error',
            message: `[${module}][${source}] User: ${userMessage} | Tech: ${technicalMessage}`,
            timestamp: Date.now()
        };
    }
}
