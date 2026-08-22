import { redirect } from "next/navigation";

/**
 * `/search` is retired. It used to host a second, report-level browse UI
 * (ProductResults) that duplicated `/surveys` and quietly drifted — the
 * roles feature and report-prose semantic matching lived only here, on a
 * noindex page almost nobody reached. Those capabilities now live on the
 * canonical `/surveys` directory, so this route permanently forwards
 * there, preserving any query/category so old links still land right.
 */
export const dynamic = "force-dynamic";

export default function SearchRedirect({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = new URLSearchParams();
  const q = searchParams.q;
  const category = searchParams.category;
  if (typeof q === "string" && q) params.set("q", q);
  if (typeof category === "string" && category) params.set("category", category);
  const qs = params.toString();
  redirect(`/surveys${qs ? `?${qs}` : ""}`);
}
