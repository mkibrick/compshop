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
