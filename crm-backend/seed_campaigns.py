"""
Seed 4 demo campaigns for LOOM with realistic delivery funnel data.
"""

import json
import random
from datetime import datetime, timedelta

from database import SessionLocal, engine
from models import Base, Campaign, Communication, Customer


def _dt(days_ago: float, jitter_minutes: int = 0) -> datetime:
    base = datetime.utcnow() - timedelta(days=days_ago)
    return base + timedelta(minutes=random.randint(-jitter_minutes, jitter_minutes))


def _seed_campaign(db, name, description, segment_tag, channel, message_template,
                   segment_rule, sent_days_ago, delivery_pct=0.87, open_pct=0.58,
                   read_pct=0.32, click_pct=0.14):
    random.seed(42)
    customers = db.query(Customer).filter(Customer.segment_tag == segment_tag).all()

    campaign = Campaign(
        name=name, description=description,
        segment_rule=json.dumps(segment_rule),
        message_template=message_template,
        channel=channel, status="completed",
        created_at=_dt(sent_days_ago),
    )
    db.add(campaign)
    db.flush()

    sent_at = _dt(sent_days_ago)
    for customer in customers:
        parts = (customer.name or "").split()
        first = parts[0] if parts else "there"
        msg = message_template.replace("{name}", first)
        roll = random.random()
        if roll < (1 - delivery_pct):
            status = "failed"
        elif roll < (1 - delivery_pct + delivery_pct * (1 - open_pct)):
            status = "delivered"
        elif roll < (1 - delivery_pct + delivery_pct * (1 - open_pct) + delivery_pct * open_pct * (1 - read_pct)):
            status = "opened"
        elif roll < (1 - delivery_pct + delivery_pct * (1 - open_pct) + delivery_pct * open_pct * (1 - read_pct) + delivery_pct * open_pct * read_pct * (1 - click_pct)):
            status = "read"
        else:
            status = "clicked"
        db.add(Communication(
            campaign_id=campaign.id, customer_id=customer.id,
            message=msg, channel=channel, status=status,
            sent_at=sent_at,
            updated_at=sent_at + timedelta(seconds=random.randint(3, 120)),
        ))
    db.commit()


def seed_campaigns():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.query(Communication).delete()
        db.query(Campaign).delete()
        db.commit()

        _seed_campaign(db,
            name="VIP Exclusive Preview Drop",
            description="Early access to LOOM's new Festive Edit for top spenders",
            segment_tag="high_value", channel="whatsapp",
            message_template="Hi {name}! 🧵 As one of LOOM's VIP members, you get FIRST ACCESS to our Festive Edit before anyone else. Shop your exclusive preview: loom.in/vip-preview — Only 48 hrs! ✨",
            segment_rule={"segment_tag": "high_value"},
            sent_days_ago=5, delivery_pct=0.91, open_pct=0.63, read_pct=0.38, click_pct=0.19,
        )
        _seed_campaign(db,
            name="Win-Back: We Miss You",
            description="Re-engage at-risk customers who haven't purchased in 60+ days",
            segment_tag="at_risk", channel="sms",
            message_template="Hi {name}, LOOM misses you! Get 20% OFF your next order with code COMEBACK20. Shop now: loom.in — Offer valid 48 hrs.",
            segment_rule={"segment_tag": "at_risk"},
            sent_days_ago=12, delivery_pct=0.84, open_pct=0.46, read_pct=0.27, click_pct=0.11,
        )
        _seed_campaign(db,
            name="New Member Welcome Gift",
            description="Warm onboarding offer for customers who joined in the last 30 days",
            segment_tag="new", channel="email",
            message_template="Welcome to LOOM, {name}! 🎉 We're thrilled to have you. As a new member, enjoy ₹500 OFF your first order — use code WELCOME500 at checkout. Explore the collection: loom.in/new",
            segment_rule={"segment_tag": "new"},
            sent_days_ago=2, delivery_pct=0.92, open_pct=0.71, read_pct=0.44, click_pct=0.22,
        )
        _seed_campaign(db,
            name="Loyalty Rewards: Double Points Week",
            description="Reward regular buyers with double loyalty points for a limited time",
            segment_tag="regular", channel="rcs",
            message_template="Hey {name}! 🌟 You've been amazing — this week LOOM is giving you DOUBLE loyalty points on every purchase. Shop & earn: loom.in/loyalty",
            segment_rule={"segment_tag": "regular"},
            sent_days_ago=20, delivery_pct=0.82, open_pct=0.53, read_pct=0.29, click_pct=0.13,
        )
        print("Campaigns seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_campaigns()
