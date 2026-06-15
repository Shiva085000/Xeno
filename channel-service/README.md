# CampaignMind — Channel Service

Simulates a messaging channel (WhatsApp/SMS/Email/RCS) with realistic async delivery callbacks.

## Setup

```bash
cd channel-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## Delivery simulation

| Stage    | Delay   | Probability |
|----------|---------|-------------|
| Delivered | 1–5s  | 85%         |
| Opened    | 2–8s  | 60% of delivered |
| Read      | 2–5s  | 30% of opened |
| Clicked   | 1–3s  | 15% of read |

All callbacks are fired to `POST http://localhost:8000/api/receipt`.
