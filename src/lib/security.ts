export function clearAppSessionStorage() {
  if (typeof window === "undefined") return;

  const candidates = new Set<string>();

  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (url) {
      const hostname = new URL(url).hostname;
      const projectRef = hostname.split(".")[0];
      if (projectRef) {
        candidates.add(`sb-${projectRef}-auth-token`);
        candidates.add(`sb-${projectRef}-auth-token-code-verifier`);
      }
    }
  } catch {
    // ignore malformed URLs
  }

  candidates.add("property-dashboard:last-route");
  candidates.add("property-dashboard:debug");

  for (const key of candidates) {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  }
}
