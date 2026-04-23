"use client";

import { useEffect, useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export default function ContactModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState(""); // hidden from real users
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Reset the form a beat after closing so users don't see stale content when
  // they reopen it.
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      if (status.kind === "ok") {
        setName("");
        setEmail("");
        setMessage("");
        setStatus({ kind: "idle" });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [open, status.kind]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          honeypot,
          source: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data.error ?? "Something went wrong.",
        });
        return;
      }
      setStatus({ kind: "ok" });
    } catch {
      setStatus({
        kind: "error",
        message: "Couldn't reach the server. Please try again.",
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">Contact CompShop</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Missing a vendor? Spot an error? Want to partner? Drop a note.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {status.kind === "ok" ? (
          <div className="p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-800 font-medium">Thanks, got it.</p>
            <p className="text-xs text-gray-500 mt-1">
              We&rsquo;ll reply if a response is needed.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 text-sm text-accent hover:text-accent-dark font-medium"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3">
            {/* Honeypot: hidden from real users, catches naive bots. */}
            <div
              aria-hidden="true"
              style={{ position: "absolute", left: "-10000px", top: "auto" }}
            >
              <label>
                Leave blank
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Name <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email <span className="text-gray-400">(if you want a reply)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                placeholder="What's on your mind?"
              />
            </div>

            {status.kind === "error" && (
              <p className="text-xs text-red-600">{status.message}</p>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status.kind === "submitting" || !message.trim()}
                className="text-sm bg-accent text-white font-semibold px-4 py-2 rounded-md hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status.kind === "submitting" ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
