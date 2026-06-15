import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import SessionLocal, engine
from models import Base, Campaign, Communication, Customer, Order
from schemas import (
    BulkCustomerCreate,
    BulkOrderCreate,
    CampaignAnalytics,
    CampaignCreate,
    CampaignOut,
    ChatRequest,
    ChatResponse,
    CommunicationOut,
    CustomerOut,
    CustomerStats,
    OrderOut,
    ReceiptPayload,
    SegmentPreviewRequest,
    SegmentPreviewResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CHANNEL_SERVICE_URL = os.getenv("CHANNEL_SERVICE_URL", "http://localhost:8001")

# Status ordering for idempotent receipt processing
STATUS_ORDER = ["pending", "sent", "delivered", "failed", "opened", "read", "clicked"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("CRM Backend started — DB tables created")
    db = SessionLocal()
    try:
        # Seed customers if missing (Render free tier has an ephemeral disk, so
        # this runs on most cold starts).
        if db.query(Customer).count() == 0:
            logger.info("No customers — seeding customer data")
            from seed import seed as _seed_customers
            _seed_customers()
            logger.info("Customer seeding complete")
        # Seed demo campaigns independently: self-heals if campaigns ever end up
        # empty while customers persist, so evaluators always see demo campaigns.
        if db.query(Campaign).count() == 0:
            logger.info("No campaigns — seeding demo campaigns")
            from seed_campaigns import seed_campaigns as _seed_campaigns
            _seed_campaigns()
            logger.info("Campaign seeding complete")
    except Exception as exc:
        logger.error(f"Seed failed (non-fatal): {exc}")
    finally:
        db.close()
    yield


app = FastAPI(title="CampaignMind CRM API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # allow_credentials must be False when origins is wildcard — browsers reject
    # `Access-Control-Allow-Origin: *` together with `Allow-Credentials: true`.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Helper ────────────────────────────────────────────────────────────────────

def apply_segment_rule(query, rule: dict, db: Session):
    """Apply segment rule filters to a Customer query."""
    min_spend = rule.get("min_spend")
    max_days = rule.get("max_days_since_purchase")
    city = rule.get("city")
    segment_tag = rule.get("segment_tag")
    min_orders = rule.get("min_orders")

    if min_spend is not None:
        query = query.filter(Customer.total_spend >= min_spend)
    if city:
        query = query.filter(Customer.city.ilike(f"%{city}%"))
    if segment_tag:
        query = query.filter(Customer.segment_tag == segment_tag)
    if max_days is not None:
        cutoff = datetime.utcnow() - timedelta(days=max_days)
        query = query.filter(Customer.last_purchase_date >= cutoff)
    if min_orders is not None:
        subq = (
            db.query(Order.customer_id, func.count(Order.id).label("cnt"))
            .group_by(Order.customer_id)
            .subquery()
        )
        query = query.join(subq, Customer.id == subq.c.customer_id).filter(subq.c.cnt >= min_orders)

    return query


def build_campaign_out(campaign: Campaign, db: Session) -> CampaignOut:
    comms = db.query(Communication).filter(Communication.campaign_id == campaign.id).all()
    counts = {s: 0 for s in STATUS_ORDER}
    for c in comms:
        if c.status in counts:
            counts[c.status] += 1
    # Cumulative: sent includes sent+delivered+opened+read+clicked+failed
    sent_count = sum(counts[s] for s in ["sent", "delivered", "failed", "opened", "read", "clicked"])
    return CampaignOut(
        id=campaign.id,
        name=campaign.name,
        description=campaign.description,
        segment_rule=campaign.segment_rule,
        message_template=campaign.message_template,
        channel=campaign.channel,
        status=campaign.status,
        created_at=campaign.created_at,
        total_communications=len(comms),
        sent_count=sent_count,
        delivered_count=counts["delivered"] + counts["opened"] + counts["read"] + counts["clicked"],
        failed_count=counts["failed"],
        opened_count=counts["opened"] + counts["read"] + counts["clicked"],
        read_count=counts["read"] + counts["clicked"],
        clicked_count=counts["clicked"],
    )


# ── Customer Routes ───────────────────────────────────────────────────────────

@app.get("/api/customers", response_model=list[CustomerOut])
async def list_customers(
    segment: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    min_spend: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Customer)
    if segment:
        query = query.filter(Customer.segment_tag == segment)
    if city:
        query = query.filter(Customer.city.ilike(f"%{city}%"))
    if min_spend is not None:
        query = query.filter(Customer.total_spend >= min_spend)
    return query.order_by(Customer.total_spend.desc()).all()


@app.get("/api/customers/stats", response_model=CustomerStats)
async def get_customer_stats(db: Session = Depends(get_db)):
    total = db.query(Customer).count()
    by_segment_rows = (
        db.query(Customer.segment_tag, func.count(Customer.id))
        .group_by(Customer.segment_tag)
        .all()
    )
    by_segment = {row[0]: row[1] for row in by_segment_rows}
    avg_spend_row = db.query(func.avg(Customer.total_spend)).scalar()
    avg_spend = round(float(avg_spend_row or 0), 2)
    cities = [r[0] for r in db.query(Customer.city).distinct().order_by(Customer.city).all()]
    return CustomerStats(
        total_customers=total,
        by_segment=by_segment,
        avg_spend=avg_spend,
        cities=cities,
    )


@app.get("/api/customers/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@app.post("/api/customers/bulk", response_model=list[CustomerOut], status_code=201)
async def bulk_create_customers(payload: BulkCustomerCreate, db: Session = Depends(get_db)):
    created = []
    for c in payload.customers:
        existing = db.query(Customer).filter(Customer.email == c.email).first()
        if existing:
            continue
        db_customer = Customer(**c.model_dump())
        db.add(db_customer)
        created.append(db_customer)
    db.commit()
    for c in created:
        db.refresh(c)
    return created


# ── Order Routes ──────────────────────────────────────────────────────────────

@app.post("/api/orders/bulk", response_model=list[OrderOut], status_code=201)
async def bulk_create_orders(payload: BulkOrderCreate, db: Session = Depends(get_db)):
    created = []
    for o in payload.orders:
        customer = db.query(Customer).filter(Customer.id == o.customer_id).first()
        if not customer:
            continue
        db_order = Order(**o.model_dump())
        db.add(db_order)
        created.append(db_order)
    db.commit()
    return created


# ── Campaign Routes ───────────────────────────────────────────────────────────

@app.get("/api/campaigns", response_model=list[CampaignOut])
async def list_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
    return [build_campaign_out(c, db) for c in campaigns]


@app.get("/api/campaigns/{campaign_id}", response_model=CampaignAnalytics)
async def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    out = build_campaign_out(campaign, db)
    total = out.total_communications
    delivered = out.delivered_count
    opened = out.opened_count

    delivery_rate = round((delivered / total * 100) if total else 0, 1)
    open_rate = round((opened / delivered * 100) if delivered else 0, 1)
    read_rate = round((out.read_count / opened * 100) if opened else 0, 1)
    click_rate = round((out.clicked_count / out.read_count * 100) if out.read_count else 0, 1)

    return CampaignAnalytics(
        campaign=out,
        delivery_rate=delivery_rate,
        open_rate=open_rate,
        read_rate=read_rate,
        click_rate=click_rate,
    )


@app.post("/api/campaigns", response_model=CampaignOut, status_code=201)
async def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db)):
    campaign = Campaign(**payload.model_dump())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return build_campaign_out(campaign, db)


async def _send_campaign_background(campaign_id: int):
    """Background task: segment customers, create communications, fire to channel service."""
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            logger.error(f"Campaign {campaign_id} not found in background task")
            return

        campaign.status = "sending"
        db.commit()

        try:
            rule = json.loads(campaign.segment_rule)
        except (json.JSONDecodeError, TypeError):
            rule = {}

        query = db.query(Customer)
        query = apply_segment_rule(query, rule, db)
        customers = query.all()

        logger.info(f"Campaign {campaign_id}: sending to {len(customers)} customers")

        # Phase 1: create all Communication rows and commit so the count is
        # immediately visible to other DB connections (no longer shows 0).
        now = datetime.utcnow()
        comm_rows: list[tuple[Customer, Communication]] = []
        for customer in customers:
            message = campaign.message_template.replace("{{name}}", customer.name.split()[0])
            comm = Communication(
                campaign_id=campaign.id,
                customer_id=customer.id,
                message=message,
                channel=campaign.channel,
                status="sent",
                sent_at=now,
            )
            db.add(comm)
            comm_rows.append((customer, comm))
        db.commit()
        for _, comm in comm_rows:
            db.refresh(comm)

        # Phase 2: fire to channel service (delivery receipts come back async)
        async with httpx.AsyncClient(timeout=30.0) as client:
            for customer, comm in comm_rows:
                try:
                    await client.post(
                        f"{CHANNEL_SERVICE_URL}/send",
                        json={
                            "communication_id": comm.id,
                            "recipient_email": customer.email,
                            "recipient_phone": customer.phone,
                            "message": comm.message,
                            "channel": campaign.channel,
                        },
                    )
                except Exception as exc:
                    logger.error(f"Channel service error for comm {comm.id}: {exc}")
                    comm.status = "failed"

        db.commit()

        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        campaign.status = "completed"
        db.commit()
        logger.info(f"Campaign {campaign_id} completed")

    except Exception as exc:
        logger.error(f"Error in campaign {campaign_id} background task: {exc}")
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.status = "completed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@app.post("/api/campaigns/{campaign_id}/send")
async def send_campaign(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in ("draft",):
        raise HTTPException(status_code=422, detail=f"Campaign already in status: {campaign.status}")

    background_tasks.add_task(_send_campaign_background, campaign_id)
    return {"message": "Campaign send initiated", "campaign_id": campaign_id, "status": "sending"}


# ── Receipt Webhook ───────────────────────────────────────────────────────────

@app.post("/api/receipt")
async def receive_receipt(payload: ReceiptPayload, db: Session = Depends(get_db)):
    comm = db.query(Communication).filter(Communication.id == payload.communication_id).first()
    if not comm:
        raise HTTPException(status_code=404, detail="Communication not found")

    current_idx = STATUS_ORDER.index(comm.status) if comm.status in STATUS_ORDER else 0
    new_idx = STATUS_ORDER.index(payload.status) if payload.status in STATUS_ORDER else -1

    if new_idx > current_idx:
        comm.status = payload.status
        comm.updated_at = payload.timestamp
        db.commit()
        logger.info(f"Receipt: comm={payload.communication_id} → {payload.status}")
    else:
        logger.info(f"Receipt ignored (no-op): comm={payload.communication_id} status={payload.status} current={comm.status}")

    return {"ok": True}


# ── Segment Routes ────────────────────────────────────────────────────────────

@app.post("/api/segments/preview", response_model=SegmentPreviewResponse)
async def preview_segment(payload: SegmentPreviewRequest, db: Session = Depends(get_db)):
    rule = payload.segment_rule.model_dump(exclude_none=True)
    query = db.query(Customer)
    query = apply_segment_rule(query, rule, db)
    total = query.count()
    sample = query.limit(10).all()
    return SegmentPreviewResponse(count=total, sample_customers=sample)


@app.get("/api/segments")
async def list_segments(db: Session = Depends(get_db)):
    segments = [
        {
            "tag": "high_value",
            "label": "High Value",
            "description": "Customers with total spend ≥ ₹15,000",
            "color": "gold",
            "rule": {"min_spend": 15000},
        },
        {
            "tag": "at_risk",
            "label": "At Risk",
            "description": "Customers who haven't purchased in 90+ days",
            "color": "red",
            "rule": {"segment_tag": "at_risk"},
        },
        {
            "tag": "new",
            "label": "New Customers",
            "description": "Customers who joined in the last 30 days",
            "color": "green",
            "rule": {"segment_tag": "new"},
        },
        {
            "tag": "regular",
            "label": "Regular",
            "description": "Steady buyers with consistent purchase history",
            "color": "blue",
            "rule": {"segment_tag": "regular"},
        },
    ]
    for seg in segments:
        count = db.query(Customer).filter(Customer.segment_tag == seg["tag"]).count()
        seg["count"] = count

    return segments


# ── AI Chat Route ─────────────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    from ai_agent import run_chat

    result = await run_chat(payload.message, [m.model_dump() for m in payload.conversation_history], db)
    return ChatResponse(reply=result["reply"], action=result.get("action"))


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "crm-backend"}
