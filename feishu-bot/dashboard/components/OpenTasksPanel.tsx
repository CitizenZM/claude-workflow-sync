import type { Task } from "@/lib/data";
import SectionHeader from "./SectionHeader";

function urgencyColor(urgency: string) {
  if (urgency === "critical") return "text-red-400 border-red-500/40 bg-red-500/10";
  if (urgency === "high") return "text-orange-400 border-orange-500/40 bg-orange-500/10";
  return "text-gray-500 border-gray-600/40 bg-gray-700/20";
}

export default function OpenTasksPanel({ tasksByGroup }: { tasksByGroup: Record<string, Task[]> }) {
  const groups = Object.entries(tasksByGroup);
  const total = groups.reduce((s, [, t]) => s + t.length, 0);
  if (!total) return null;
  return (
    <div className="rounded-2xl border border-gray-600/40 bg-gray-900/80 p-5">
      <SectionHeader title="Open Tasks by Group" badge={total} badgeColor="gray" />
      <div className="flex flex-col gap-4">
        {groups.map(([group, tasks]) => (
          <div key={group}>
            <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">{group}</div>
            <div className="flex flex-col gap-1.5">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2 rounded-lg bg-gray-800/30 p-2.5 border border-gray-700/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${urgencyColor(t.urgency)}`}>{t.urgency}</span>
                      {t.deadline && t.deadline !== "null" && (
                        <span className="text-xs text-gray-500">Due {t.deadline}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-200">{t.title}</p>
                    {t.owner && t.owner !== "null" && (
                      <p className="text-xs text-gray-500 mt-0.5">→ {t.owner}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
