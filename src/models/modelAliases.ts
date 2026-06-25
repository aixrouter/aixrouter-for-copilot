/**
 * Model Aliases — explicit ID mappings between AIXRouter and LiteLLM names.
 *
 * When the AIXRouter API returns a model id that differs from what LiteLLM
 * uses, add a mapping here.  This is the FIRST matching strategy tried in
 * findLiteLLMEntry (before exact base-name or boundary substring), so it
 * always wins.
 *
 * Keys are AIXRouter model IDs (lowercase), values are LiteLLM base names.
 *
 * This file is intentionally a pure data module with no runtime logic so
 * it can be inspected or exported independently.
 */

const MODEL_ALIASES: Readonly<Record<string, string>> = {
  // Claude dot-version → dash-version
  'claude-opus-4.8': 'claude-opus-4-8',
  'claude-sonnet-4.5': 'claude-sonnet-4-5',
  'claude-haiku-4.5': 'claude-haiku-4-5',
  // Add more aliases here as needed:
  // 'glm-5.1': 'glm-5.1',  // TBD: add when LiteLLM picks it up
};

/** Returns a frozen reference to the alias map (read-only). */
export function getModelAliases(): Readonly<Record<string, string>> {
  return MODEL_ALIASES;
}

/** Looks up an alias, returning the LiteLLM base name if one exists. */
export function resolveAlias(aixrouterModelId: string): string | undefined {
  return MODEL_ALIASES[aixrouterModelId.toLowerCase()];
}
