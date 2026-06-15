"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, Campaign } from "@/types";
import { sendChatMessage } from "@/lib/api";
import AnalyticsChart from "./AnalyticsChart";

const SUGGESTED_PROMPTS = [
  { text: "Show me customers who haven't bought in 60 days", icon: "group_off", color: "text-primary" },
  { text: "Draft a re-engagement email campaign", icon: "mail", color: "text-tertiary" },
  { text: "Analyze Q3 marketing performance", icon: "monitoring", color: "text-secondary" },
  { text: "Identify high-value leads for expansion", icon: "bolt", color: "text-error" },
];

function parseEmbeddedCard(content: string): { type: string; data: Record<string, unknown> } | null {
  const match = content.match(/\[CARD:([\w_]+)\]([\s\S]*?)\[\/CARD\]/);
  if (!match) return null;
  try {
    return { type: match[1], data: JSON.parse(match[2]) };
  } catch {
    return null;
  }
}

function MessageBubble({ msg }: { msg: ChatMessage & { id: string } }) {
  const isUser = msg.role === "user";
  const card = isUser ? null : parseEmbeddedCard(msg.content);
  const textContent = msg.content.replace(/\[CARD:[\w_]+\][\s\S]*?\[\/CARD\]/, "").trim();

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start gap-4"}`}>
      {!isUser && (
        <div className="w-10 h-10 rounded-full bg-surface-container-highest flex-shrink-0 flex items-center justify-center border border-white/10 mt-1">
          <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
        </div>
      )}

      <div className={`space-y-4 max-w-[85%] ${isUser ? "" : ""}`}>
        {textContent && (
          <div
            className={`px-6 py-4 rounded-3xl text-body-md leading-relaxed whitespace-pre-wrap ${
              isUser
                ? "bg-primary-container text-white rounded-tr-sm shadow-lg shadow-primary/10"
                : "glass-panel text-on-surface rounded-tl-sm shadow-xl"
            }`}
          >
            {textContent}
          </div>
        )}

        {card?.type === "segment_preview" && (
          <div className="glass-panel rounded-2xl overflow-hidden border border-primary/20 max-w-sm">
            <div className="p-4 bg-primary/5 border-b border-white/5 flex justify-between items-center">
              <div>
                <h4 className="text-white font-bold text-sm">Audience Preview</h4>
                <p className="text-primary text-xs font-medium">Matching Customers</p>
              </div>
              <span className="material-symbols-outlined text-primary">data_thresholding</span>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{(card.data as { count: number }).count}</div>
                <div className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Total matched</div>
              </div>
            </div>
            {Array.isArray((card.data as { samples: string[] }).samples) && (
              <div className="px-6 pb-6 text-sm text-on-surface-variant/80">
                <p className="mb-2 font-medium">Sample Customers:</p>
                <div className="space-y-1">
                  {((card.data as { samples: string[] }).samples).slice(0, 4).map((name, i) => (
                    <p key={i}>• {name}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {card?.type === "campaign_created" && (
          <div className="glass-panel rounded-2xl overflow-hidden border border-tertiary/20 max-w-sm">
            <div className="p-4 bg-tertiary/5 border-b border-white/5 flex justify-between items-center">
              <div>
                <h4 className="text-white font-bold text-sm">Campaign Created</h4>
                <p className="text-tertiary text-xs font-medium">{(card.data as { name: string }).name}</p>
              </div>
              <span className="material-symbols-outlined text-tertiary">check_circle</span>
            </div>
            <div className="p-6 flex items-center gap-4">
              <span className="px-3 py-1 bg-primary/20 text-primary text-xs rounded-full border border-primary/30 font-bold uppercase tracking-wide">
                {(card.data as { channel: string }).channel}
              </span>
              <span className="px-3 py-1 bg-tertiary/20 text-tertiary text-xs rounded-full border border-tertiary/30 font-bold uppercase tracking-wide">
                {(card.data as { status: string }).status}
              </span>
            </div>
            {(card.data as { message: string }).message && (
              <div className="px-6 pb-6 text-sm text-on-surface-variant/80">
                {(card.data as { message: string }).message}
              </div>
            )}
          </div>
        )}

        {card?.type === "analytics" && (card.data as { campaign: Campaign }).campaign && (
          <div className="glass-panel rounded-2xl overflow-hidden border border-secondary/20 max-w-md">
            <div className="p-4 bg-secondary/5 border-b border-white/5 flex justify-between items-center">
              <div>
                <h4 className="text-white font-bold text-sm">Campaign Analytics</h4>
                <p className="text-secondary text-xs font-medium">{(card.data as { campaign: Campaign }).campaign.name}</p>
              </div>
              <span className="material-symbols-outlined text-secondary">analytics</span>
            </div>
            <div className="p-6">
              <AnalyticsChart campaign={(card.data as { campaign: Campaign }).campaign} compact />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const STORAGE_KEY = "campaignmind_chat";

// Detects messages whose content is raw HTML / a Next.js error page rather than
// a real chat reply. These got persisted before the API proxy fix and must be
// scrubbed so users don't keep seeing dumped 404 markup on load.
function isCorruptContent(content: unknown): boolean {
  if (typeof content !== "string") return true;
  return (
    content.includes("<script") ||
    content.includes("<html") ||
    content.includes("</html>") ||
    content.includes("dangerouslySetInnerHTML") ||
    content.includes("This page could not be found") ||
    content.includes("__next_f")
  );
}

function loadMessages(): (ChatMessage & { id: string })[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const clean = parsed.filter(
      (m) => m && typeof m === "object" && !isCorruptContent(m.content)
    );
    // If we dropped anything, rewrite storage so it stays clean.
    if (clean.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch {
    return [];
  }
}

export default function ChatInterface({ initialPrompt }: { initialPrompt?: string }) {
  const [messages, setMessages] = useState<(ChatMessage & { id: string })[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didLoad = useRef(false);
  // Stable ref so auto-send useEffect can call sendMessage without stale closure
  const sendFnRef = useRef<(text: string) => void>(() => {});

  // Load from localStorage after hydration (avoids SSR/client HTML mismatch)
  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    const saved = loadMessages();
    setMessages(saved);
    // Auto-send the prompt that came from ?prompt= URL param
    if (initialPrompt) {
      setTimeout(() => sendFnRef.current(initialPrompt), 80);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage whenever messages change (after first load)
  useEffect(() => {
    if (didLoad.current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to bottom on new messages or loading state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    const messageText = text.trim();
    if (!messageText || loading) return;
    setInput("");

    const userMsg: ChatMessage & { id: string } = {
      id: `u-${Date.now()}`,
      role: "user",
      content: messageText,
    };
    // Capture history BEFORE adding the new user message
    const history: ChatMessage[] = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await sendChatMessage(messageText, history);
      const reply = res.reply?.trim() || "Done! Let me know if you need anything else.";
      const aiMsg: ChatMessage & { id: string } = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("[chat error]", err);
      const raw = err instanceof Error ? err.message : "";
      const isHtmlOrUnknown = raw.includes("<") || raw.includes("404") || !raw;
      const errMsg: ChatMessage & { id: string } = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: isHtmlOrUnknown
          ? "Sorry, the AI agent is warming up (Render free tier cold start — ~30s). Please try again in a moment."
          : raw,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  // Keep the ref in sync with the latest sendMessage closure
  useEffect(() => {
    sendFnRef.current = sendMessage;
  }, [sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const showSuggestions = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      {/* Top App Bar */}
      <header className="absolute top-0 w-full z-30 bg-background/80 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-6 h-16">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-container rounded-lg flex items-center justify-center text-white font-bold text-xl">L</div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold tracking-tighter text-primary">LOOM</h1>
        </div>
        <button
          onClick={clearChat}
          className="flex items-center gap-2 bg-primary-container text-on-primary-container px-4 py-2 rounded-xl font-title-md text-sm hover:brightness-110 active:scale-95 transition-all duration-200"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Chat
        </button>
      </header>

      {/* Scrollable message area */}
      <div className="flex-1 mt-16 mb-28 overflow-y-auto px-4 lg:px-margin-safe py-8">
        <div className="w-full max-w-3xl mx-auto">

          {/* Empty / welcome state */}
          {showSuggestions && (
            <div className="flex flex-col items-center justify-center min-h-[520px] text-center space-y-8">
              <div className="w-24 h-24 bg-gradient-to-br from-primary-container to-secondary-container rounded-[2rem] flex items-center justify-center shadow-2xl shadow-primary/20">
                <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
              <div className="space-y-2">
                <h2 className="font-display-lg text-display-lg md:text-5xl text-white tracking-tight">CampaignMind AI</h2>
                <p className="text-on-surface-variant font-title-md max-w-md mx-auto">Describe your marketing goal and I&apos;ll help you execute it in seconds.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p.text)}
                    className="glass-panel text-left p-md rounded-2xl hover:bg-white/10 transition-all duration-300 group"
                  >
                    <span className={`material-symbols-outlined ${p.color} mb-2 block`}>{p.icon}</span>
                    <p className="text-white font-medium">{p.text}</p>
                    <span className="text-on-surface-variant text-xs mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Use prompt <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages — always rendered when there are messages */}
          {messages.length > 0 && (
            <div className="space-y-8">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </div>
          )}

          {/* Loading indicator — visible regardless of message count */}
          {loading && (
            <div className="flex justify-start w-full gap-4 mt-8">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex-shrink-0 flex items-center justify-center border border-white/10 mt-1">
                <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
              </div>
              <div className="glass-panel text-on-surface px-6 py-4 rounded-3xl rounded-tl-sm shadow-xl flex items-center gap-3">
                <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
                <span className="text-sm text-on-surface-variant">Analysing your request…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Fixed input bar */}
      <div className="absolute bottom-0 w-full z-40 px-4 md:px-gutter pb-8 pt-4 bg-gradient-to-t from-background via-background/90 to-transparent">
        <div className="w-full max-w-3xl mx-auto glass-panel rounded-2xl shadow-2xl p-2 flex items-center gap-2 ghost-border focus-within:border-primary/50 transition-colors">
          <button className="p-2 hover:bg-white/5 rounded-xl transition-colors text-on-surface-variant flex-shrink-0">
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <input
            id="chat-input"
            type="text"
            placeholder="Ask CampaignMind about your marketing..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && input.trim()) sendMessage(input); }}
            disabled={loading}
            className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-on-surface-variant/50 py-3 px-2 outline-none"
          />
          <button
            onClick={() => { if (input.trim()) sendMessage(input); }}
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-lg shadow-primary/20 active:scale-90 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined">arrow_upward</span>
          </button>
        </div>
        <p className="text-center text-[10px] text-on-surface-variant/40 mt-3 font-label-sm uppercase tracking-widest">Powered by Loom Intelligence AI v2.4</p>
      </div>
    </div>
  );
}
