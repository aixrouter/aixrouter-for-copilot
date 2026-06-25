import { describe, expect, it } from 'vitest';
import { compactChatCompletionRequest } from '../src/compaction.js';
import type { ChatCompletionRequest, ChatMessage } from '../src/types.js';

describe('compactChatCompletionRequest', () => {
  it('keeps leading system messages and newest complete turns', () => {
    const request = makeRequest([
      system('rules'),
      user('old question'),
      assistant('old answer'),
      user('new question'),
      assistant('new answer'),
    ]);

    const result = compactChatCompletionRequest(request, { maxHistoryMessages: 3 });

    expect(result.changed).toBe(true);
    expect(result.request.messages).toEqual([
      system('rules'),
      user('new question'),
      assistant('new answer'),
    ]);
  });

  it('does not split assistant tool calls from their tool results', () => {
    const request = makeRequest([
      system('rules'),
      user('old question'),
      assistant('old answer'),
      user('new question'),
      assistantToolCall('call-1'),
      toolResult('call-1', 'tool output'),
      assistant('final answer'),
    ]);

    const result = compactChatCompletionRequest(request, { maxHistoryMessages: 5 });

    expect(result.request.messages).toEqual([
      system('rules'),
      user('new question'),
      assistantToolCall('call-1'),
      toolResult('call-1', 'tool output'),
      assistant('final answer'),
    ]);
  });

  it('uses request byte limit when message count is below the limit', () => {
    const request = makeRequest([
      user('x'.repeat(500)),
      assistant('old'),
      user('short'),
      assistant('new'),
    ]);

    const result = compactChatCompletionRequest(request, { maxRequestBytes: 260 });

    expect(result.changed).toBe(true);
    expect(result.request.messages).toEqual([
      user('short'),
      assistant('new'),
    ]);
  });

  it('keeps the newest turn even when it still exceeds the configured limits', () => {
    const request = makeRequest([
      user('old'),
      assistant('old'),
      user('x'.repeat(500)),
      assistant('new'),
    ]);

    const result = compactChatCompletionRequest(request, {
      maxHistoryMessages: 1,
      maxRequestBytes: 100,
    });

    expect(result.changed).toBe(true);
    expect(result.exceededByteLimit).toBe(true);
    expect(result.exceededMessageLimit).toBe(true);
    expect(result.request.messages).toEqual([
      user('x'.repeat(500)),
      assistant('new'),
    ]);
  });
});

function makeRequest(messages: ChatMessage[]): ChatCompletionRequest {
  return {
    model: 'test-model',
    messages,
    stream: true,
  };
}

function system(content: string): ChatMessage {
  return { role: 'system', content };
}

function user(content: string): ChatMessage {
  return { role: 'user', content };
}

function assistant(content: string): ChatMessage {
  return { role: 'assistant', content };
}

function assistantToolCall(id: string): ChatMessage {
  return {
    role: 'assistant',
    content: '',
    tool_calls: [
      {
        id,
        type: 'function',
        function: {
          name: 'lookup',
          arguments: '{}',
        },
      },
    ],
  };
}

function toolResult(tool_call_id: string, content: string): ChatMessage {
  return {
    role: 'tool',
    tool_call_id,
    content,
  };
}
