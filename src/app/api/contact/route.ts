import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const TO_EMAIL = "mkibrick22@gmail.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "CompShop <onboarding@resend.dev>";
const MAX_MESSAGE_LEN = 4000;

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    email?: string;
    message?: string;
    honeypot?: string;
    source?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot — bots fill every field they see
  if (body.honeypot) {
    // Pretend success so bots don't retry
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const name = (body.name ?? "").trim().slice(0, 200);
  const email = (body.email ?? "").trim().slice(0, 200);
  const message = (body.message ?? "").trim().slice(0, MAX_MESSAGE_LEN);
  const source = (body.source ?? "").trim().slice(0, 200);

  if (!message) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email" },
      { status: 400 }
    );
  }

  const referer = request.headers.get("referer") ?? "";
  const ua = request.headers.get("user-agent") ?? "";

  // Structured log — always written so you can scan Vercel logs even if
  // Resend isn't configured yet.
  console.log(
    JSON.stringify({
      event: "contact_form_submission",
      name,
      email,
      messageLength: message.length,
      source,
      referer,
      ua,
      ts: new Date().toISOString(),
    })
  );

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Graceful fallback: no email sent, but submission is logged.
    console.warn(
      "[contact] RESEND_API_KEY not set — submission logged but email not sent"
    );
    return NextResponse.json({ ok: true, delivered: false }, { status: 200 });
  }

  try {
    const resend = new Resend(apiKey);
    const subject = name
      ? `CompShop contact: ${name}`
      : "CompShop contact (no name)";
    const plainBody = [
      `From: ${name || "(not provided)"}`,
      `Reply-to: ${email || "(not provided)"}`,
      `Source: ${source || referer || "(unknown)"}`,
      "",
      message,
    ].join("\n");

    await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: email || undefined,
      subject,
      text: plainBody,
    });
    return NextResponse.json({ ok: true, delivered: true }, { status: 200 });
  } catch (err) {
    console.error("[contact] Resend send failed:", err);
    // Don't leak internal error details to the user
    return NextResponse.json(
      { error: "We couldn't send your message. Please try again later." },
      { status: 500 }
    );
  }
}
