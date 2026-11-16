import { extractApiErrorMessage, formatClientError } from './error_messages.js';

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions extends RequestInit {
  fallbackError?: string;
}

/**
 * Executes a credentialed API request (sending HttpOnly cookies automatically),
 * parses JSON safely, and throws an ApiError with a human-readable message on failure.
 */
export async function apiRequestJson<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const { fallbackError = 'Request failed.', headers, body, ...rest } = options;

  try {
    const mergedHeaders = new Headers(headers);
    if (body !== undefined && !mergedHeaders.has('Content-Type')) {
      mergedHeaders.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, {
      ...rest,
      credentials: 'include',
      headers: mergedHeaders,
      body,
    });

    if (!res.ok) {
      const msg = await extractApiErrorMessage(res, fallbackError);
      throw new ApiError(msg, res.status);
    }

    const raw = await res.text();
    if (!raw.trim()) {
      return undefined as T;
    }

    return JSON.parse(raw) as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new Error(formatClientError(err, fallbackError));
  }
}
