const RETRYABLE_STATUSES = new Set([408, 425, 429]);

function isRetryable(response: Response) {
  return RETRYABLE_STATUSES.has(response.status) || response.status >= 500;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries only transient Supabase/network failures; auth and validation errors are returned immediately. */
export async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit) {
  const delays = [350, 900];

  for (let attempt = 0; ; attempt += 1) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('OFFLINE');
    try {
      const response = await fetch(input, init);
      if (!isRetryable(response) || attempt >= delays.length) return response;
    } catch (error) {
      if (attempt >= delays.length) throw error;
    }
    await wait(delays[attempt]);
  }
}
