import { API_URL } from "./api";

let warmupPromise: Promise<void> | null = null;

/**
 * Pre-connect to the API before authenticated requests.
 * On Vercel each route cold-starts separately, so we warm /health and /auth/me.
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
  const targets = [`${base}/health`];

  // Same-origin: warm auth routes (401 is fine — we only need the function booted).
  if (!base) {
    targets.push(`${base}/auth/me`);
  }

  await Promise.allSettled(
    targets.map((url) =>
      fetch(url, { cache: "no-store", credentials: "same-origin" }),
    ),
  );
}
