import type { WorkloadPerson } from "@/lib/data";
import SectionHeader from "./SectionHeader";

function loadBadge(load: string) {
  const l = load.toLowerCase();
  if (l.includes("very high")) return "bg-red-500/20 text-red-400 border-red-500/40";
  if (l.includes("high")) return "bg-orange-500/20 text-orange-400 border-orange-500/40";
  if (l.includes("moderate-high") || l.includes("moderate high")) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
  if (l.includes("moderate")) return "bg-blue-500/20 text-blue-400 border-blue-500/40";
  return "bg-gray-600/20 text-gray-400 border-gray-600/40";
}

export default function WorkloadPanel({ people }: { people: WorkloadPerson[] }) {
  if (!people.length) return null;
  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gray-900/80 p-5">
      <SectionHeader title="Team Workload" subtitle="人员负荷" badge={people.length} badgeColor="gray" />
      <div className="flex flex-col gap-2">
        {people.map((p, i) => (
          <div key={i} className="rounded-lg bg-gray-800/40 border border-gray-700/40 p-3">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-bold text-white">{p.person}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${loadBadge(p.load)}`}>{p.load}</span>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{p.signal}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
