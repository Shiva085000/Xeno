"use client";

import { useState } from "react";
import type { CampaignAnalytics } from "@/types";
import AnalyticsChart from "./AnalyticsChart";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { sendCampaign } from "@/lib/api";

interface CampaignCardProps {
  analytics: CampaignAnalytics;
}

const CHANNEL_STYLE: Record<string, { label: string; dot: string; text: string; bg: string; icon: string }> = {
  whatsapp: { label: "WhatsApp", dot: "bg-tertiary",   text: "text-tertiary",   bg: "bg-tertiary",   icon: "chat" },
  sms:      { label: "SMS",      dot: "bg-primary",    text: "text-primary",    bg: "bg-primary",    icon: "sms" },
  email:    { label: "Email",    dot: "bg-secondary",  text: "text-secondary",  bg: "bg-secondary",  icon: "mail" },
  rcs:      { label: "RCS",      dot: "bg-error",      text: "text-error",      bg: "bg-error",      icon: "chat" },
};

const STATUS_STYLE: Record<string, { label: string; dot: string; line: string }> = {
  draft:     { label: "Draft",     dot: "bg-outline", line: "bg-outline-variant" },
  sending:   { label: "Sending",   dot: "bg-primary animate-pulse", line: "bg-primary shadow-[2px_0_10px_rgba(210,187,255,0.3)]" },
  completed: { label: "Completed", dot: "bg-tertiary", line: "bg-tertiary shadow-[2px_0_10px_rgba(78,222,163,0.3)]" },
};

export default function CampaignCard({ analytics, onRefresh }: CampaignCardProps & { onRefresh?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const { campaign, delivery_rate, open_rate } = analytics;
  const ch = CHANNEL_STYLE[campaign.channel] ?? { label: campaign.channel, dot: "bg-outline", text: "text-on-surface-variant", bg: "bg-outline", icon: "campaign" };
  const st = STATUS_STYLE[campaign.status] ?? { label: campaign.status, dot: "bg-outline", line: "bg-outline-variant" };
  const total = campaign.total_communications;
  const noAudience = campaign.status !== "draft" && total === 0;

  return (
    <div className={cn(
      "glass-panel ghost-border rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden group cursor-pointer transition-colors duration-200 hover:bg-white/5",
      campaign.status === "draft" && "opacity-80"
    )} onClick={() => setExpanded(!expanded)}>
      <div className={cn("absolute top-0 left-0 w-1 h-full", st.line)}></div>
      
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center ${ch.text}`}>
            <span className="material-symbols-outlined">{ch.icon}</span>
          </div>
          <div>
            <h3 className="font-title-md text-on-surface font-bold">{campaign.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${st.dot}`}></span>
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider">{st.label}</span>
            </div>
          </div>
        </div>
        
        {noAudience ? (
          <div className="text-right">
            <span className="material-symbols-outlined text-on-surface-variant/40 text-2xl">person_off</span>
          </div>
        ) : campaign.status !== "draft" ? (
          <div className="text-right">
            <div className={`font-display-lg text-2xl leading-none font-bold ${ch.text}`}>{delivery_rate}%</div>
            <div className="font-label-sm text-[10px] text-on-surface-variant mt-1 uppercase tracking-wider">Delivery</div>
          </div>
        ) : (
          <div className="text-right opacity-30">
            <div className="font-display-lg text-2xl text-on-surface leading-none font-bold">--%</div>
            <div className="font-label-sm text-[10px] text-on-surface-variant mt-1 uppercase tracking-wider">Expected</div>
          </div>
        )}
      </div>

      {noAudience && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-error/10 border border-error/20">
          <span className="material-symbols-outlined text-error text-sm">group_off</span>
          <p className="text-error text-xs font-bold">No customers matched the segment rule — campaign sent to 0 recipients.</p>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <p className="font-label-sm text-xs text-on-surface-variant">Recipients: <span className="text-on-surface">{total.toLocaleString()}</span></p>
          <p className="font-label-sm text-xs text-on-surface-variant">Sent: <span className="text-on-surface">{formatDate(campaign.created_at)}</span></p>
        </div>
        
        {campaign.status !== "draft" ? (
          <div className="text-right">
            <div className="font-display-lg text-2xl text-primary leading-none font-bold">{open_rate}%</div>
            <div className="font-label-sm text-[10px] text-on-surface-variant mt-1 uppercase tracking-wider">Open Rate</div>
          </div>
        ) : (
          <div className="text-right">
            <button
              disabled={sending}
              className="bg-surface-container-highest text-primary px-3 py-1.5 rounded-md font-label-sm text-xs font-bold hover:bg-primary/10 transition-colors disabled:opacity-50"
              onClick={async (e) => {
                e.stopPropagation();
                setSending(true);
                try {
                  await sendCampaign(campaign.id);
                  onRefresh?.();
                } catch (err) {
                  console.error("Failed to send campaign:", err);
                } finally {
                  setSending(false);
                }
              }}
            >
              {sending ? "Launching…" : "Resume"}
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t mt-4 pt-4 px-2 space-y-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {/* Rate pills */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Delivered", value: `${delivery_rate}%`, color: "text-tertiary" },
              { label: "Opened",    value: `${open_rate}%`,     color: "text-primary" },
              { label: "Read",      value: `${analytics.read_rate}%`,     color: "text-secondary"   },
              { label: "Clicked",   value: `${analytics.click_rate}%`,    color: "text-error"},
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center p-3 rounded-xl bg-surface-container-highest/50">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-on-surface-variant text-[10px] mt-1 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-widest mb-3 font-bold">Engagement Breakdown</p>
            <AnalyticsChart campaign={campaign} />
          </div>

          {/* Message preview */}
          <div className="rounded-xl p-4 bg-surface-container-highest/50 ghost-border">
            <p className="text-on-surface-variant text-[10px] uppercase tracking-widest mb-2 font-bold">Message Template</p>
            <p className="text-on-surface text-sm leading-relaxed whitespace-pre-wrap">{campaign.message_template}</p>
          </div>
        </div>
      )}
    </div>
  );
}
