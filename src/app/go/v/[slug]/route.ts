import { NextRequest, NextResponse } from "next/server";
import { getSurveyBySlug } from "@/lib/surveys";
import { addUtms } from "@/lib/outbound";

export const dynamic = "force-dynamic";

/**
 * Tracked outbound click handler for vendor links.
 * GET /go/v/<vendor-slug> → 302 redirect to the vendor's site with UTMs.
 */
export function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const vendor = getSurveyBySlug(params.slug);
  if (!vendor) {
    return NextResponse.redirect(new URL("/surveys", request.url), 302);
  }

  const destination = addUtms(vendor.url, {
    campaign: "vendor_referral",
    content: vendor.slug,
  });

  // Structured click log: visible in Vercel's Runtime Logs. Easy to parse
  // later with `vercel logs | grep '"event":"outbound_click"'` or to swap
  // for a PostHog / Plausible / webhook write.
  console.log(
    JSON.stringify({
      event: "outbound_click",
      type: "vendor",
      slug: vendor.slug,
      provider: vendor.provider,
      destination,
      referer: request.headers.get("referer") ?? null,
      ua: request.headers.get("user-agent") ?? null,
      ts: new Date().toISOString(),
    })
  );

  return NextResponse.redirect(destination, 302);
}
