"use client";

import { useState, FormEvent } from "react";
import { ProductResult } from "@/lib/product-search";

/**
 * Tier-1 email capture — the money moment for the affiliate model.
 * Fires when the buyer tries to KEEP or ACT on their shortlist (save /
 * request intros), never while browsing. Email only; company/roles come
 * later at the personalization tier.
 *
 * "intro"     → we route the shortlist + intent to the vendors (lead).
 * "shortlist" → we email the buyer their own shortlist.
 */
export default function IntroCaptureModal({
  mode,
  reports,
  onClose,
}: {
  mode: "intro" | "shortlist";
  reports: ProductResult[];
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"form" | "sending" | "done" | "error">(
    "form"
  );
  const [error, setError] = useState("");

  const isIntro = mode === "intro";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email.");
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          email: email.trim(),
          name: name.trim(),
          company: company.trim(),
          reports: reports.map((r) => ({
            slug: r.slug,
            title: r.title,
            vendor: r.vendorProvider,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        setState("error");
      } else {
        setState("done");
      }
    } catch {
      setError("Network error. Try again.");
      setState("error");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-2xl text-navy" style={{ fontWeight: 400 }}>
            {isIntro ? "Request intros & pricing" : "Email me this shortlist"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {state === "done" ? (
          <div className="mt-4">
            <p className="text-ink-900">
              {isIntro
                ? "Got it — we'll reach out to connect you with these publishers and send pricing. Check your inbox for a confirmation."
                : "Sent. Your shortlist is on its way to your inbox."}
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-4 py-2 rounded-lg bg-plum-500 text-white font-medium hover:bg-plum-600"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-500">
              {isIntro
                ? "We'll connect you with the publishers below and get you pricing. No spam."
                : "We'll send these reports to your inbox so you can pick up where you left off."}
            </p>

            {reports.length > 0 && (
              <ul className="mt-3 mb-4 rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-32 overflow-y-auto">
                {reports.map((r) => (
                  <li key={r.slug} className="px-3 py-2 text-xs text-ink-900">
                    <span className="font-medium">{r.vendorProvider}</span> ·{" "}
                    {r.title}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={onSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-plum-400"
              />
              {isIntro && (
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name (optional)"
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-plum-400"
                  />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company (optional)"
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-plum-400"
                  />
                </div>
              )}
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={state === "sending"}
                className="w-full px-4 py-2.5 rounded-lg bg-plum-500 text-white font-medium hover:bg-plum-600 disabled:opacity-50"
              >
                {state === "sending"
                  ? "Sending…"
                  : isIntro
                  ? "Request intros"
                  : "Email me the shortlist"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
