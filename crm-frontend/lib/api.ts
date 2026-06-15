import type {
  Campaign,
  CampaignAnalytics,
  ChatMessage,
  ChatResponse,
  Customer,
  CustomerStats,
  Segment,
  SegmentPreview,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  options?: RequestInit,
  timeoutMs = 90_000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out after 90 seconds. The AI agent may still be processing — try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Customers
export const getCustomers = (params?: {
  segment?: string;
  city?: string;
  min_spend?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.segment) qs.set("segment", params.segment);
  if (params?.city) qs.set("city", params.city);
  if (params?.min_spend != null) qs.set("min_spend", String(params.min_spend));
  const query = qs.toString();
  return request<Customer[]>(`/api/customers${query ? `?${query}` : ""}`);
};

export const getCustomer = (id: number) =>
  request<Customer>(`/api/customers/${id}`);

export const getCustomerStats = () =>
  request<CustomerStats>("/api/customers/stats");

// Campaigns
export const getCampaigns = () => request<Campaign[]>("/api/campaigns");

export const getCampaign = (id: number) =>
  request<CampaignAnalytics>(`/api/campaigns/${id}`);

export const createCampaign = (payload: {
  name: string;
  description?: string;
  segment_rule: string;
  message_template: string;
  channel: string;
}) => request<Campaign>("/api/campaigns", { method: "POST", body: JSON.stringify(payload) });

export const sendCampaign = (id: number) =>
  request<{ message: string; campaign_id: number; status: string }>(
    `/api/campaigns/${id}/send`,
    { method: "POST" }
  );

// Segments
export const getSegments = () => request<Segment[]>("/api/segments");

export const previewSegment = (rule: Record<string, unknown>) =>
  request<SegmentPreview>("/api/segments/preview", {
    method: "POST",
    body: JSON.stringify({ segment_rule: rule }),
  });

// Chat
export const sendChatMessage = (
  message: string,
  conversation_history: ChatMessage[]
) =>
  request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, conversation_history }),
  });
