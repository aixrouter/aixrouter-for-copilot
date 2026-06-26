export class AIXRouterHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly statusText: string,
  ) {
    super(message);
    this.name = 'AIXRouterHttpError';
  }
}

export async function createHttpError(prefix: string, response: Response): Promise<Error> {
  const body = await response.text().catch(() => '');
  const details = [
    friendlyStatusMessage(response.status),
    extractErrorDetail(body),
  ].filter(Boolean).join(' ');

  return new AIXRouterHttpError(
    `${prefix}: ${response.status} ${response.statusText}.${details ? ` ${details}` : ''}`,
    response.status,
    response.statusText,
  );
}

export function friendlyStatusMessage(status: number): string | undefined {
  if (status === 400) {
    return 'The request was rejected. Check the selected model and request options.';
  }
  if (status === 401) {
    return 'The API key is missing or invalid. Run "AIXRouter: Set API Key".';
  }
  if (status === 402) {
    return 'The account has insufficient balance or quota.';
  }
  if (status === 403) {
    return 'The API key does not have permission to access this endpoint or model.';
  }
  if (status === 404) {
    return 'The Base URL or model endpoint was not found. Check "AIXRouter: Set Base URL".';
  }
  if (status === 408) {
    return 'The request timed out. Try again or check your network/proxy.';
  }
  if (status === 429) {
    return 'The provider rate limit was reached. Try again later or choose another model.';
  }
  if (status >= 500) {
    return 'The upstream provider returned a server error. Try again later.';
  }
  return undefined;
}

export function extractErrorDetail(body: string): string | undefined {
  if (!body.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown; code?: unknown };
      message?: unknown;
      code?: unknown;
    };
    const message = stringFrom(parsed.error?.message) ?? stringFrom(parsed.message);
    const code = stringFrom(parsed.error?.code) ?? stringFrom(parsed.code);
    if (message && code) {
      return `Provider says: ${message} (${code}).`;
    }
    if (message) {
      return `Provider says: ${message}.`;
    }
  } catch {
    // Fall back to a compact body preview below.
  }

  return `Provider response: ${body.replace(/\s+/g, ' ').slice(0, 500)}.`;
}

export function stringFrom(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function fetchFailedError(endpoint: string, error: unknown, detail?: string): Error {
  const cause = describeError(error);
  const suffix = detail ? ` ${detail}` : '';
  return new Error(`AIXRouter request to ${endpoint} failed before receiving an HTTP response.${suffix} ${cause}`);
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts = [error.message];
  const cause = (error as { cause?: unknown }).cause;
  if (cause) {
    parts.push(`Cause: ${describeError(cause)}`);
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && !parts.some((part) => part.includes(code))) {
    parts.push(`Code: ${code}`);
  }

  return parts.join(' ');
}

export function emptyResponseError(source: string, preview: string): Error {
  const normalized = preview.replace(/\s+/g, ' ').trim().slice(0, 800);
  const suffix = normalized ? ` Response preview: ${normalized}` : '';
  return new Error(`AIXRouter ${source} did not contain any assistant text or tool call.${suffix}`);
}
