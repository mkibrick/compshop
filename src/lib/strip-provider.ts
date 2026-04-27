/**
 * Drop a redundant leading provider name from a title.
 *
 * Used on the vendor page so report rows like
 *   "Milliman Health Insurance Industry Compensation Survey"
 * show as
 *   "Health Insurance Industry Compensation Survey"
 * when the user is already on the Milliman vendor page (the provider
 * context is implicit).
 *
 * Returns the original title if stripping would leave an empty string.
 * Case-insensitive. Tolerates an optional separator character ([-,:|·])
 * between the provider and the rest of the title.
 *
 * For vendors whose reports use a sub-brand prefix instead of the parent
 * provider (e.g., Aon's reports start with "McLagan" or "Radford", Croner
 * Company reports start with "Croner"), pass aliases in the second arg.
 */
export function stripProviderPrefix(
  title: string,
  provider: string,
  aliases: string[] = []
): string {
  const t = title.trim();
  if (!t) return t;
  const candidates = [provider, ...aliases]
    .map((s) => s.trim())
    .filter(Boolean);

  for (const p of candidates) {
    const re = new RegExp(
      `^${escapeRegex(p)}\\s*[-—,:|·]?\\s*`,
      "i"
    );
    const stripped = t.replace(re, "").trim();
    if (stripped !== t && stripped.length > 0) {
      return stripped;
    }
  }
  return t;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
