/**
 * Tracked outbound URL helpers.
 *
 * All outbound clicks to vendor sites flow through /go/<type>/<slug> on our
 * own domain. The redirect handler logs the click, appends UTMs, and 302s
 * to the destination. This gives us:
 *   - Server-side click counts per vendor + report (visible in Vercel logs
 *     today; pluggable into PostHog / Plausible / an analytics DB later)
 *   - UTM-tagged destination URLs so vendors see us in their own referral
 *     reports even if they can't parse the raw Referer header.
 */

/**
 * Vendors whose outbound clicks should always route to a single
 * destination — a participation / registration hub — rather than the
 * per-report product page or vendor homepage.
 *
 * Empsight is participation-gated: every survey requires participating
 * before you can purchase results, so a buyer's natural next step is
 * their Survey Participation Center, not an individual product page.
 * We keep the rich per-report product URLs in the DB (we scrape job
 * families from them) but funnel clicks here.
 *
 * Keyed by vendor slug. Applies to both /go/v and /go/r clicks.
 */
export const VENDOR_OUTBOUND_OVERRIDES: Record<string, string> = {
  empsight: "https://www.empsight.com/Survey-Participation-Center",
};

export function vendorOutbound(slug: string): string {
  return `/go/v/${encodeURIComponent(slug)}`;
}

export function reportOutbound(slug: string): string {
  return `/go/r/${encodeURIComponent(slug)}`;
}

/**
 * Given a destination URL, append CompShop UTMs so the vendor can attribute
 * the click in their analytics. Preserves any existing query parameters;
 * we only add UTMs that aren't already present (respects vendor overrides).
 */
export function addUtms(
  destination: string,
  opts: {
    campaign: "vendor_referral" | "report_referral";
    content?: string;
  }
): string {
  try {
    const url = new URL(destination);
    const setIfMissing = (k: string, v: string) => {
      if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    };
    setIfMissing("utm_source", "compshop");
    setIfMissing("utm_medium", "directory");
    setIfMissing("utm_campaign", opts.campaign);
    if (opts.content) setIfMissing("utm_content", opts.content);
    return url.toString();
  } catch {
    return destination;
  }
}
