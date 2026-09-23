import { API_URL } from "./api";

let warmupPromise: Promise<void> | null = null;

/**
 * Optional pre-connection to the API endpoint to reduce initial latency.
 */
export function warmupApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!warmupPromise) {
    warmupPromise = runWarmup();
  }
  return warmupPromise;
}

async function runWarmup(): Promise<void> {
  const base = API_URL;
  // Ping /health in background if custom API_URL is provided
  if (base) {
    try {
      await fetch(`${base}/health`, { cache: "no-store", mode: "cors" });
    } catch {
      // Ignore background warmup failures
    }
  }
}
