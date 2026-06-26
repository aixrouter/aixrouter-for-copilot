import { describe, expect, it } from 'vitest';
import { applyRequestCompatibility } from '../../src/provider/requestCompatibility.js';
import type { ChatCompletionRequest } from '../../src/types.js';

describe('applyRequestCompatibility', () => {
  const request: ChatCompletionRequest = {
    model: 'deepseek-v4-pro',
    messages: [{ role: 'user', content: 'hello' }],
    stream: true,
    context_window: 1000000,
    reasoning_effort: 'high',
    max_tokens: 4096,
    temperature: 0.2,
  };

  it('omits optional extension fields in stable mode', () => {
    const result = applyRequestCompatibility(request, 'stable');

    expect(result.request).toEqual({
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
      max_tokens: 4096,
      temperature: 0.2,
    });
    expect(result.omitted).toEqual(['context_window', 'reasoning_effort']);
  });

  it('keeps the full request shape in full mode', () => {
    const result = applyRequestCompatibility(request, 'full');

    expect(result.request).toBe(request);
    expect(result.omitted).toEqual([]);
  });

  it('does not report omissions when optional fields are absent', () => {
    const minimal: ChatCompletionRequest = {
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    };

    const result = applyRequestCompatibility(minimal, 'stable');

    expect(result.request).toEqual(minimal);
    expect(result.omitted).toEqual([]);
  });
});
