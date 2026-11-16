export interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    status?: number;
  };
  message?: string;
}

const ERROR_CODE_MAP: Record<string, string> = {
  INVALID_DEVICE_ID: 'The selected node ID is not valid.',
  INVALID_STUDIO_CONFIG: 'Studio layout or camera settings contain invalid values.',
  INVALID_ZONE_CONFIG: 'One or more spatial zone angles or labels are invalid.',
  DUPLICATE_API_KEY: 'A hardware node with this API key already exists.',
  TOO_MANY_REQUESTS: 'Too many requests sent in a short time. Please wait a moment and try again.',
  CORS_FORBIDDEN: 'Request was blocked by cross-origin security policy.',
  DATABASE_ERROR: 'The server encountered a database error. Please try again shortly.',
  UNAUTHORIZED: 'Your session is missing or has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource could not be found.',
};

function friendlyStatusFallback(status: number, fallback: string): string {
  switch (status) {
    case 400:
      return `${fallback} Please check the submitted values.`;
    case 401:
      return 'Your session has expired or is invalid. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found on the server.';
    case 409:
      return 'This action conflicts with existing data.';
    case 413:
      return 'The submitted payload is too large for the server to accept.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'The server encountered an internal error. Please try again shortly.';
    case 502:
    case 503:
    case 504:
      return 'Cannot reach the backend server right now. Check that the API server is running and try again.';
    default:
      return `${fallback} (HTTP ${status}).`;
  }
}

function cleanMessage(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Parses an unsuccessful HTTP Response safely without throwing on empty or HTML bodies
 * (such as Vite dev-proxy 502 pages), returning a clear, human-readable message.
 */
export async function extractApiErrorMessage(
  res: Response,
  fallback = 'Request failed.'
): Promise<string> {
  let hasEmptyBody = false;

  try {
    const rawText = await res.text();
    const trimmed = rawText.trim();
    hasEmptyBody = trimmed.length === 0;

    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed) as ApiErrorEnvelope;
        const code = parsed?.error?.code;
        const apiMessage = parsed?.error?.message || parsed?.message;

        if (apiMessage && typeof apiMessage === 'string') {
          const cleaned = cleanMessage(apiMessage);
          if (code && ERROR_CODE_MAP[code] && res.status >= 500) {
            return ERROR_CODE_MAP[code];
          }
          return cleaned;
        }

        if (code && ERROR_CODE_MAP[code]) {
          return ERROR_CODE_MAP[code];
        }
      } catch {
        // Non-JSON response (e.g., Vite proxy HTML error page or plain text)
        const looksLikeHtml = trimmed.startsWith('<') || /<html/i.test(trimmed);
        if (!looksLikeHtml && trimmed.length <= 200) {
          return cleanMessage(trimmed);
        }
      }
    }
  } catch {
    // Ignore body stream read failures and fall through to HTTP status mapping.
  }

  // Vite dev proxy returns HTTP 500 with an empty body on ECONNREFUSED
  if (res.status === 500 && hasEmptyBody) {
    return 'Cannot reach the backend server right now. Check that the API server is running and VITE_BACKEND_HTTPS_URL matches its port.';
  }

  return friendlyStatusFallback(res.status, fallback);
}

/**
 * Converts low-level browser/runtime exceptions into readable messages for the UI.
 */
export function formatClientError(
  err: unknown,
  fallback = 'Something went wrong while communicating with the server.'
): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'The request timed out or was cancelled. Please try again.';
  }

  if (err instanceof SyntaxError) {
    return 'Received an unexpected or malformed response from the server.';
  }

  if (err instanceof Error) {
    const msg = cleanMessage(err.message || '');
    const lower = msg.toLowerCase();

    if (
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('load failed') ||
      lower.includes('econnrefused') ||
      lower.includes('err_connection_refused')
    ) {
      return 'Unable to reach the server. Check your network connection and verify the backend service is running.';
    }

    if (msg) {
      return msg;
    }
  } else if (typeof err === 'string' && err.trim()) {
    return cleanMessage(err);
  }

  return fallback;
}
