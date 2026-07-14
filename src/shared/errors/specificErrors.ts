import { AIOSBaseError } from './AIOSBaseError';

export class AIOSProviderError extends AIOSBaseError {
    constructor(userMessage: string, technicalMessage: string, source: string) {
        super(userMessage, technicalMessage, 'Provider', source);
    }
}

export class AIOSScannerError extends AIOSBaseError {
    constructor(userMessage: string, technicalMessage: string, source: string) {
        super(userMessage, technicalMessage, 'Scanner', source);
    }
}

export class AIOSPlannerError extends AIOSBaseError {
    constructor(userMessage: string, technicalMessage: string, source: string) {
        super(userMessage, technicalMessage, 'Planner', source);
    }
}

export class AIOSPromptError extends AIOSBaseError {
    constructor(userMessage: string, technicalMessage: string, source: string) {
        super(userMessage, technicalMessage, 'Prompt', source);
    }
}

export class AIOSStateError extends AIOSBaseError {
    constructor(userMessage: string, technicalMessage: string, source: string) {
        super(userMessage, technicalMessage, 'State', source);
    }
}

export class AIOSValidationError extends AIOSBaseError {
    constructor(userMessage: string, technicalMessage: string, source: string) {
        super(userMessage, technicalMessage, 'Validation', source);
    }
}

export class AIOSActionError extends AIOSBaseError {
    constructor(userMessage: string, technicalMessage: string, source: string) {
        super(userMessage, technicalMessage, 'Action', source);
    }
}
