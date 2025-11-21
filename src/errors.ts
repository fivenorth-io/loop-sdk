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
