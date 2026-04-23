const config: Record<string, { bg: string; text: string; dot: string }> = {
  Required: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  Optional: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  "Not Required": {
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
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
