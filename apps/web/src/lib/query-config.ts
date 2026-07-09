/** Shared React Query tuning for list/stats endpoints. */
export const LIST_STALE_TIME = 60_000;
export const STATS_STALE_TIME = 30_000;

export const REQUEST_TIMEOUT_MS = 25_000;
export const SLOW_QUERY_MS = 5_000;

/** Exponential backoff for retries (cold Render wake-up). */
export function queryRetryDelay(attempt: number) {
  return Math.min(1_000 * 2 ** attempt, 8_000);
}

export const defaultQueryOptions = {
  staleTime: LIST_STALE_TIME,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  retry: 3,
  retryDelay: queryRetryDelay,
};
