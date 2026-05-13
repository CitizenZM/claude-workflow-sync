import type { CriticalIssue } from "@/lib/data";
import SectionHeader from "./SectionHeader";

function stripMarkdown(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
}

export default function CriticalPanel({ issues }: { issues: CriticalIssue[] }) {
  if (!issues.length) return null;
  return (
    <div className="rounded-2xl border border-red-500/30 bg-gray-900/80 p-5">
      <SectionHeader
        title="Critical Interventions"
        subtitle="今日必处理"
        badge={issues.length}
        badgeColor="red"
      />
      <div className="flex flex-col gap-3">
        {issues.map((item, i) => (
          <div key={i} className="rounded-xl bg-red-950/30 border border-red-500/20 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-400 border border-red-500/40">
                {item.num || i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                    {item.group}
                  </span>
                  <span className="text-xs text-gray-500">Since {item.waitingSince}</span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{stripMarkdown(item.issue)}</p>
                {item.owner && (
                  <p className="mt-1 text-xs text-gray-500">Owner: <span className="text-gray-400">{item.owner}</span></p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
