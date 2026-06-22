import * as vscode from 'vscode';
import type { AIXRouterModelConfig } from './types';

const SECTION = 'magicrouter';
const LEGACY_SECTION = 'aixrouter-copilot';

export function getBaseUrl(): string {
  return trimTrailingSlash(getConfiguredString('baseUrl', ''));
}

export function hasBaseUrl(): boolean {
  return getBaseUrl().length > 0;
}

export async function setBaseUrl(): Promise<boolean> {
  const value = await vscode.window.showInputBox({
    title: 'Magic Router Base URL',
    prompt: 'Enter your OpenAI-compatible base URL, for example https://api.example.com/openai/v1.',
    value: getBaseUrl(),
    ignoreFocusOut: true,
    validateInput: (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        return 'Base URL is required.';
      }
      try {
        const url = new URL(trimmed);
        return url.protocol === 'https:' || url.protocol === 'http:'
          ? undefined
          : 'Base URL must start with http:// or https://.';
      } catch {
        return 'Enter a valid URL.';
      }
    },
  });

  if (value === undefined) {
    return false;
  }

  await getConfig().update('baseUrl', trimTrailingSlash(value.trim()), vscode.ConfigurationTarget.Global);
  return true;
}

export function getPinnedModels(): AIXRouterModelConfig[] {
  const models = getConfig().get<AIXRouterModelConfig[]>('models', []);
  const legacyModels = getLegacyConfig().get<AIXRouterModelConfig[]>('models', []);
  return (models.length > 0 ? models : legacyModels).filter((model) => model.id);
}

export function getMaxTokens(): number | undefined {
  const value = getConfiguredNumber('maxTokens', 0);
  return value > 0 ? value : undefined;
}

export function getTemperature(): number | undefined {
  const value = getConfig().get<number | null>('temperature', getLegacyConfig().get<number | null>('temperature', null));
  return typeof value === 'number' ? value : undefined;
}

export function getReasoningEffort(): 'low' | 'medium' | 'high' | 'max' {
  return getConfig().get<'low' | 'medium' | 'high' | 'max'>('reasoningEffort', getLegacyConfig().get<'low' | 'medium' | 'high' | 'max'>('reasoningEffort', 'high'));
}

export function getDebugEnabled(): boolean {
  return getConfig().get('debug', getLegacyConfig().get('debug', false));
}

export function onConfigChanged(listener: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(SECTION) || event.affectsConfiguration(LEGACY_SECTION)) {
      listener();
    }
  });
}

export function openSettings(): Thenable<unknown> {
  return vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${vscode.extensions.getExtension('aixrouter.magic-router-for-copilot')?.id ?? SECTION}`);
}

function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(SECTION);
}

function getLegacyConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(LEGACY_SECTION);
}

function getConfiguredString(key: string, defaultValue: string): string {
  const value = getConfig().get<string>(key, defaultValue);
  return value || getLegacyConfig().get<string>(key, defaultValue);
}

function getConfiguredNumber(key: string, defaultValue: number): number {
  const value = getConfig().get<number>(key, defaultValue);
  return value !== defaultValue ? value : getLegacyConfig().get<number>(key, defaultValue);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
