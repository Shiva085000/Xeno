import asyncio
import os
import random
import logging
from datetime import datetime
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CRM_RECEIPT_URL = os.getenv("CRM_RECEIPT_URL", "http://localhost:8000/api/receipt")


class SendRequest(BaseModel):
    communication_id: int
    recipient_email: str
    recipient_phone: str
    message: str
    channel: str


async def post_receipt(communication_id: int, status: str):
    payload = {
        "communication_id": communication_id,
        "status": status,
        "timestamp": datetime.utcnow().isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(CRM_RECEIPT_URL, json=payload)
            resp.raise_for_status()
            logger.info(f"Receipt posted: comm={communication_id} status={status}")
    except Exception as exc:
        logger.error(f"Failed to post receipt for comm={communication_id}: {exc}")


async def simulate_delivery(req: SendRequest):
    communication_id = req.communication_id

    # Stage 1: sent → delivered or failed (1–5s)
    await asyncio.sleep(random.uniform(1, 5))

    if random.random() < 0.15:
        await post_receipt(communication_id, "failed")
        return

    await post_receipt(communication_id, "delivered")

    # Stage 2: delivered → opened (2–8s, 60% chance)
    await asyncio.sleep(random.uniform(2, 8))
    if random.random() >= 0.60:
        return
    await post_receipt(communication_id, "opened")

    # Stage 3: opened → read (2–5s, 30% chance)
    await asyncio.sleep(random.uniform(2, 5))
    if random.random() >= 0.30:
        return
    await post_receipt(communication_id, "read")

    # Stage 4: read → clicked (1–3s, 15% chance)
    await asyncio.sleep(random.uniform(1, 3))
    if random.random() >= 0.15:
        return
    await post_receipt(communication_id, "clicked")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Channel Service started on port 8001")
    yield
    logger.info("Channel Service shutting down")


app = FastAPI(title="CampaignMind Channel Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "channel-service"}


@app.post("/send")
async def send_message(req: SendRequest):
    logger.info(
        f"Accepted comm={req.communication_id} channel={req.channel} "
        f"to={req.recipient_email}"
    )
    # Fire and forget — don't await
    asyncio.create_task(simulate_delivery(req))
    return {"status": "accepted", "communication_id": req.communication_id}
