export async function parseErrorResponse(response: Response): Promise<any> {
    const text = await response.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export function errorMessage(details: any, fallback: string): string {
    if (typeof details === 'string' && details.length > 0) {
        return details;
    }
    if (typeof details?.message === 'string' && details.message.length > 0) {
        return details.message;
    }
    return fallback;
}
