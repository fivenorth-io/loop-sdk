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
    if (message?.type === 'unauthorized' && typeof message?.code === 'string') {
        return message.code;
    }

    const candidates = [
        message?.error?.code,
        message?.error?.type,
        message?.payload?.error?.code,
        message?.payload?.error?.type,
        message?.payload?.code,
        message?.code,
    ];

    for (const c of candidates) {
        if (typeof c === 'string' && c.length > 0) {
            return c;
        }
    }

    return null;
}

export function isUnauthCode(code: string | null | undefined): code is string {
    if (!code) {
        return false;
    }
    return UNAUTH_CODES.has(code);
}
