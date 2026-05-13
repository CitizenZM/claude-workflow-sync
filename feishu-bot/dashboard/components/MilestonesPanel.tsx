import type { Milestone } from "@/lib/data";
import SectionHeader from "./SectionHeader";

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("overdue")) return "text-red-400 bg-red-500/10 border-red-500/30";
  if (s.includes("live") || s.includes("done") || s.includes("complete")) return "text-green-400 bg-green-500/10 border-green-500/30";
  if (s.includes("progress") || s.includes("ramping") || s.includes("prep")) return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  return "text-gray-400 bg-gray-700/30 border-gray-600/30";
}

export default function MilestonesPanel({ milestones }: { milestones: Milestone[] }) {
  if (!milestones.length) return null;
  return (
    <div className="rounded-2xl border border-blue-500/30 bg-gray-900/80 p-5">
      <SectionHeader title="Upcoming Milestones" subtitle="7 days" badge={milestones.length} badgeColor="blue" />
      <div className="flex flex-col gap-2">
        {milestones.map((m, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg bg-gray-800/40 p-3 border border-gray-700/40">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 items-center mb-1">
                <span className="text-xs font-bold text-blue-400">{m.project}</span>
                <span className="text-xs text-white font-semibold">{m.dueDate}</span>
              </div>
              <p className="text-sm text-gray-300 mb-1">{m.milestone}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(m.status)}`}>
                {m.status.length > 60 ? m.status.slice(0, 60) + "…" : m.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
