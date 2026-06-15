"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSegments } from "@/lib/api";
import type { Segment } from "@/types";
import { cn } from "@/lib/utils";

const META: Record<string, {
  icon: string;
  color: string;
  bg: string;
  keyMetric: string;
  prompt: string;
}> = {
  high_value: {
    icon: "crown",
    color: "text-primary",
    bg: "bg-primary",
    keyMetric: "Spend >= $15k",
    prompt: "Create a VIP exclusive preview campaign for our high-value customers via WhatsApp",
  },
  at_risk: {
    icon: "warning",
    color: "text-error",
    bg: "bg-error",
    keyMetric: "Lapse > 60d",
    prompt: "Create a win-back campaign for at-risk customers who haven't bought in 60 days",
  },
  new: {
    icon: "auto_awesome",
    color: "text-tertiary",
    bg: "bg-tertiary",
    keyMetric: "Joined < 30d",
    prompt: "Create a warm welcome offer campaign for our new customers in Mumbai via WhatsApp",
  },
  regular: {
    icon: "star",
    color: "text-secondary",
    bg: "bg-secondary",
    keyMetric: "Freq > 1/mo",
    prompt: "Create a loyalty rewards campaign for our regular customers",
  },
};

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading]   = useState(true);
  const router = useRouter();

  useEffect(() => {
    getSegments().then(setSegments).catch(console.error).finally(() => setLoading(false));
  }, []);

  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="pt-8 pb-32 px-4 lg:px-0 max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <section className="space-y-1 mb-8">
        <h1 className="font-headline-lg text-3xl md:text-5xl font-bold text-on-surface tracking-tight">Segments</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Audience groups defined by purchase behaviour</p>
      </section>

      {loading ? (
        <div className="glass-panel ghost-border rounded-xl h-32 animate-pulse bg-white/5" />
      ) : (
        <>
          {/* Distribution Panel */}
          <section className="glass-panel ghost-border rounded-xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h3 className="font-title-md text-on-surface font-bold">Total Addressable Audience</h3>
                <p className="text-4xl font-bold text-primary mt-1">{total.toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-label-sm uppercase tracking-widest text-on-surface-variant/60">
                {segments.map(s => {
                  const m = META[s.tag];
                  return (
                    <div key={s.tag} className="flex items-center gap-2">
                      <span className={cn("w-3 h-3 rounded-full", m?.bg || "bg-white/30")} />
                      {s.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stacked Bar Chart */}
            <div className="w-full h-10 flex rounded-full overflow-hidden ghost-border bg-surface-container-highest">
              {segments.map(s => {
                const m = META[s.tag];
                const pct = total > 0 ? (s.count / total) * 100 : 0;
                return (
                  <div
                    key={s.tag}
                    className={cn("h-full transition-all duration-1000 ease-out hover:brightness-110 cursor-pointer", m?.bg || "bg-white/30")}
                    style={{ width: `${pct}%` }}
                    title={`${s.label}: ${s.count} (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
          </section>

          {/* Segment Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {segments.map(seg => {
              const m = META[seg.tag];
              if (!m) return null;
              const pct = total > 0 ? ((seg.count / total) * 100).toFixed(1) : "0.0";
              const bgColorClass = m.bg.replace("bg-", ""); // extract color name for border hover

              return (
                <div key={seg.tag} className={cn(
                  "glass-panel ghost-border rounded-xl p-6 flex flex-col justify-between group transition-all duration-300",
                  `hover:border-${bgColorClass}/30`
                )}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className={cn("p-3 rounded-lg", `${m.bg}/10`, m.color)}>
                        <span className="material-symbols-outlined">{m.icon}</span>
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                        `${m.bg}/20`, m.color, `border-${bgColorClass}/20`
                      )}>
                        {m.keyMetric}
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <h4 className="font-title-md text-on-surface font-bold">{seg.label}</h4>
                        <span className="font-label-sm text-xs text-on-surface-variant font-bold">
                          {seg.count.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <p className="font-body-md text-on-surface-variant text-sm mb-4">
                        {seg.description}
                      </p>
                      <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", m.bg)} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => router.push(`/chat?prompt=${encodeURIComponent(m.prompt)}`)}
                    className={cn("mt-6 flex items-center gap-2 font-bold text-sm hover:underline transition-all w-fit", m.color)}
                  >
                    Create Campaign <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
