import { describe, it, expect } from 'vitest';
import { extractApiErrorMessage, formatClientError } from '../src/services/error_messages.js';

describe('extractApiErrorMessage', () => {
  it('returns the backend JSON error message for 4xx responses', async () => {
    const res = new Response(
      JSON.stringify({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password.',
          status: 401,
        },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );

    await expect(extractApiErrorMessage(res, 'Sign-in failed.')).resolves.toBe(
      'Invalid username or password.'
    );
  });

  it('maps 5xx server error codes to user-friendly guidance', async () => {
    const res = new Response(
      JSON.stringify({
        error: {
          code: 'DATABASE_ERROR',
          message: 'SQLITE_BUSY: database is locked',
          status: 500,
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );

    await expect(extractApiErrorMessage(res)).resolves.toBe(
      'The server encountered a database error. Please try again shortly.'
    );
  });

  it('handles 403 and 429 cleanly when JSON body is absent', async () => {
    const forbidden = new Response('', { status: 403 });
    await expect(extractApiErrorMessage(forbidden)).resolves.toBe(
      'You do not have permission to perform this action.'
    );

    const limited = new Response('', { status: 429 });
    await expect(extractApiErrorMessage(limited)).resolves.toBe(
      'Too many requests. Please wait a moment and try again.'
    );
  });

  it('ignores raw HTML error pages (e.g., Vite 502 Bad Gateway) and returns readable message', async () => {
    const proxy502 = new Response(
      '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body>Proxy failed</body></html>',
      { status: 502, headers: { 'Content-Type': 'text/html' } }
    );

    await expect(extractApiErrorMessage(proxy502)).resolves.toBe(
      'Cannot reach the backend server right now. Check that the API server is running and try again.'
    );
  });

  it('returns concise plain-text error messages when response is short non-HTML text', async () => {
    const res = new Response('Duplicate API key for node', {
      status: 409,
      headers: { 'Content-Type': 'text/plain' },
    });

    await expect(extractApiErrorMessage(res)).resolves.toBe('Duplicate API key for node');
  });
});

describe('formatClientError', () => {
  it('translates browser network errors (Chromium/Firefox/Safari) into plain English', () => {
    expect(formatClientError(new TypeError('Failed to fetch'))).toBe(
      'Unable to reach the server. Check your network connection and verify the backend service is running.'
    );
    expect(
      formatClientError(new TypeError('NetworkError when attempting to fetch resource.'))
    ).toBe(
      'Unable to reach the server. Check your network connection and verify the backend service is running.'
    );
  });

  it('translates SyntaxError JSON parsing failures into a readable message', () => {
    expect(formatClientError(new SyntaxError('Unexpected token < in JSON at position 0'))).toBe(
      'Received an unexpected or malformed response from the server.'
    );
  });

  it('translates AbortError DOMExceptions into a timeout/cancelled notice', () => {
    const abortErr = new DOMException('The operation was aborted.', 'AbortError');
    expect(formatClientError(abortErr)).toBe(
      'The request timed out or was cancelled. Please try again.'
    );
  });

  it('falls back cleanly for empty or unknown thrown values', () => {
    expect(formatClientError(null, 'Custom fallback.')).toBe('Custom fallback.');
    expect(formatClientError(new Error(''))).toBe(
      'Something went wrong while communicating with the server.'
    );
  });
});
