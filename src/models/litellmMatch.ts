/**
 * Pure functions for matching AIXRouter model IDs against LiteLLM entries.
 *
 * These functions have NO dependencies on vscode, fs, or any side effects.
 * They can be imported directly from scripts and tests without needing the
 * VS Code extension runtime.
 */

import { resolveAlias } from './modelAliases.js';

/** Compact model metadata entry from the LiteLLM community catalog. */
export interface LiteLLMModelEntry {
  readonly id: string;
  readonly maxInputTokens?: number;
  readonly maxOutputTokens?: number;
  readonly vision?: boolean;
  readonly toolCalling?: boolean;
  readonly reasoning?: boolean;
}

export { getModelAliases, resolveAlias } from './modelAliases.js';

interface ParsedId {
  readonly base: string;
  readonly segments: string[];
}

/** Parses a LiteLLM model id like "fireworks_ai/deepseek-v4-pro" into parts. */
export function parseLiteLLMId(id: string): ParsedId {
  const segments = id.toLowerCase().split('/');
  const base = segments[segments.length - 1];
  return { base, segments };
}

/**
 * Normalizes a model id for comparison by converting Claude-style
 * ".N" version suffixes to "-N" dash form.
 *
 * Example: "claude-sonnet-4.5" → "claude-sonnet-4-5"
 */
export function comparableBase(base: string): string {
  return base.replace(/^(claude-(?:haiku|sonnet|opus)-\d+)\.(\d+)$/i, '$1-$2');
}

/**
 * Checks if two model base names match under substring containment,
 * but only when the extra characters are a numeric or date/build suffix
 * (e.g. "gpt-5-0125" extending "gpt-5", "gemini-3-flash-preview" extending
 * "gemini-3-flash").
 *
 * ".NN" version suffixes (e.g. "gpt-5.1" vs "gpt-5") are deliberately
 * rejected — they are different model generations with unrelated
 * capabilities.  The same goes for "-chat", "-mini", "-nano", "-turbo"
 * etc., which denote distinct model variants.
 */
export function isBoundarySubmatch(a: string, b: string): boolean {
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (!longer.startsWith(shorter) && !longer.endsWith(shorter)) return false;

  // The extra part must be a suffix like "-0125" or "-preview".
  let extra: string;
  if (longer.startsWith(shorter)) {
    extra = longer.slice(shorter.length);
  } else {
    extra = longer.slice(0, longer.length - shorter.length);
  }

  // Allow: leading dash + digits (e.g. "gpt-5-0125" extends "gpt-5")
  if (/^-[-\d]/.test(extra) && !/[a-z]{2,}/i.test(extra.replace(/^-[-\d]+/, ''))) return true;

  // Allow: "-preview", "-thinking", "-lite" suffixes
  if (/^-(preview|thinking|lite)$/i.test(extra)) return true;

  // Reject: anything else — "gpt-5" must NOT match "gpt-5-chat", "gpt-5.1",
  // "glm-5-turbo" etc. which are entirely different model variants.
  return false;
}

/**
 * Merges multiple LiteLLM entries for the same base model into a single
 * "best capability" entry.
 *
 * For token limits we take the **maximum** across all entries, because
 * different providers impose different artificial caps and we want the
 * model's true capability.  Boolean capability flags are OR-ed.  The
 * `hint` (model family) is used to pick which entry's id to report.
 */
export function mergeLiteLLMEntries(
  entries: LiteLLMModelEntry[],
  hint?: string,
): LiteLLMModelEntry {
  if (entries.length === 1) return entries[0];

  let maxInputTokens: number | undefined;
  let maxOutputTokens: number | undefined;
  let vision: boolean | undefined;
  let toolCalling: boolean | undefined;
  let reasoning: boolean | undefined;

  // Track the entry with the highest maxInputTokens as fallback for id.
  let bestEntry: LiteLLMModelEntry = entries[0];
  let bestInput = bestEntry.maxInputTokens ?? -1;

  // Track the entry that matches the provider hint for id.
  let hintedEntry: LiteLLMModelEntry | undefined;

  for (const entry of entries) {
    if (entry.maxInputTokens !== undefined) {
      maxInputTokens = maxInputTokens === undefined
        ? entry.maxInputTokens
        : Math.max(maxInputTokens, entry.maxInputTokens);
      if (entry.maxInputTokens > bestInput) {
        bestInput = entry.maxInputTokens;
        bestEntry = entry;
      }
    }
    if (entry.maxOutputTokens !== undefined) {
      maxOutputTokens = maxOutputTokens === undefined
        ? entry.maxOutputTokens
        : Math.max(maxOutputTokens, entry.maxOutputTokens);
    }
    if (entry.vision) vision = true;
    if (entry.toolCalling) toolCalling = true;
    if (entry.reasoning) reasoning = true;

    // Check if this entry's provider matches the hint.
    if (hint && !hintedEntry) {
      const parsed = parseLiteLLMId(entry.id);
      if (parsed.segments.some((seg) => seg.includes(hint) || hint.includes(seg))) {
        hintedEntry = entry;
      }
    }
  }

  // Prefer hint-matched entry for id, fall back to highest-token entry.
  const idSource = hintedEntry ?? bestEntry;

  return {
    id: idSource.id,
    maxInputTokens,
    maxOutputTokens,
    vision,
    toolCalling,
    reasoning,
  };
}

/**
 * Matches an AIXRouter model id against LiteLLM entries.
 *
 * Strategy (in priority order):
 *  0. Explicit alias mapping (MODEL_ALIASES) — most precise, data-driven.
 *  1. Exact base-name match after alias resolution & comparableBase normalization.
 *  2. Substring containment with boundary check as a last resort.
 */
export function findLiteLLMEntry(
  modelId: string,
  family: string | undefined,
  entries: LiteLLMModelEntry[],
): LiteLLMModelEntry | undefined {
  if (entries.length === 0) return undefined;

  const needle = modelId.toLowerCase();
  let needleBase = comparableBase(needle.split('/').pop() ?? needle);

  // 0. Check explicit aliases first.
  const aliasTarget = resolveAlias(needleBase);
  if (aliasTarget) {
    needleBase = aliasTarget;
  }

  const hint = family?.toLowerCase();

  // 1. Exact base-name matches.
  const baseMatches = entries.filter((entry) => {
    const parsed = parseLiteLLMId(entry.id);
    return comparableBase(parsed.base) === needleBase;
  });

  if (baseMatches.length > 0) {
    return mergeLiteLLMEntries(baseMatches, hint);
  }

  // 2. Substring containment with boundary check.
  const substringMatches = entries.filter((entry) => {
    const parsed = parseLiteLLMId(entry.id);
    return isBoundarySubmatch(needleBase, comparableBase(parsed.base));
  });

  if (substringMatches.length > 0) {
    return mergeLiteLLMEntries(substringMatches, hint);
  }

  return undefined;
}
