interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  badgeColor?: "red" | "yellow" | "blue" | "green" | "gray";
}

const badgeColors = {
  red: "bg-red-500/20 text-red-400 border border-red-500/40",
  yellow: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40",
  blue: "bg-blue-500/20 text-blue-400 border border-blue-500/40",
  green: "bg-green-500/20 text-green-400 border border-green-500/40",
  gray: "bg-gray-500/20 text-gray-400 border border-gray-500/40",
};

export default function SectionHeader({ title, subtitle, badge, badgeColor = "gray" }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {badge !== undefined && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColors[badgeColor]}`}>{badge}</span>
      )}
      {subtitle && <span className="text-xs text-gray-500 ml-auto">{subtitle}</span>}
    </div>
  );
}
