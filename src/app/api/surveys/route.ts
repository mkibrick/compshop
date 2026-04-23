import { NextRequest, NextResponse } from "next/server";
import { getAllSurveys, searchSurveys, createSurvey } from "@/lib/surveys";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  const surveys = q ? searchSurveys(q) : getAllSurveys();
  return NextResponse.json(surveys);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.provider || !body.title || !body.slug || !body.url) {
      return NextResponse.json(
        { error: "Missing required fields: provider, title, slug, url" },
        { status: 400 }
      );
    }

    const survey = createSurvey(body);
    return NextResponse.json(survey, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE constraint")) {
      return NextResponse.json(
        { error: "A survey with this slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
