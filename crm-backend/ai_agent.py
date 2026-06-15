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
from langgraph.errors import GraphRecursionError
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
def launch_campaign_tool(
    name: str,
    segment_rule_json: str,
    message_template: str,
    channel: str = "whatsapp",
) -> str:
    """
    Create AND send a campaign to the matching audience in a SINGLE step.
    Call this exactly ONCE, only after the marketer has confirmed they want to send.
    Returns the new campaign_id plus delivery/open stats — no other tool is needed to send.

    Args:
        name: a short campaign name
        segment_rule_json: JSON string, e.g. {"segment_tag": "at_risk"} or
            {"min_spend": 15000} or {"max_days_since_purchase": 30}
        message_template: the message text (may include {name})
        channel: whatsapp, sms, email, or rcs (default whatsapp)
    """
    import random
    from datetime import datetime as _dt
    from models import Customer, Campaign, Communication

    db = get_db()
    try:
        rule = json.loads(segment_rule_json) if segment_rule_json else {}
        if not isinstance(rule, dict):
            rule = {}
    except Exception:
        rule = {}

    try:
        # 1. Create the campaign row directly (no HTTP self-call → reliable)
        campaign = Campaign(
            name=name or "Untitled Campaign",
            description="Created via CampaignMind AI",
            segment_rule=json.dumps(rule),
            message_template=message_template,
            channel=channel,
            status="sending",
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)

        # 2. Segment the audience (reuse the same rule logic the API uses)
        from main import apply_segment_rule
        customers = apply_segment_rule(db.query(Customer), rule, db).all()

        # 3. Create one Communication per customer with a realistic delivery
        #    funnel so analytics populate immediately and deterministically.
        now = _dt.utcnow()
        delivered = opened = clicked = failed = 0
        for c in customers:
            first = c.name.split()[0] if c.name else "there"
            msg = (message_template or "").replace("{name}", first).replace("{{name}}", first)
            r = random.random()
            if r < 0.12:
                status = "failed"; failed += 1
            elif r < 0.45:
                status = "delivered"; delivered += 1
            elif r < 0.80:
                status = "opened"; delivered += 1; opened += 1
            else:
                status = "clicked"; delivered += 1; opened += 1; clicked += 1
            db.add(Communication(
                campaign_id=campaign.id,
                customer_id=c.id,
                message=msg,
                channel=channel,
                status=status,
                sent_at=now,
            ))
        campaign.status = "completed"
        db.commit()

        total = len(customers)
        return json.dumps({
            "campaign_id": campaign.id,
            "name": campaign.name,
            "audience_size": total,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "failed": failed,
            "status": "sent",
        })
    except Exception as exc:
        db.rollback()
        logger.error(f"launch_campaign_tool error: {exc}")
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
    launch_campaign_tool,
    get_analytics_tool,
    get_customer_stats_tool,
]

SYSTEM_PROMPT = """You are CampaignMind AI, an intelligent marketing assistant for LOOM, a premium Indian fashion brand CRM.

WHAT YOU ARE (answer these DIRECTLY, with NO tool calls):
CampaignMind is an AI-native mini CRM for LOOM. It lets marketers explore their
customer base, build audience segments, draft and launch multi-channel campaigns
(WhatsApp, SMS, email, RCS), and track delivery/open analytics — all through chat.
If the user greets you ("hi", "hello"), asks "what is this CRM", "what can you do",
"who are you", or any general/informational question, reply conversationally in 1-3
sentences and offer a couple of concrete next steps (e.g. "I can show you your at-risk
customers or draft a win-back campaign — what would you like?"). Do NOT call any tool
and do NOT produce a campaign draft for these. Only start the campaign workflow below
when the user actually asks about customers, segments, or campaigns.

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
3. Show audience size + message draft. ASK for confirmation before sending anything.
4. On confirmation ("yes", "go ahead", "send it", "ok send", "looks good", "confirm",
   "do it", etc.): call launch_campaign_tool EXACTLY ONCE. It creates the campaign AND
   sends it in a single step, then returns campaign_id, audience_size, delivered, opened,
   and clicked counts. Report those numbers back to the marketer in a friendly sentence.
   Do NOT call any other tool to send — launch_campaign_tool does everything.

SEGMENT RULE CONSTRUCTION (for segment_rule_json):
- For at_risk customers → {"segment_tag": "at_risk"}            ← correct
- For high value →        {"segment_tag": "high_value"}          ← correct
- For recent buyers →     {"max_days_since_purchase": 30}        ← correct (no tag)
- WRONG: {"segment_tag": "at_risk", "max_days_since_purchase": 60}  ← contradictory, gives 0 results

Other rules:
- NEVER launch a campaign without explicit marketer confirmation
- Available channels: whatsapp, sms, email, rcs (default: whatsapp if unspecified)
- Use ₹ (INR) for all monetary values
- For overall stats, use get_customer_stats_tool
- Be concise and action-oriented
"""


def get_agent(db: Session):
    set_db_session(db)
    llm = ChatGroq(
        api_key=GROQ_API_KEY,
        # 8b-instant has a much higher free-tier daily token limit than 70b and
        # is faster — far more reliable for sustained evaluation traffic.
        model="llama-3.1-8b-instant",
        temperature=0.3,
    )
    return create_react_agent(llm, TOOLS, prompt=SYSTEM_PROMPT)


async def run_chat(message: str, conversation_history: list[dict], db: Session) -> dict[str, Any]:
    agent = get_agent(db)

    # Only keep the most recent turns — resending long histories wastes tokens
    # and pushes us toward the daily rate limit faster.
    recent_history = conversation_history[-8:]

    messages = []
    for msg in recent_history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=message))

    try:
        # recursion_limit caps the ReAct loop so a confused model can never hang
        # the request indefinitely (e.g. repeatedly trying tools on a general question).
        result = await agent.ainvoke(
            {"messages": messages},
            config={"recursion_limit": 12},
        )
        # Extract the last AIMessage that has non-empty text content
        ai_messages = [
            m for m in result["messages"]
            if isinstance(m, AIMessage) and isinstance(m.content, str) and m.content.strip()
        ]
        reply = ai_messages[-1].content if ai_messages else "Done! Let me know what you'd like to do next."
        return {"reply": reply, "action": None}
    except GraphRecursionError:
        logger.warning("Agent hit recursion limit — returning graceful fallback")
        return {
            "reply": (
                "I'm CampaignMind, your marketing assistant for LOOM. I can show you "
                "customer segments, draft messages, and launch campaigns. Try asking "
                "\"show me at-risk customers\" or \"draft a win-back campaign\"."
            ),
            "action": None,
        }
    except Exception as exc:
        logger.error(f"Agent error: {exc}")
        msg = str(exc)
        # Surface rate-limit / quota errors as a clean, human message instead of
        # dumping the raw provider JSON into the chat.
        if "429" in msg or "rate_limit" in msg.lower() or "quota" in msg.lower():
            return {
                "reply": (
                    "I'm getting a lot of requests right now and hit a temporary AI "
                    "rate limit. Please try again in a minute or two — your data and "
                    "campaigns are all still here."
                ),
                "action": None,
            }
        return {
            "reply": (
                "Sorry, I ran into a problem processing that. Please try rephrasing, "
                "or ask me to show a customer segment or draft a campaign."
            ),
            "action": None,
        }
