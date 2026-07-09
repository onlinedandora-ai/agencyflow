import { API_URL } from "./api";

let warmupStarted = false;

/** Fire-and-forget ping to wake Render free-tier API before authenticated requests. */
export function warmupApi() {
  if (warmupStarted || typeof window === "undefined") return;
  warmupStarted = true;

  fetch(`${API_URL}/health`, { mode: "cors", cache: "no-store" }).catch(() => {
    // Ignore — login and data queries surface real errors.
  });
}
