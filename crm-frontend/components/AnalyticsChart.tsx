"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Campaign } from "@/types";

interface AnalyticsChartProps {
  campaign: Campaign;
  compact?: boolean;
}

const BARS = [
  { key: "sent_count", label: "Sent", color: "#6366f1" },
  { key: "delivered_count", label: "Delivered", color: "#8b5cf6" },
  { key: "opened_count", label: "Opened", color: "#a78bfa" },
  { key: "read_count", label: "Read", color: "#c4b5fd" },
  { key: "clicked_count", label: "Clicked", color: "#ddd6fe" },
];

export default function AnalyticsChart({ campaign, compact = false }: AnalyticsChartProps) {
  const data = BARS.map(({ key, label, color }) => ({
    label,
    value: campaign[key as keyof Campaign] as number,
    color,
  }));

  return (
    <ResponsiveContainer width="100%" height={compact ? 100 : 200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: "#94a3b8", fontSize: compact ? 9 : 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        {!compact && (
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid #1e2a3d",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 12,
            }}
            cursor={{ fill: "rgba(139, 92, 246, 0.1)" }}
          />
        )}
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
