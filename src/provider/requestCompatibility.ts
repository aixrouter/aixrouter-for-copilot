import type { ChatCompletionRequest, RequestCompatibilityMode } from '../types.js';

export interface RequestCompatibilityResult {
  readonly request: ChatCompletionRequest;
  readonly omitted: readonly string[];
}

/**
 * Keeps the default chat payload close to the common OpenAI-compatible shape.
 *
 * AIXRouter supports useful extension fields, but some upstream routes are more
 * stable when optional routing/thinking hints are omitted. Users can switch to
 * "full" mode when they explicitly want those extension fields sent.
 */
export function applyRequestCompatibility(
  request: ChatCompletionRequest,
  mode: RequestCompatibilityMode,
): RequestCompatibilityResult {
  if (mode === 'full') {
    return { request, omitted: [] };
  }

  const {
    context_window: contextWindow,
    reasoning_effort: reasoningEffort,
    ...stableRequest
  } = request;

  const omitted = [
    contextWindow !== undefined ? 'context_window' : undefined,
    reasoningEffort !== undefined ? 'reasoning_effort' : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    request: stableRequest,
    omitted,
  };
}
