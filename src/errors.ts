export class RequestTimeoutError extends Error {
    constructor(timeout: number) {
        super(`Request timed out after ${timeout}ms.`);
    }
}

export class RejectRequestError extends Error {
    constructor() {
        super('Request was rejected by the wallet.');
    }
}

export class UnauthorizedError extends Error {
    public code?: string;
    constructor(code?: string) {
        super(code || 'Unauthorized');
        this.code = code;
    }
}

const UNAUTH_CODES = new Set(['UNAUTHENTICATED', 'UNAUTHORIZED', 'SESSION_EXPIRED', 'LOGGED_OUT']);

export function extractErrorCode(message: any): string | null {
    if (typeof message?.error?.code === 'string' && message.error.code.length > 0) {
        return message.error.code;
    }
    if (message?.type === 'unauthorized' && typeof message?.code === 'string') {
        return message.code;
    }
    return null;
}

export function isUnauthCode(code: string | null | undefined): code is string {
    if (!code) {
        return false;
    }
    return UNAUTH_CODES.has(code);
}
