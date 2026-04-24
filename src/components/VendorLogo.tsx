"use client";

import { useState } from "react";

/**
 * Manual overrides: vendors whose product-catalog URL doesn't have a great
 * favicon. We map to the parent brand domain or a better-branded domain.
 */
const DOMAIN_OVERRIDES: Record<string, string> = {
  gallagher: "ajg.com",
  "pearl meyer": "pearlmeyer.com",
  sullivancotter: "sullivancotter.com",
  mgma: "mgma.com",
  mra: "mranet.org",
  mercer: "imercer.com",
  "u.s. bureau of labor statistics": "bls.gov",
  compdata: "salary.com",
  "croner reward": "croner.co.uk",
};

// Double-suffix public TLDs where "last two labels" would return the
// wrong domain (e.g. "co.uk" instead of "croner.co.uk"). Keep as last
// two labels === three total labels case.
const DOUBLE_TLDS = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "co.jp",
  "co.kr",
  "com.au",
  "net.au",
  "com.br",
  "com.mx",
  "com.sg",
  "com.hk",
  "co.in",
  "co.nz",
  "co.za",
]);

/**
 * Extract the registrable domain from a URL string.
 * For sub-sites like store.salary.com, we return the eTLD+1 (salary.com) so the
 * favicon service returns the brand logo rather than a subdomain-specific one.
 */
function deriveDomain(name: string, url: string): string | null {
  const override = DOMAIN_OVERRIDES[name.trim().toLowerCase()];
  if (override) return override;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length <= 2) return host;
    // If the last two labels form a known double-suffix TLD (e.g. "co.uk"),
    // keep three labels so we return e.g. "croner.co.uk" not "co.uk".
    const lastTwo = parts.slice(-2).join(".");
    if (DOUBLE_TLDS.has(lastTwo) && parts.length >= 3) {
      return parts.slice(-3).join(".");
    }
    return lastTwo;
  } catch {
    return null;
  }
}

function initial(name: string): string {
  return (name || "?").trim().charAt(0).toUpperCase();
}

const PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function VendorLogo({
  name,
  url,
  size = 48,
}: {
  name: string;
  url: string;
  size?: number;
}) {
  const domain = deriveDomain(name, url);
  const [failed, setFailed] = useState(false);

  const sizeStyle = { width: size, height: size };

  if (!domain || failed) {
    return (
      <div
        style={sizeStyle}
        className={`rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0 ${colorFor(
          name
        )}`}
        aria-hidden
      >
        {initial(name)}
      </div>
    );
  }

  // Google's favicon service: free, no auth, returns PNG up to 256px
  const src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  return (
    <div
      style={sizeStyle}
      className="flex items-center justify-center overflow-hidden flex-shrink-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${name} logo`}
        style={{ maxWidth: "100%", maxHeight: "100%" }}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    </div>
  );
}
