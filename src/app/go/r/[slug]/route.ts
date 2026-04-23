import { NextRequest, NextResponse } from "next/server";
import { getReportBySlug } from "@/lib/reports";
import { getSurveyBySlug } from "@/lib/surveys";
import { addUtms } from "@/lib/outbound";

export const dynamic = "force-dynamic";

/**
 * Tracked outbound click handler for report links.
 * GET /go/r/<report-slug> → 302 redirect to the report's vendor product page
 * (or vendor homepage if the report has no direct URL), with UTMs appended.
 */
export function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const report = getReportBySlug(params.slug);
  if (!report) {
    return NextResponse.redirect(new URL("/surveys", request.url), 302);
  }
  const vendor = getSurveyBySlug(report.surveySlug);

  const rawDestination = report.url || vendor?.url || "/surveys";
  const destination = addUtms(rawDestination, {
    campaign: "report_referral",
    content: report.slug,
  });

  console.log(
    JSON.stringify({
      event: "outbound_click",
      type: "report",
      slug: report.slug,
      vendorSlug: vendor?.slug ?? null,
      vendorProvider: vendor?.provider ?? null,
      destination,
      referer: request.headers.get("referer") ?? null,
      ua: request.headers.get("user-agent") ?? null,
      ts: new Date().toISOString(),
    })
  );

  return NextResponse.redirect(destination, 302);
}
