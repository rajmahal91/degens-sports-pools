export function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();
  if (
    normalized.includes('offline') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('database error querying schema') ||
    normalized.includes('service unavailable') ||
    normalized.includes('gateway')
  ) {
    return 'We’re having trouble connecting right now. Check your internet connection and try again in a moment.';
  }
  return message || fallback;
}
