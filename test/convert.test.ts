import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  LanguageModelTextPart: class LanguageModelTextPart {
    constructor(public readonly value: string) {}
  },
  LanguageModelToolCallPart: class LanguageModelToolCallPart {
    constructor(
      public readonly callId: string,
      public readonly name: string,
      public readonly input: unknown,
    ) {}
  },
  LanguageModelToolResultPart: class LanguageModelToolResultPart {
    constructor(
      public readonly callId: string,
      public readonly content: unknown[],
    ) {}
  },
  LanguageModelDataPart: class LanguageModelDataPart {
    constructor(
      public readonly data: Uint8Array,
      public readonly mimeType: string,
    ) {}
  },
  LanguageModelChatMessageRole: {
    Assistant: 2,
    User: 1,
    System: 0,
  },
}));

const { sanitizeToolSchema } = await import('../src/convert.js');

describe('sanitizeToolSchema', () => {
  it('recursively removes VS Code-only schema metadata', () => {
    const result = sanitizeToolSchema({
      type: 'object',
      markdownDescription: 'ignored',
      enumDescriptions: ['ignored'],
      properties: {
        mode: {
          type: 'string',
          enum: ['fast'],
          markdownEnumDescriptions: ['ignored'],
          defaultSnippets: [{ body: 'fast' }],
        },
      },
    });

    expect(result).toEqual({
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['fast'],
        },
      },
    });
  });

  it('does not mutate the original schema object', () => {
    const schema = {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          markdownDescription: 'Path for {0}',
        },
      },
    };

    const result = sanitizeToolSchema(schema);

    expect(result).toEqual({
      type: 'object',
      properties: {
        path: {
          type: 'string',
        },
      },
    });
    expect(schema.properties.path.markdownDescription).toBe('Path for {0}');
  });

  it('keeps standard JSON Schema fields and sanitizes unresolved placeholders', () => {
    const result = sanitizeToolSchema({
      type: 'object',
      description: 'Use {0} carefully',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: 'Query {1}',
        },
      },
    });

    expect(result).toEqual({
      type: 'object',
      description: 'Use value carefully',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: 'Query value',
        },
      },
    });
  });
});
