import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.prebuilt import create_react_agent
from sqlalchemy.orm import Session

load_dotenv()
logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
CRM_BASE_URL = os.getenv("CRM_BASE_URL", "http://localhost:8000")

_db_session: Optional[Session] = None


def set_db_session(db: Session):
    global _db_session
    _db_session = db


def get_db() -> Session:
    if _db_session is None:
        raise RuntimeError("DB session not set")
    return _db_session


# ── Tools ─────────────────────────────────────────────────────────────────────

@tool
def segment_customers_tool(
    min_spend: Optional[float] = None,
    max_days_since_purchase: Optional[int] = None,
    city: Optional[str] = None,
    segment_tag: Optional[str] = None,
    min_orders: Optional[int] = None,
) -> str:
    """
    Query customers matching given criteria and return count + sample.
    Use this FIRST to show audience size before creating any campaign.

    Args:
        min_spend: minimum total spend in INR
        max_days_since_purchase: customers who last purchased within this many days
        city: filter by city name
        segment_tag: one of high_value, at_risk, new, regular
        min_orders: minimum number of orders placed
    """
    from models import Customer, Order
    from sqlalchemy import func as sqlfunc

    db = get_db()
    query = db.query(Customer)

    if min_spend is not None:
        query = query.filter(Customer.total_spend >= min_spend)
    if city:
        query = query.filter(Customer.city.ilike(f"%{city}%"))
    if segment_tag:
        query = query.filter(Customer.segment_tag == segment_tag)
    if max_days_since_purchase is not None:
        cutoff = datetime.utcnow() - timedelta(days=max_days_since_purchase)
        query = query.filter(Customer.last_purchase_date >= cutoff)
    if min_orders is not None:
        order_counts = (
            db.query(Order.customer_id, sqlfunc.count(Order.id).label("cnt"))
            .group_by(Order.customer_id)
            .subquery()
        )
        query = query.join(order_counts, Customer.id == order_counts.c.customer_id).filter(
            order_counts.c.cnt >= min_orders
        )

    total = query.count()
    sample = query.limit(5).all()
    sample_data = [
        {"id": c.id, "name": c.name, "city": c.city, "segment": c.segment_tag, "spend": c.total_spend}
        for c in sample
    ]

    return json.dumps({"count": total, "sample_customers": sample_data})


@tool
def draft_message_tool(segment_description: str, channel: str, brand: str = "LOOM") -> str:
    """
    Generate a personalised marketing message for a given audience segment and channel.

    Args:
        segment_description: plain-english description of the audience
        channel: one of whatsapp, sms, email, rcs
        brand: brand name (default LOOM)
    """
    channel_hints = {
        "whatsapp": "conversational, use emojis sparingly, keep under 300 chars",
        "sms": "very short, max 160 chars, clear CTA",
        "email": "friendly, up to 200 chars",
        "rcs": "rich card style, engaging, up to 400 chars",
    }
    hint = channel_hints.get(channel, "concise and friendly")

    if channel == "sms":
        message = f"Hi {{name}}, {brand} misses you! Get 20% OFF today. Code: COMEBACK20. Shop: loom.in"
    else:
        message = (
            f"Hi {{name}}, we miss you at {brand}! 🧵 "
            f"As one of our valued {segment_description} customers, "
            f"enjoy an exclusive 20% OFF your next purchase. "
            f"Shop now: loom.in/offer — Valid for 48 hours only! ✨"
        )

    return json.dumps({"message_template": message, "channel": channel, "hint": hint})


@tool
def create_campaign_tool(
    name: str,
    description: str,
    segment_rule_json: str,
    message_template: str,
    channel: str,
) -> str:
    """
    Create a new campaign in the database. Only call after marketer confirms.

    Args:
        name: campaign name
        description: brief description
        segment_rule_json: JSON string with keys: min_spend, max_days_since_purchase, city, segment_tag, min_orders
        message_template: the message text (can include {name} placeholder)
        channel: whatsapp, sms, email, or rcs
    """
    payload = {
        "name": name,
        "description": description,
        "segment_rule": segment_rule_json,
        "message_template": message_template,
        "channel": channel,
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(f"{CRM_BASE_URL}/api/campaigns", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return json.dumps({"campaign_id": data["id"], "name": data["name"], "status": data["status"]})
    except Exception as exc:
        return json.dumps({"error": str(exc)})


@tool
def send_campaign_tool(campaign_id: Optional[int] = None) -> str:
    """
    Trigger sending of a campaign to its segmented audience.
    IMPORTANT: call create_campaign_tool first, then pass its returned campaign_id here.
    If campaign_id is omitted, the most recent draft campaign is sent as a fallback.

    Args:
        campaign_id: the integer campaign ID returned by create_campaign_tool
    """
    if campaign_id is None:
        from models import Campaign as _Campaign
        db = get_db()
        latest = (
            db.query(_Campaign)
            .filter(_Campaign.status == "draft")
            .order_by(_Campaign.id.desc())
            .first()
        )
        if not latest:
            return json.dumps({"error": "campaign_id is required — no draft campaigns found"})
        campaign_id = latest.id
        logger.info(f"send_campaign_tool: campaign_id not provided, using latest draft {campaign_id}")

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(f"{CRM_BASE_URL}/api/campaigns/{campaign_id}/send")
            resp.raise_for_status()
            data = resp.json()
            return json.dumps(data)
    except Exception as exc:
        return json.dumps({"error": str(exc)})


@tool
def get_analytics_tool(campaign_id: int) -> str:
    """
    Fetch analytics and delivery stats for a specific campaign.

    Args:
        campaign_id: the integer campaign ID
    """
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(f"{CRM_BASE_URL}/api/campaigns/{campaign_id}")
            resp.raise_for_status()
            data = resp.json()
            campaign = data.get("campaign", data)
            return json.dumps({
                "campaign_id": campaign.get("id"),
                "name": campaign.get("name"),
                "status": campaign.get("status"),
                "total": campaign.get("total_communications", 0),
                "sent": campaign.get("sent_count", 0),
                "delivered": campaign.get("delivered_count", 0),
                "opened": campaign.get("opened_count", 0),
                "read": campaign.get("read_count", 0),
                "clicked": campaign.get("clicked_count", 0),
                "delivery_rate": data.get("delivery_rate", 0),
                "open_rate": data.get("open_rate", 0),
                "click_rate": data.get("click_rate", 0),
            })
    except Exception as exc:
        return json.dumps({"error": str(exc)})


@tool
def get_customer_stats_tool() -> str:
    """
    Fetch overall customer statistics including count by segment and average spend.
    No arguments required.
    """
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(f"{CRM_BASE_URL}/api/customers/stats")
            resp.raise_for_status()
            return json.dumps(resp.json())
    except Exception as exc:
        return json.dumps({"error": str(exc)})


# ── Agent setup ───────────────────────────────────────────────────────────────

TOOLS = [
    segment_customers_tool,
    draft_message_tool,
    create_campaign_tool,
    send_campaign_tool,
    get_analytics_tool,
    get_customer_stats_tool,
]

SYSTEM_PROMPT = """You are CampaignMind AI, an intelligent marketing assistant for LOOM, a premium Indian fashion brand CRM.

CUSTOMER SEGMENTS (use segment_tag alone — never mix with contradictory filters):
- high_value : total_spend ≥ ₹15,000 — top spenders, ~91 customers
- at_risk    : no purchase in 90+ days — churning customers, ~79 customers
- new        : joined in last 30 days — ~13 customers
- regular    : consistent buyers, >1 purchase/month — ~17 customers

WORKFLOW — follow IN ORDER:
1. Call segment_customers_tool with ONLY segment_tag (e.g. {"segment_tag": "at_risk"}).
   Do NOT combine segment_tag with max_days_since_purchase — they are contradictory.
   Only add city or min_spend if the marketer explicitly asked for them.
2. Call draft_message_tool to generate a personalised message.
3. Show audience size + message draft. ASK for confirmation before creating anything.
4. On confirmation ("yes", "go ahead", "send it", "looks good", "confirm", "do it", etc.):
   a. Call create_campaign_tool — it returns JSON with "campaign_id"
   b. Extract that campaign_id integer from the response
   c. Immediately call send_campaign_tool(campaign_id=<that integer>)
5. Call get_analytics_tool with the same campaign_id to report delivery stats.

CRITICAL TOOL CHAINING RULE:
- create_campaign_tool returns {"campaign_id": <integer>, ...}
- You MUST pass that exact integer to send_campaign_tool as campaign_id
- Never call send_campaign_tool with an empty dict or without campaign_id

SEGMENT RULE CONSTRUCTION (for segment_rule_json):
- For at_risk customers → {"segment_tag": "at_risk"}            ← correct
- For high value →        {"segment_tag": "high_value"}          ← correct
- For recent buyers →     {"max_days_since_purchase": 30}        ← correct (no tag)
- WRONG: {"segment_tag": "at_risk", "max_days_since_purchase": 60}  ← contradictory, gives 0 results

Other rules:
- NEVER create a campaign without explicit marketer confirmation
- Available channels: whatsapp, sms, email, rcs (default: whatsapp if unspecified)
- Use ₹ (INR) for all monetary values
- For overall stats, use get_customer_stats_tool
- Be concise and action-oriented
"""


def get_agent(db: Session):
    set_db_session(db)
    llm = ChatGroq(
        api_key=GROQ_API_KEY,
        model="llama-3.3-70b-versatile",
        temperature=0.3,
    )
    return create_react_agent(llm, TOOLS, prompt=SYSTEM_PROMPT)


async def run_chat(message: str, conversation_history: list[dict], db: Session) -> dict[str, Any]:
    agent = get_agent(db)

    messages = []
    for msg in conversation_history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=message))

    try:
        result = await agent.ainvoke({"messages": messages})
        # Extract the last AIMessage that has non-empty text content
        ai_messages = [
            m for m in result["messages"]
            if isinstance(m, AIMessage) and isinstance(m.content, str) and m.content.strip()
        ]
        reply = ai_messages[-1].content if ai_messages else "Done! Let me know what you'd like to do next."
        return {"reply": reply, "action": None}
    except Exception as exc:
        logger.error(f"Agent error: {exc}")
        return {"reply": f"Sorry, I encountered an error: {str(exc)}", "action": None}
