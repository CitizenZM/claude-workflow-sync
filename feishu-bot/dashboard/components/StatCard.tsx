interface StatCardProps {
  label: string;
  value: string | number;
  color?: "red" | "yellow" | "green" | "blue" | "gray";
  icon?: string;
}

const colorMap = {
  red: "border-red-500 bg-red-950/40 text-red-300",
  yellow: "border-yellow-500 bg-yellow-950/40 text-yellow-300",
  green: "border-green-500 bg-green-950/40 text-green-300",
  blue: "border-blue-500 bg-blue-950/40 text-blue-300",
  gray: "border-gray-600 bg-gray-800/40 text-gray-300",
};

export default function StatCard({ label, value, color = "gray", icon }: StatCardProps) {
  return (
    <div className={`rounded-xl border ${colorMap[color]} p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-70">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
