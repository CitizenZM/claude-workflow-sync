import type { SlaItem } from "@/lib/data";
import SectionHeader from "./SectionHeader";

function stripMarkdown(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
}

export default function SlaPanel({ items }: { items: SlaItem[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-yellow-500/30 bg-gray-900/80 p-5">
      <SectionHeader title="Client SLA At Risk" subtitle="客户等待中" badge={items.length} badgeColor="yellow" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-700">
              <th className="pb-2 pr-4 font-semibold">Group</th>
              <th className="pb-2 pr-4 font-semibold">Blocked On</th>
              <th className="pb-2 pr-4 font-semibold whitespace-nowrap">Waiting</th>
              <th className="pb-2 font-semibold">Next Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
                <td className="py-2 pr-4 text-yellow-400 text-xs font-medium whitespace-nowrap">{item.group}</td>
                <td className="py-2 pr-4 text-gray-300 max-w-xs">{stripMarkdown(item.blocked)}</td>
                <td className="py-2 pr-4 text-gray-400 text-xs whitespace-nowrap">{item.daysWaiting}</td>
                <td className="py-2 text-gray-400 text-xs">{item.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
