import { describe, expect, it } from 'vitest';
import { AIXRouterHttpError, createHttpError } from '../../src/client/errors.js';

describe('createHttpError', () => {
  it('returns a typed HTTP error for insufficient token balance', async () => {
    const error = await createHttpError(
      'AIXRouter chat completion failed',
      new Response(JSON.stringify({
        error: {
          message: 'Your subscription has insufficient token balance.',
          code: 'insufficient_tokens',
        },
      }), {
        status: 402,
        statusText: 'Payment Required',
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(error).toBeInstanceOf(AIXRouterHttpError);
    expect((error as AIXRouterHttpError).status).toBe(402);
    expect(error.message).toContain('The account has insufficient balance or quota.');
    expect(error.message).toContain('insufficient_tokens');
  });
});
