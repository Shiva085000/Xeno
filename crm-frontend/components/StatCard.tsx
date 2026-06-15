import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: string; positive: boolean };
}

export default function StatCard({
  label, value, sub, icon: Icon, iconColor = "text-violet-400", iconBg = "bg-violet-500/10", trend,
}: StatCardProps) {
  return (
    <div className="glass-card p-5 flex flex-col gap-4 hover:border-white/[0.11] transition-colors duration-200">
      <div className="flex items-start justify-between">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", iconBg)}>
          <Icon className={cn("w-4.5 h-4.5", iconColor)} />
        </div>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            trend.positive
              ? "text-emerald-400 bg-emerald-500/10"
              : "text-red-400 bg-red-500/10"
          )}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-white/40 text-xs mt-0.5 font-medium uppercase tracking-wide">{label}</p>
        {sub && <p className="text-white/25 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}
