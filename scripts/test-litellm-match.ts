/**
 * Quick smoke test for the LiteLLM fallback matcher.
 *
 * Imports the pure matching functions directly from source — no duplicated
 * logic.  Run:  npx tsx scripts/test-litellm-match.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type LiteLLMModelEntry,
  findLiteLLMEntry,
} from '../src/models/litellmMatch.ts';

interface LiteLLMMetadataFile {
  readonly source: string;
  readonly sourceUrl: string;
  readonly syncedAt: string;
  readonly modelCount: number;
  readonly models: LiteLLMModelEntry[];
}

// --- Test ---
const filePath = path.join(import.meta.dirname, '..', 'resources', 'model-metadata.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as LiteLLMMetadataFile;
const entries = data.models;

const testCases = [
  { id: 'deepseek-v4-pro', family: 'deepseek', expectMin: 1000000, label: 'DeepSeek V4 Pro → 1M' },
  { id: 'deepseek-v4-flash', family: 'deepseek', expectMin: 1000000, label: 'DeepSeek V4 Flash → 1M' },
  { id: 'claude-sonnet-4-5', family: 'anthropic', expectMin: 200000, label: 'Claude Sonnet 4.5' },
  { id: 'claude-opus-4.8', family: 'anthropic', expectMin: 1000000, label: 'Claude Opus 4.8' },
  { id: 'gpt-4o', family: 'openai', expectMin: 128000, label: 'GPT-4o' },
  { id: 'gemini-2.5-pro', family: 'google', expectMin: 1000000, label: 'Gemini 2.5 Pro → 1M' },
  { id: 'glm-4.6', family: 'zhipu', expectMin: 128000, label: 'GLM-4.6 (Zhipu)' },
  { id: 'qwen3-235b-a22b', family: 'qwen', expectMin: 128000, label: 'Qwen3 235B' },
  { id: 'kimi-k2.5', family: 'moonshot', expectMin: 128000, label: 'Kimi K2.5' },
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const entry = findLiteLLMEntry(tc.id, tc.family, entries);
  const maxInput = entry?.maxInputTokens ?? 0;
  const ok = maxInput >= tc.expectMin;
  const status = ok ? '✅' : '❌';
  console.log(`${status} ${tc.label}`);
  console.log(`   model=${tc.id} family=${tc.family}`);
  console.log(`   matched=${entry?.id ?? '(none)'} maxInputTokens=${entry?.maxInputTokens ?? 'n/a'}`);
  if (!ok) {
    console.log(`   EXPECTED >= ${tc.expectMin}, GOT ${maxInput}`);
    failed++;
  } else {
    passed++;
  }
  console.log();
}

console.log(`Result: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
