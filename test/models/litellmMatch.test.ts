/**
 * Unit tests for the LiteLLM matching functions in src/models/litellmMatch.ts.
 *
 * These are pure-function tests — no vscode, fs, or network dependencies.
 * Run:  pnpm vitest run
 */
import { describe, it, expect } from 'vitest';
import {
  parseLiteLLMId,
  comparableBase,
  isBoundarySubmatch,
  mergeLiteLLMEntries,
  findLiteLLMEntry,
  type LiteLLMModelEntry,
} from '../../src/models/litellmMatch.js';
import { getContextWindows } from '../../src/models/modelUtils.js';
// ── parseLiteLLMId ──────────────────────────────────────────────────
describe('parseLiteLLMId', () => {
  it('splits on / and lowercases', () => {
    const result = parseLiteLLMId('fireworks_ai/deepseek-v4-pro');
    expect(result.base).toBe('deepseek-v4-pro');
    expect(result.segments).toEqual(['fireworks_ai', 'deepseek-v4-pro']);
  });

  it('handles ids without a provider prefix', () => {
    const result = parseLiteLLMId('gpt-5');
    expect(result.base).toBe('gpt-5');
    expect(result.segments).toEqual(['gpt-5']);
  });

  it('lowercases mixed-case ids', () => {
    const result = parseLiteLLMId('Azure_AI/GPT-4o');
    expect(result.base).toBe('gpt-4o');
    expect(result.segments).toEqual(['azure_ai', 'gpt-4o']);
  });
});

// ── comparableBase ──────────────────────────────────────────────────
describe('comparableBase', () => {
  it('converts Claude dot-version to dash', () => {
    expect(comparableBase('claude-sonnet-4.5')).toBe('claude-sonnet-4-5');
    expect(comparableBase('claude-opus-4.8')).toBe('claude-opus-4-8');
    expect(comparableBase('claude-haiku-3.5')).toBe('claude-haiku-3-5');
  });

  it('leaves non-Claude ids unchanged', () => {
    expect(comparableBase('gpt-5.1')).toBe('gpt-5.1');
    expect(comparableBase('gemini-2.5-pro')).toBe('gemini-2.5-pro');
    expect(comparableBase('deepseek-v4-pro')).toBe('deepseek-v4-pro');
  });
});

// ── isBoundarySubmatch ──────────────────────────────────────────────
describe('isBoundarySubmatch', () => {
  it('exact match', () => {
    expect(isBoundarySubmatch('gpt-5', 'gpt-5')).toBe(true);
    expect(isBoundarySubmatch('claude-sonnet-4-5', 'claude-sonnet-4-5')).toBe(true);
  });

  // Allowed: date/build suffix with leading dash+digits
  it('allows date/build suffix (dash + digits)', () => {
    expect(isBoundarySubmatch('gpt-5', 'gpt-5-0125')).toBe(true);
    expect(isBoundarySubmatch('gemini-3-flash', 'gemini-3-flash-250603')).toBe(true);
  });

  // Allowed: keyword suffixes
  it('allows preview/thinking/lite suffixes', () => {
    expect(isBoundarySubmatch('gemini-3-flash', 'gemini-3-flash-preview')).toBe(true);
    expect(isBoundarySubmatch('claude-sonnet-4-5', 'claude-sonnet-4-5-thinking')).toBe(true);
    expect(isBoundarySubmatch('gemini-2.5-flash', 'gemini-2.5-flash-lite')).toBe(true);
  });

  // Forbidden: .NN version suffix — different model generation
  it('rejects .NN version suffix (gpt-5 vs gpt-5.1)', () => {
    expect(isBoundarySubmatch('gpt-5', 'gpt-5.1')).toBe(false);
  });

  // Forbidden: variant suffixes like -chat, -mini, -nano, -turbo
  it('rejects variant suffixes (-chat / -mini / -nano / -turbo)', () => {
    expect(isBoundarySubmatch('gpt-5', 'gpt-5-chat')).toBe(false);
    expect(isBoundarySubmatch('gpt-5', 'gpt-5-mini')).toBe(false);
    expect(isBoundarySubmatch('gemini-2.5-pro', 'gemini-2.5-pro-nano')).toBe(false);
    expect(isBoundarySubmatch('gpt-4o', 'gpt-4o-turbo')).toBe(false);
  });

  // Claude dot-version: comparableBase turns "4.5" → "4-5", which
  // becomes a valid dash+digit suffix — Claude .5 variants are in-family.
  it('allows claude-sonnet-4.5 extending claude-sonnet-4 (via comparableBase)', () => {
    expect(isBoundarySubmatch(
      comparableBase('claude-sonnet-4'),
      comparableBase('claude-sonnet-4.5'),
    )).toBe(true);
  });

  // Non-matching model families
  it('rejects completely different model names', () => {
    expect(isBoundarySubmatch('gpt-4o', 'gemini-2.5-pro')).toBe(false);
    expect(isBoundarySubmatch('claude-sonnet-4-5', 'gpt-5')).toBe(false);
  });

  // glm-5-turbo should NOT match glm-5 or glm-5.1
  it('rejects glm-5-turbo matching glm-5', () => {
    expect(isBoundarySubmatch('glm-5', 'glm-5-turbo')).toBe(false);
    expect(isBoundarySubmatch('glm-5.1', 'glm-5-turbo')).toBe(false);
  });
});

// ── mergeLiteLLMEntries ─────────────────────────────────────────────
describe('mergeLiteLLMEntries', () => {
  const a: LiteLLMModelEntry = {
    id: 'a/deepseek-v4-pro',
    maxInputTokens: 131072,
    maxOutputTokens: 8192,
    vision: true,
    toolCalling: false,
    reasoning: false,
  };
  const b: LiteLLMModelEntry = {
    id: 'b/deepseek-v4-pro',
    maxInputTokens: 1048576,
    maxOutputTokens: 16384,
    vision: false,
    toolCalling: true,
    reasoning: true,
  };
  const c: LiteLLMModelEntry = {
    id: 'c/deepseek-v4-pro',
    maxInputTokens: 262144,
  };

  it('single entry returns as-is', () => {
    expect(mergeLiteLLMEntries([a])).toEqual(a);
  });

  it('takes max of token limits', () => {
    const merged = mergeLiteLLMEntries([a, b]);
    expect(merged.maxInputTokens).toBe(1048576);
    expect(merged.maxOutputTokens).toBe(16384);
  });

  it('ORs boolean capability flags', () => {
    const merged = mergeLiteLLMEntries([a, b]);
    expect(merged.vision).toBe(true);
    expect(merged.toolCalling).toBe(true);
    expect(merged.reasoning).toBe(true);
  });

  it('picks id from hint-matched entry', () => {
    const merged = mergeLiteLLMEntries([a, b, c], 'b');
    expect(merged.id).toBe('b/deepseek-v4-pro');
  });

  it('falls back to highest-token entry id when no hint match', () => {
    const merged = mergeLiteLLMEntries([a, c, b], 'nonexistent');
    expect(merged.id).toBe('b/deepseek-v4-pro'); // b has highest input
  });
});

// ── findLiteLLMEntry ────────────────────────────────────────────────
describe('findLiteLLMEntry', () => {
  const entries: LiteLLMModelEntry[] = [
    { id: 'fireworks_ai/deepseek-v4-pro', maxInputTokens: 1048576, vision: true },
    { id: 'azure_ai/deepseek-v4-pro', maxInputTokens: 1048576, vision: true },
    { id: 'gmi/openai/gpt-5-0125', maxInputTokens: 262144, reasoning: true },
    { id: 'gmi/openai/gpt-5', maxInputTokens: 262144 },
    { id: 'openai/gpt-5.1', maxInputTokens: 131072 },
    { id: 'openai/gpt-5-chat', maxInputTokens: 65536 },
    { id: 'gmi/anthropic/claude-sonnet-4.5', maxInputTokens: 1000000 },
    { id: 'gmi/anthropic/claude-sonnet-4', maxInputTokens: 200000 },
    { id: 'zhipu/glm-5', maxInputTokens: 200000 },
    { id: 'zhipu/glm-5-turbo', maxInputTokens: 128000 },
  ];

  // deepseek-v4-pro → 1M
  it('matches deepseek-v4-pro and reports ≥1M input', () => {
    const result = findLiteLLMEntry('deepseek-v4-pro', 'deepseek', entries);
    expect(result).toBeDefined();
    expect(result!.maxInputTokens).toBeGreaterThanOrEqual(1000000);
  });

  // claude-opus-4.8 → claude-opus-4-8 (via comparableBase)
  it('matches claude-opus-4.8 via Claude dot-to-dash normalization', () => {
    const extendedEntries = [
      ...entries,
      { id: 'anthropic/claude-opus-4-8', maxInputTokens: 1000000 },
    ];
    const result = findLiteLLMEntry('claude-opus-4.8', 'anthropic', extendedEntries);
    expect(result).toBeDefined();
  });

  // gpt-5 does NOT match gpt-5.1
  it('gpt-5 does NOT match gpt-5.1', () => {
    const gptEntries = [
      { id: 'openai/gpt-5', maxInputTokens: 262144 },
      { id: 'openai/gpt-5.1', maxInputTokens: 131072 },
    ];
    const result = findLiteLLMEntry('gpt-5', 'openai', gptEntries);
    // Should only match the exact base gpt-5, not gpt-5.1
    expect(result?.maxInputTokens).toBe(262144);
  });

  // gpt-5 does NOT match gpt-5-chat
  it('gpt-5 does NOT match gpt-5-chat', () => {
    const gptEntries = [
      { id: 'openai/gpt-5', maxInputTokens: 262144 },
      { id: 'openai/gpt-5-chat', maxInputTokens: 65536 },
    ];
    const result = findLiteLLMEntry('gpt-5', 'openai', gptEntries);
    expect(result?.maxInputTokens).toBe(262144);
  });

  // glm-5-turbo should NOT be matched when looking for glm-5
  it('glm-5 does NOT match glm-5-turbo', () => {
    const result = findLiteLLMEntry('glm-5', 'zhipu', entries);
    // Should only match the exact 'glm-5' entry, not 'glm-5-turbo'
    expect(result?.maxInputTokens).toBe(200000);
  });

  // gpt-5 matches gpt-5-0125 (date/build suffix)
  it('gpt-5 matches gpt-5-0125 via boundary submatch', () => {
    const result = findLiteLLMEntry('gpt-5', 'openai', entries);
    // Should match both gpt-5 and gpt-5-0125, merging to max
    expect(result).toBeDefined();
    expect(result!.maxInputTokens).toBe(262144); // merged max
  });

  // empty entries returns undefined
  it('returns undefined for empty entry list', () => {
    const result = findLiteLLMEntry('gpt-4o', 'openai', []);
    expect(result).toBeUndefined();
  });

  // unknown model returns undefined
  it('returns undefined for a model not in the catalog', () => {
    const result = findLiteLLMEntry('nonexistent-model-999', 'unknown', entries);
    expect(result).toBeUndefined();
  });
});

// ── Integration: API + LiteLLM upward expansion ──────────────────────
describe('integration: API+LiteLLM token merging', () => {
  const apiModel = { maxInputTokens: 200000, id: 'test-model' };
  const litellmEntry: LiteLLMModelEntry = {
    id: 'provider/test-model',
    maxInputTokens: 1000000,
    maxOutputTokens: 32768,
  };

  it('expands upward when LiteLLM knows larger capability than API', () => {
    // Simulates: API returns 200K, LiteLLM knows 1M → merged should be 1M
    const merged = mergeLiteLLMEntries([litellmEntry]);
    expect(merged.maxInputTokens).toBe(1000000);

    // If API had 200K and LiteLLM has 1M, the max should be 1M
    const finalInput = Math.max(apiModel.maxInputTokens, merged.maxInputTokens!);
    expect(finalInput).toBe(1000000);
  });

  it('keeps API value when it is larger than LiteLLM', () => {
    const smallEntry: LiteLLMModelEntry = {
      id: 'provider/small-model',
      maxInputTokens: 65536,
    };
    const merged = mergeLiteLLMEntries([smallEntry]);
    const finalInput = Math.max(apiModel.maxInputTokens, merged.maxInputTokens!);
    expect(finalInput).toBe(200000); // API 200K > LiteLLM 64K
  });
});

// ── Integration: contextWindows capped by maxInputTokens ─────────────
describe('integration: contextWindows ≤ maxInputTokens', () => {
  it('unknown model (128K) does NOT show 200K context window option', () => {
    const maxInputTokens = 128000;
    const modelText = 'unknown-model-999';
    const windows = getContextWindows(modelText, maxInputTokens)
      .filter((w) => w <= maxInputTokens);
    // 200K is filtered out, 400K and 1M also filtered
    expect(windows).not.toContain(200000);
    expect(windows).not.toContain(400000);
    expect(windows).not.toContain(1000000);
    expect(windows).toEqual([]);
  });

  it('1M model shows all options up to 1M', () => {
    const maxInputTokens = 1000000;
    const modelText = 'gemini-2.5-pro';
    const windows = getContextWindows(modelText, maxInputTokens)
      .filter((w) => w <= maxInputTokens);
    expect(windows).toContain(200000);
    expect(windows).toContain(400000);
    expect(windows).toContain(1000000);
  });

  it('200K model only shows 200K option', () => {
    const maxInputTokens = 200000;
    const modelText = 'claude-sonnet-4';
    const windows = getContextWindows(modelText, maxInputTokens)
      .filter((w) => w <= maxInputTokens);
    expect(windows).toContain(200000);
    expect(windows).not.toContain(400000);
    expect(windows).not.toContain(1000000);
  });
});
