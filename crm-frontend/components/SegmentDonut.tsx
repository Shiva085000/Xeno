"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface SegmentDonutProps {
  data: Record<string, number>;
}

const SEGMENT_COLORS: Record<string, string> = {
  high_value: "#f59e0b",
  at_risk:    "#ef4444",
  new:        "#10b981",
  regular:    "#6366f1",
};

const SEGMENT_LABELS: Record<string, string> = {
  high_value: "High Value",
  at_risk:    "At Risk",
  new:        "New",
  regular:    "Regular",
};

export default function SegmentDonut({ data }: SegmentDonutProps) {
  const chartData = Object.entries(data).map(([key, value]) => ({
    name: SEGMENT_LABELS[key] ?? key,
    value,
    color: SEGMENT_COLORS[key] ?? "#6b7280",
  }));

  return (
    <div className="flex items-center gap-4">
      <div className="flex-shrink-0" style={{ width: 140, height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={62}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#0f1422",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                color: "#e2e8f0",
                fontSize: 12,
              }}
              formatter={(value: number) => [value, "customers"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Manual legend */}
      <div className="flex flex-col gap-2">
        {chartData.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
            <span className="text-white/40 text-xs">{entry.name}</span>
            <span className="text-white/60 text-xs font-medium ml-1">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
