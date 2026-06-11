// Participation is a neutral logistical fact, not a quality signal, so
// we avoid red (reads as "error/warning"). "Required" gets an
// informational blue, "Optional" a soft amber, "Not Required" a calm
// slate. Unknown / longer status strings fall back to slate.
const config: Record<string, { bg: string; text: string; dot: string }> = {
  Required: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  Optional: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  "Not Required": {
    bg: "bg-slate-100",
    text: "text-slate-600",
    dot: "bg-slate-400",
  },
};

export default function ParticipationBadge({ status }: { status: string }) {
  const style = config[status] ?? config["Not Required"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      Participation {status}
    </span>
  );
}
