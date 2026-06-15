"use client";

import { useEffect, useState, useCallback } from "react";
import { getCampaigns, getCampaign } from "@/lib/api";
import type { Campaign, CampaignAnalytics } from "@/types";
import CampaignCard from "@/components/CampaignCard";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "completed" | "sending" | "draft";

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "completed", label: "Completed" },
  { key: "sending",   label: "Sending" },
  { key: "draft",     label: "Draft" },
];

export default function CampaignsPage() {
  const [analytics, setAnalytics]   = useState<CampaignAnalytics[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]               = useState<StatusFilter>("all");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const campaigns = await getCampaigns();
      const data = await Promise.all(
        campaigns.map((c: Campaign) => getCampaign(c.id).catch(() => null))
      );
      setAnalytics(data.filter(Boolean) as CampaignAnalytics[]);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(() => load(true), 10_000);
    return () => clearInterval(iv);
  }, [load]);

  const visible = tab === "all"
    ? analytics
    : analytics.filter(a => a.campaign.status === tab);

  return (
    <div className="pt-8 pb-28 max-w-3xl mx-auto px-4 lg:px-0">
      {/* Section Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-headline-lg-mobile text-3xl font-bold text-on-surface">Campaigns</h1>
        <button 
          onClick={() => { setRefreshing(true); load(); }}
          disabled={refreshing}
          className="ghost-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-white/5 active:scale-95 transition-all text-primary disabled:opacity-50"
        >
          <span className={cn("material-symbols-outlined text-[18px]", refreshing && "animate-spin")}>refresh</span>
          <span className="font-label-sm text-xs uppercase tracking-widest font-bold">Refresh</span>
        </button>
      </div>

      {/* Segmented Tab Row */}
      <nav className="flex gap-2 overflow-x-auto pb-4 mb-6 custom-scroll scroll-hide">
        {TABS.map(({ key, label }) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-5 py-2 rounded-full font-label-sm text-xs font-bold whitespace-nowrap transition-all duration-200",
                isActive 
                  ? "bg-primary/20 text-primary active-tab-glow border border-primary/30" 
                  : "ghost-border text-on-surface-variant/70 hover:bg-white/5 hover:text-on-surface"
              )}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* Campaigns List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="glass-panel ghost-border rounded-xl h-32 animate-pulse bg-white/5" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 glass-panel ghost-border shadow-xl">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">campaign</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">No {tab === "all" ? "" : tab} campaigns</h3>
          <p className="text-on-surface-variant/70 text-sm max-w-xs mx-auto mb-6">You haven't launched any campaigns in this category yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(a => <CampaignCard key={a.campaign.id} analytics={a} onRefresh={() => load()} />)}
        </div>
      )}

      {/* Atmospheric Background Elements */}
      <div className="fixed bottom-32 -right-32 w-64 h-64 bg-primary/10 blur-[120px] rounded-full -z-10 pointer-events-none hidden lg:block"></div>
      <div className="fixed top-32 -left-32 w-64 h-64 bg-secondary/5 blur-[120px] rounded-full -z-10 pointer-events-none hidden lg:block"></div>
    </div>
  );
}
