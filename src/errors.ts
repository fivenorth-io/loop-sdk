export class RequestTimeoutError extends Error {
    constructor(timeout: number) {
        super(`Request timed out after ${timeout}ms.`);
    }
}

export class PopupClosedError extends Error {
    constructor() {
        super('Wallet popup was closed before the request completed.');
    }
}

export class RejectRequestError extends Error {
    public code?: string;
    constructor(message?: string, code?: string) {
        super(message || 'Request was rejected by the wallet.');
        this.code = code;
    }
}

export class UnauthorizedError extends Error {
    public code?: string;
    constructor(code?: string) {
        super(code || 'Unauthorized');
        this.code = code;
    }
}

export class PaymentRequiredError extends Error {
    public code?: string;
    public trackingId?: string;
    public gasAmount?: string;
    public status?: string;
    public expiresAt?: string;

    constructor(details?: {
        message?: string;
        code?: string;
        tracking_id?: string;
        gas_amount?: string;
        status?: string;
        expires_at?: string;
    }) {
        super(details?.message || 'Payment required');
        this.code = details?.code;
        this.trackingId = details?.tracking_id;
        this.gasAmount = details?.gas_amount;
        this.status = details?.status;
        this.expiresAt = details?.expires_at;
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
