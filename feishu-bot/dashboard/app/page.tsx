import { parseDashboardMd, loadDashboardMd } from "@/lib/data";
import StatCard from "@/components/StatCard";
import CriticalPanel from "@/components/CriticalPanel";
import SlaPanel from "@/components/SlaPanel";
import UnansweredPanel from "@/components/UnansweredPanel";
import MilestonesPanel from "@/components/MilestonesPanel";
import WorkloadPanel from "@/components/WorkloadPanel";
import OpenTasksPanel from "@/components/OpenTasksPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Dashboard() {
  const md = loadDashboardMd();
  const data = parseDashboardMd(md);
  const totalTasks = data.allTasks.length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">飞</div>
              <div>
                <h1 className="text-sm font-bold text-white">Feishu Bot Management</h1>
                <p className="text-xs text-gray-500">Operations Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {data.generatedAt && <span>Updated: {data.generatedAt}</span>}
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></span>
                Live
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Critical" value={data.criticalIssues.length} color="red" icon="🚨" />
          <StatCard label="SLA at Risk" value={data.slaAtRisk.length} color="yellow" icon="⚠️" />
          <StatCard label="Unanswered" value={data.unansweredQuestions.length} color="yellow" icon="❓" />
          <StatCard label="Open Tasks" value={totalTasks} color="blue" icon="📋" />
          <StatCard label="Milestones" value={data.milestones.length} color="blue" icon="🎯" />
          <StatCard
            label="Active Groups"
            value={data.stats["Active groups (last 7 days)"] || data.activeThreads || "—"}
            color="green"
            icon="💬"
          />
        </div>

        {/* Overdue P0 banner */}
        {data.stats["Overdue Bitable P0 tasks"] && data.stats["Overdue Bitable P0 tasks"] !== "0" && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm">
            <span className="text-red-400 font-bold">🔴 OVERDUE P0:</span>
            <span className="text-red-300">
              {data.stats["Overdue Bitable P0 tasks"]} Bitable task(s) past deadline — escalate to Barron/Mingyi immediately
            </span>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CriticalPanel issues={data.criticalIssues} />
          <div className="flex flex-col gap-5">
            <UnansweredPanel questions={data.unansweredQuestions} />
            <MilestonesPanel milestones={data.milestones} />
          </div>
        </div>

        <SlaPanel items={data.slaAtRisk} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <OpenTasksPanel tasksByGroup={data.openTasksByGroup} />
          </div>
          <WorkloadPanel people={data.workload} />
        </div>

        {/* Session Stats Footer */}
        {Object.keys(data.stats).length > 0 && (
          <div className="rounded-2xl border border-gray-700/40 bg-gray-900/60 p-5">
            <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Session Stats</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(data.stats).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-gray-800/40 p-3 border border-gray-700/30">
                  <div className="text-xs text-gray-500 mb-0.5">{k}</div>
                  <div className="text-sm font-semibold text-gray-200">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
