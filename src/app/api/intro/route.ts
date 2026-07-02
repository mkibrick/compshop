import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const TEAM_EMAIL = "mkibrick22@gmail.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "CompShop <hello@comp-shop.com>";

interface Body {
  mode?: "intro" | "shortlist";
  email?: string;
  name?: string;
  company?: string;
  reports?: { slug: string; title: string; vendor: string }[];
}

function reportsText(reports: Body["reports"]): string {
  return (reports ?? [])
    .map((r) => `• ${r.vendor} — ${r.title}\n  ${SITE_URL}/reports/${r.slug}`)
    .join("\n");
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode === "shortlist" ? "shortlist" : "intro";
  const email = (body.email ?? "").trim().slice(0, 200);
  const name = (body.name ?? "").trim().slice(0, 200);
  const company = (body.company ?? "").trim().slice(0, 200);
  const reports = (body.reports ?? []).slice(0, 20);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (reports.length === 0) {
    return NextResponse.json(
      { error: "Add at least one report to your shortlist first." },
      { status: 400 }
    );
  }

  // Structured log so leads are never lost even if email isn't configured.
  console.log(
    JSON.stringify({
      event: mode === "intro" ? "intro_request" : "shortlist_email",
      email,
      name,
      company,
      reportSlugs: reports.map((r) => r.slug),
      ts: new Date().toISOString(),
    })
  );

  const apiKey = process.env.RESEND_API_KEY ?? process.env.Resend_API;
  if (!apiKey) {
    console.warn("[intro] no Resend key; logged but not emailed");
    return NextResponse.json({ ok: true, delivered: false }, { status: 200 });
  }

  try {
    const resend = new Resend(apiKey);
    const list = reportsText(reports);

    if (mode === "shortlist") {
      // Send the buyer their own shortlist.
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Your CompShop survey shortlist",
        text: `Here are the compensation surveys you shortlisted on CompShop:\n\n${list}\n\nCompare them any time: ${SITE_URL}/search\n\n— CompShop`,
      });
    } else {
      // Lead: notify the CompShop team, and confirm to the buyer.
      await resend.emails.send({
        from: FROM_EMAIL,
        to: TEAM_EMAIL,
        replyTo: email,
        subject: `Intro request${company ? ` — ${company}` : ""}`,
        text: [
          `New intro / pricing request from ${name || "(no name)"} <${email}>`,
          company ? `Company: ${company}` : "",
          "",
          "Shortlisted surveys:",
          list,
        ]
          .filter(Boolean)
          .join("\n"),
      });
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "We're connecting you with these survey publishers",
        text: `Thanks${name ? `, ${name}` : ""} — we received your request and will connect you with pricing and intros for:\n\n${list}\n\n— CompShop`,
      });
    }
    return NextResponse.json({ ok: true, delivered: true }, { status: 200 });
  } catch (err) {
    console.error("[intro] send failed:", err);
    return NextResponse.json(
      { error: "Couldn't send right now. Please try again." },
      { status: 500 }
    );
  }
}
