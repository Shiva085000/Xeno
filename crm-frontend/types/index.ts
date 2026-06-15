export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  segment_tag: "high_value" | "at_risk" | "new" | "regular";
  total_spend: number;
  last_purchase_date: string | null;
  created_at: string;
}

export interface CustomerStats {
  total_customers: number;
  by_segment: Record<string, number>;
  avg_spend: number;
  cities: string[];
}

export interface Order {
  id: number;
  customer_id: number;
  amount: number;
  product_name: string;
  category: string;
  ordered_at: string;
}

export interface Campaign {
  id: number;
  name: string;
  description: string | null;
  segment_rule: string;
  message_template: string;
  channel: "whatsapp" | "sms" | "email" | "rcs";
  status: "draft" | "sending" | "completed";
  created_at: string;
  total_communications: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  opened_count: number;
  read_count: number;
  clicked_count: number;
}

export interface CampaignAnalytics {
  campaign: Campaign;
  delivery_rate: number;
  open_rate: number;
  read_rate: number;
  click_rate: number;
}

export interface Communication {
  id: number;
  campaign_id: number;
  customer_id: number;
  message: string;
  channel: string;
  status: "pending" | "sent" | "delivered" | "failed" | "opened" | "read" | "clicked";
  sent_at: string | null;
  updated_at: string | null;
}

export interface Segment {
  tag: string;
  label: string;
  description: string;
  color: string;
  rule: Record<string, unknown>;
  count: number;
}

export interface SegmentPreview {
  count: number;
  sample_customers: Customer[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  action: Record<string, unknown> | null;
}
