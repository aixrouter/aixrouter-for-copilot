import type { ChatCompletionRequest, ChatMessage } from './types.js';

export interface RequestCompactionLimits {
  readonly maxHistoryMessages?: number;
  readonly maxRequestBytes?: number;
}

export interface RequestCompactionResult {
  readonly request: ChatCompletionRequest;
  readonly changed: boolean;
  readonly originalMessages: number;
  readonly compactedMessages: number;
  readonly originalBytes: number;
  readonly compactedBytes: number;
  readonly exceededByteLimit: boolean;
  readonly exceededMessageLimit: boolean;
}

export function compactChatCompletionRequest(
  request: ChatCompletionRequest,
  limits: RequestCompactionLimits,
): RequestCompactionResult {
  const maxHistoryMessages = positiveInteger(limits.maxHistoryMessages);
  const maxRequestBytes = positiveInteger(limits.maxRequestBytes);
  const originalBytes = requestBytes(request);

  if (!maxHistoryMessages && !maxRequestBytes) {
    return unchanged(request, originalBytes, false, false);
  }

  const originalMessages = request.messages.length;
  const exceedsMessageLimit = maxHistoryMessages !== undefined && originalMessages > maxHistoryMessages;
  const exceedsByteLimit = maxRequestBytes !== undefined && originalBytes > maxRequestBytes;
  if (!exceedsMessageLimit && !exceedsByteLimit) {
    return unchanged(request, originalBytes, false, false);
  }

  const { leadingSystem, turns } = splitIntoTurns(request.messages);
  if (turns.length === 0) {
    return unchanged(request, originalBytes, exceedsByteLimit, exceedsMessageLimit);
  }

  const keptTurns: ChatMessage[][] = [];
  let compactedMessages = leadingSystem;
  let compactedBytes = requestBytes({ ...request, messages: compactedMessages });
  let keptAtLeastOneTurn = false;

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const candidateTurns = [turns[index], ...keptTurns];
    const candidateMessages = [...leadingSystem, ...candidateTurns.flat()];
    const candidateRequest = { ...request, messages: candidateMessages };
    const candidateBytes = requestBytes(candidateRequest);
    const overMessageLimit = maxHistoryMessages !== undefined && candidateMessages.length > maxHistoryMessages;
    const overByteLimit = maxRequestBytes !== undefined && candidateBytes > maxRequestBytes;

    if ((overMessageLimit || overByteLimit) && keptAtLeastOneTurn) {
      break;
    }

    keptTurns.unshift(turns[index]);
    compactedMessages = candidateMessages;
    compactedBytes = candidateBytes;
    keptAtLeastOneTurn = true;

    if (overMessageLimit || overByteLimit) {
      break;
    }
  }

  const compactedRequest = { ...request, messages: compactedMessages };
  return {
    request: compactedRequest,
    changed: compactedMessages.length !== originalMessages,
    originalMessages,
    compactedMessages: compactedMessages.length,
    originalBytes,
    compactedBytes,
    exceededByteLimit: maxRequestBytes !== undefined && compactedBytes > maxRequestBytes,
    exceededMessageLimit: maxHistoryMessages !== undefined && compactedMessages.length > maxHistoryMessages,
  };
}

function unchanged(
  request: ChatCompletionRequest,
  bytes: number,
  exceededByteLimit: boolean,
  exceededMessageLimit: boolean,
): RequestCompactionResult {
  return {
    request,
    changed: false,
    originalMessages: request.messages.length,
    compactedMessages: request.messages.length,
    originalBytes: bytes,
    compactedBytes: bytes,
    exceededByteLimit,
    exceededMessageLimit,
  };
}

function splitIntoTurns(messages: ChatMessage[]): { leadingSystem: ChatMessage[]; turns: ChatMessage[][] } {
  const leadingSystem: ChatMessage[] = [];
  let index = 0;
  while (index < messages.length && messages[index].role === 'system') {
    leadingSystem.push(messages[index]);
    index += 1;
  }

  const turns: ChatMessage[][] = [];
  let current: ChatMessage[] = [];
  for (; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === 'user' && current.length > 0) {
      turns.push(current);
      current = [];
    }
    current.push(message);
  }
  if (current.length > 0) {
    turns.push(current);
  }

  return { leadingSystem, turns };
}

function positiveInteger(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

function requestBytes(request: ChatCompletionRequest): number {
  return new TextEncoder().encode(JSON.stringify(request)).byteLength;
}
