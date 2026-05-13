import type { UnansweredQ } from "@/lib/data";
import SectionHeader from "./SectionHeader";

export default function UnansweredPanel({ questions }: { questions: UnansweredQ[] }) {
  if (!questions.length) return null;
  return (
    <div className="rounded-2xl border border-orange-500/30 bg-gray-900/80 p-5">
      <SectionHeader title="Unanswered Questions" subtitle=">24h" badge={questions.length} badgeColor="yellow" />
      <div className="flex flex-col gap-2">
        {questions.map((q, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg bg-gray-800/50 p-3 border border-gray-700/40">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs text-orange-400">?</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 items-center mb-0.5">
                <span className="text-xs font-semibold text-orange-400">{q.group}</span>
                <span className="text-xs text-gray-500">· {q.askedBy} · {q.hoursWaiting}</span>
              </div>
              <p className="text-sm text-gray-300">{q.question}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
