import { NextRequest, NextResponse } from "next/server";
import { getSurveyBySlug, updateSurvey, deleteSurvey } from "@/lib/surveys";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const survey = getSurveyBySlug(params.slug);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }
  return NextResponse.json(survey);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();
    const survey = updateSurvey(params.slug, body);
    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }
    return NextResponse.json(survey);
  } catch (e: any) {
    if (e.message?.includes("UNIQUE constraint")) {
      return NextResponse.json(
        { error: "A survey with this slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const deleted = deleteSurvey(params.slug);
  if (!deleted) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
