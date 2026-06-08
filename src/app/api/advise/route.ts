import { NextRequest, NextResponse } from "next/server";
import { advise } from "@/lib/advisor";

export const dynamic = "force-dynamic";

const MAX_QUERY_LEN = 1500;
const DAILY_LIMIT_PER_IP = 5;

/**
 * In-memory IP throttle. Per-instance (Vercel scales horizontally, so
 * the effective limit is per-region per-cold-start) — acceptable for
 * v0. Swap to Vercel KV / Upstash if/when traffic warrants it.
 */
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkAndIncrementBucket(ip: string): {
  ok: boolean;
  remaining: number;
} {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + ONE_DAY_MS });
    return { ok: true, remaining: DAILY_LIMIT_PER_IP - 1 };
  }
  if (bucket.count >= DAILY_LIMIT_PER_IP) {
    return { ok: false, remaining: 0 };
  }
  bucket.count++;
  return { ok: true, remaining: DAILY_LIMIT_PER_IP - bucket.count };
}

export async function POST(request: NextRequest) {
  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const query = (body.query || "").trim().slice(0, MAX_QUERY_LEN);
  if (query.length < 10) {
    return NextResponse.json(
      { error: "Tell me a bit more about your situation (industry, size, region, role coverage)." },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const gate = checkAndIncrementBucket(ip);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error:
          "Daily limit reached. The Advisor allows 5 requests per day per visitor. Try again tomorrow or contact us.",
      },
      { status: 429 }
    );
  }

  try {
    const result = await advise(query);
    return NextResponse.json(
      { ...result, remaining: gate.remaining },
      { status: 200 }
    );
  } catch (err) {
    console.error("[advise] failure:", err);
    return NextResponse.json(
      {
        error:
          "The Advisor hit an error. Try rephrasing your question, or contact us if it persists.",
      },
      { status: 500 }
    );
  }
}
