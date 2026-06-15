"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getCustomerStats, getCampaigns, getCampaign, getSegments } from "@/lib/api";
import type { CustomerStats, Campaign, CampaignAnalytics, Segment } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const CHANNEL_ICON: Record<string, string> = {
  whatsapp: "chat",
  sms:      "sms",
  email:    "mail",
  rcs:      "chat",
};

export default function DashboardPage() {
  const [stats, setStats]     = useState<CustomerStats | null>(null);
  const [analytics, setAnalytics] = useState<CampaignAnalytics[]>([]);
  const [segments, setSegments]   = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [s, rawCampaigns, segs] = await Promise.all([
        getCustomerStats(),
        getCampaigns(),
        getSegments(),
      ]);
      const a = await Promise.all(
        (rawCampaigns as Campaign[]).slice(0, 5).map((c) => getCampaign(c.id).catch(() => null))
      );
      setStats(s as CustomerStats);
      setAnalytics((a as (CampaignAnalytics | null)[]).filter(Boolean) as CampaignAnalytics[]);
      setSegments(segs as Segment[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalGMV = analytics.reduce(
    (sum, a) => sum + (a.campaign.total_communications > 0 ? a.campaign.total_communications * 4500 : 0),
    0
  );
  const avgDelivery = analytics.length
    ? Math.round(analytics.reduce((s, a) => s + a.delivery_rate, 0) / analytics.length)
    : 0;

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const vipPercentage = stats && stats.total_customers > 0 
    ? Math.round((stats.by_segment["high_value"] || 0) / stats.total_customers * 100) : 0;
  const regularPercentage = stats && stats.total_customers > 0 
    ? Math.round((stats.by_segment["regular"] || 0) / stats.total_customers * 100) : 0;
  const riskPercentage = stats && stats.total_customers > 0 
    ? Math.round((stats.by_segment["at_risk"] || 0) / stats.total_customers * 100) : 0;

  // Circle circumferences
  const cVip = 502;
  const cReg = 377;
  const cRisk = 251;

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <span className="material-symbols-outlined text-5xl text-error">cloud_off</span>
      <p className="text-on-surface-variant">Could not reach the backend. It may be warming up — please retry in 30 seconds.</p>
      <button onClick={loadData} className="gradient-button px-6 py-2.5 rounded-xl text-white font-bold text-sm">Retry</button>
    </div>
  );

  return (
    <>
      <div className="absolute top-0 right-0 -z-10 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -z-10 w-[400px] h-[400px] bg-secondary-container/5 blur-[100px] rounded-full pointer-events-none"></div>

      {/* Header */}
      <header className="mb-10">
        <h1 className="font-display-lg text-display-lg lg:text-headline-lg gradient-text">Welcome back, LOOM</h1>
        <div className="flex items-center gap-2 text-on-surface-variant/80 mt-2">
          <span className="material-symbols-outlined text-sm">calendar_today</span>
          <p className="font-label-sm uppercase tracking-widest">{today}</p>
        </div>
      </header>

      {/* KPI Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        <div className="glass-card p-6 rounded-2xl group hover:border-primary/30 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <span className="material-symbols-outlined text-primary">groups</span>
            </div>
          </div>
          <p className="text-on-surface-variant text-sm mb-1">Total Customers</p>
          <h2 className="font-headline-lg text-on-surface">{stats?.total_customers ?? "—"}</h2>
          <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[70%] group-hover:w-[75%] transition-all duration-500"></div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl group hover:border-secondary/30 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-secondary-container/10 rounded-xl">
              <span className="material-symbols-outlined text-secondary">payments</span>
            </div>
          </div>
          <p className="text-on-surface-variant text-sm mb-1">Avg Customer Spend</p>
          <h2 className="font-headline-lg text-on-surface">{stats ? formatCurrency(stats.avg_spend) : "—"}</h2>
          <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="bg-secondary h-full w-[45%] group-hover:w-[50%] transition-all duration-500"></div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl group hover:border-tertiary/30 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-tertiary/10 rounded-xl">
              <span className="material-symbols-outlined text-tertiary">rocket_launch</span>
            </div>
            <span className="text-on-surface-variant text-xs font-bold bg-white/5 px-2 py-1 rounded-full">Monthly</span>
          </div>
          <p className="text-on-surface-variant text-sm mb-1">Campaigns Sent</p>
          <h2 className="font-headline-lg text-on-surface">{analytics.length || "—"}</h2>
          <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="bg-tertiary h-full w-[88%] group-hover:w-[92%] transition-all duration-500"></div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl group hover:border-primary-container/30 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary-container/10 rounded-xl">
              <span className="material-symbols-outlined text-primary-container">mail</span>
            </div>
          </div>
          <p className="text-on-surface-variant text-sm mb-1">Avg Delivery Rate</p>
          <h2 className="font-headline-lg text-on-surface">{avgDelivery}%</h2>
          <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="bg-primary-container h-full transition-all duration-500" style={{ width: `${avgDelivery}%` }}></div>
          </div>
        </div>
      </section>

      {/* Main Analytics Section */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-10">
        <div className="glass-card p-8 rounded-3xl xl:col-span-1">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-title-md text-on-surface">Audience Segments</h3>
            <Link href="/segments"><button className="material-symbols-outlined text-on-surface-variant">more_horiz</button></Link>
          </div>
          <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle className="text-primary/20" cx="96" cy="96" fill="transparent" r="80" stroke="currentColor" strokeWidth="12"></circle>
              <circle className="text-primary transition-all duration-1000" cx="96" cy="96" fill="transparent" r="80" stroke="currentColor" strokeDasharray={cVip} strokeDashoffset={cVip - (cVip * vipPercentage / 100)} strokeWidth="12"></circle>
              
              <circle className="text-secondary/20" cx="96" cy="96" fill="transparent" r="60" stroke="currentColor" strokeWidth="12"></circle>
              <circle className="text-secondary transition-all duration-1000" cx="96" cy="96" fill="transparent" r="60" stroke="currentColor" strokeDasharray={cReg} strokeDashoffset={cReg - (cReg * regularPercentage / 100)} strokeWidth="12"></circle>
              
              <circle className="text-tertiary/20" cx="96" cy="96" fill="transparent" r="40" stroke="currentColor" strokeWidth="12"></circle>
              <circle className="text-tertiary transition-all duration-1000" cx="96" cy="96" fill="transparent" r="40" stroke="currentColor" strokeDasharray={cRisk} strokeDashoffset={cRisk - (cRisk * riskPercentage / 100)} strokeWidth="12"></circle>
            </svg>
            <div className="absolute text-center">
              <p className="text-2xl font-bold">{stats?.total_customers ?? "—"}</p>
              <p className="text-[10px] uppercase text-on-surface-variant">Total</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 mt-10">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span className="text-sm font-medium">VIP Customers</span>
              </div>
              <span className="text-on-surface-variant">{vipPercentage}%</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-secondary"></div>
                <span className="text-sm font-medium">Regulars</span>
              </div>
              <span className="text-on-surface-variant">{regularPercentage}%</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-tertiary"></div>
                <span className="text-sm font-medium">Churn Risk</span>
              </div>
              <span className="text-on-surface-variant">{riskPercentage}%</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-8 rounded-3xl xl:col-span-2 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-title-md text-on-surface">Recent Campaigns</h3>
            <Link href="/campaigns"><button className="text-primary text-sm font-bold hover:underline">View All</button></Link>
          </div>
          <div className="overflow-x-auto scroll-hide flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="text-on-surface-variant text-xs uppercase tracking-widest border-b border-white/10">
                  <th className="pb-4 font-medium">Campaign Name</th>
                  <th className="pb-4 font-medium">Channel</th>
                  <th className="pb-4 font-medium">Sent</th>
                  <th className="pb-4 font-medium">Delivery</th>
                  <th className="pb-4 font-medium">Open Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {analytics.slice(0, 4).map(({ campaign, delivery_rate, open_rate }) => (
                  <tr key={campaign.id} className="hover:bg-white/[0.03] transition-colors group cursor-pointer">
                    <td className="py-5 pr-4">
                      <p className="text-sm font-bold text-on-surface">{campaign.name}</p>
                      <p className="text-xs text-on-surface-variant">{formatDate(campaign.created_at)}</p>
                    </td>
                    <td className="py-5 px-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">{CHANNEL_ICON[campaign.channel] || "campaign"}</span>
                        <span className="text-xs capitalize">{campaign.channel}</span>
                      </div>
                    </td>
                    <td className="py-5 px-2 text-sm">{campaign.total_communications}</td>
                    <td className="py-5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-white/10 rounded-full">
                          <div className="bg-tertiary h-full" style={{ width: `${delivery_rate}%` }}></div>
                        </div>
                        <span className="text-xs">{delivery_rate}%</span>
                      </div>
                    </td>
                    <td className="py-5 px-2 text-primary font-bold">{open_rate}%</td>
                  </tr>
                ))}
                {analytics.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-on-surface-variant text-sm">
                      No campaigns yet. <Link href="/chat" className="text-primary">Create one</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Quick Actions Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/chat" className="glass-card p-6 rounded-2xl flex flex-col items-center text-center group cursor-pointer hover:scale-[1.02] transition-transform active:scale-95">
          <div className="w-14 h-14 rounded-full gradient-button flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(124,58,237,0.4)]">
            <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
          </div>
          <h4 className="font-title-md font-bold text-on-surface">Launch AI Campaign</h4>
          <p className="text-on-surface-variant/70 text-sm mt-1">Generate targeted copy &amp; creative instantly.</p>
        </Link>
        <Link href="/customers" className="glass-card p-6 rounded-2xl flex flex-col items-center text-center group cursor-pointer hover:scale-[1.02] transition-transform active:scale-95">
          <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-primary text-2xl">person_search</span>
          </div>
          <h4 className="font-title-md font-bold text-on-surface">Browse Customers</h4>
          <p className="text-on-surface-variant/70 text-sm mt-1">Deep dive into your user base demographics.</p>
        </Link>
        <Link href="/segments" className="glass-card p-6 rounded-2xl flex flex-col items-center text-center group cursor-pointer hover:scale-[1.02] transition-transform active:scale-95">
          <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-primary text-2xl">grid_view</span>
          </div>
          <h4 className="font-title-md font-bold text-on-surface">Manage Segments</h4>
          <p className="text-on-surface-variant/70 text-sm mt-1">Update labels and dynamic scoring rules.</p>
        </Link>
      </section>
    </>
  );
}
