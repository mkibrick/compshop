"use client";

import { useState } from "react";

/**
 * "Your roles" input — the personalization payoff. The buyer pastes or
 * types the roles they need to benchmark; we then show "Covers N of
 * your roles" on every report and offer a coverage-first sort. Stored
 * locally (no account needed), so it's zero-friction.
 */
export default function RolesModal({
  initial,
  onSave,
  onClose,
}: {
  initial: string[];
  onSave: (roles: string[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial.join("\n"));

  function save() {
    const roles = Array.from(
      new Set(
        text
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 1)
      )
    ).slice(0, 40);
    onSave(roles);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-2xl text-navy" style={{ fontWeight: 400 }}>
            Your roles
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Add the roles you need to benchmark — one per line, or comma-separated.
          We&rsquo;ll show <strong>&ldquo;covers N of your roles&rdquo;</strong> on
          every survey and let you sort by best coverage. Saved on this device.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={"Software Engineer\nProduct Manager\nData Scientist\nCFO"}
          className="mt-3 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-plum-400 resize-none"
        />
        <div className="mt-4 flex items-center justify-between">
          {initial.length > 0 ? (
            <button
              onClick={() => {
                onSave([]);
                onClose();
              }}
              className="text-sm text-gray-500 hover:text-rose-600"
            >
              Clear roles
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={save}
            className="px-4 py-2 rounded-lg bg-plum-500 text-white font-medium hover:bg-plum-600"
          >
            Save roles
          </button>
        </div>
      </div>
    </div>
  );
}
