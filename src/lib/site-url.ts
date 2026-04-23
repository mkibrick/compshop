/**
 * Resolve the site's public base URL from NEXT_PUBLIC_SITE_URL, safely.
 *
 * We parse the env var through `new URL(...)` so a malformed value (e.g.
 * someone pasted a whole markdown doc into Vercel's UI, as has happened)
 * doesn't kill the build. On parse failure we log a warning and fall back
 * to localhost.
 */
function resolve(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return "http://localhost:3000";
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    return u.origin;
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      "[CompShop] NEXT_PUBLIC_SITE_URL is not a valid URL; falling back to localhost. Got:",
      trimmed.slice(0, 80)
    );
    return "http://localhost:3000";
  }
}

export const SITE_URL = resolve();
