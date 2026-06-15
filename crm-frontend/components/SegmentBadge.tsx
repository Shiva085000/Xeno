import { cn } from "@/lib/utils";

interface SegmentBadgeProps {
  tag: string;
  className?: string;
}

const SEGMENT_STYLES: Record<string, string> = {
  high_value: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  at_risk: "bg-red-500/15 text-red-400 border-red-500/30",
  new: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  regular: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const SEGMENT_LABELS: Record<string, string> = {
  high_value: "High Value",
  at_risk: "At Risk",
  new: "New",
  regular: "Regular",
};

export default function SegmentBadge({ tag, className }: SegmentBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        SEGMENT_STYLES[tag] ?? "bg-white/10 text-white/60 border-white/20",
        className
      )}
    >
      {SEGMENT_LABELS[tag] ?? tag}
    </span>
  );
}
