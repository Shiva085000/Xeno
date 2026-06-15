# CampaignMind — AI-Native Mini CRM

Built for the **Xeno FDE Engineering Internship Assignment**.

A chat-first AI CRM where a brand marketer types natural language goals and the AI auto-segments, drafts messages, fires campaigns, and tracks delivery in real-time.

---

## Quick Start

### 1. CRM Backend (port 8000)

```bash
cd crm-backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Add your GROQ_API_KEY to .env

python seed.py           # seed 200 customers + 500 orders
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Channel Service (port 8001)

```bash
cd channel-service
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Frontend (port 3000)

```bash
cd crm-frontend
npm install
npm run dev
```

Open **http://localhost:3000** → redirects to /chat.

---

## Architecture

```
┌──────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  Next.js 14      │────▶│  CRM Backend :8000  │────▶│ Channel Service │
│  (React + TS)    │◀────│  FastAPI + SQLite   │◀────│  :8001          │
└──────────────────┘     └─────────────────────┘     └─────────────────┘
                                   │
                          ┌────────▼────────┐
                          │  Groq AI Agent  │
                          │  LangGraph +    │
                          │  llama3-8b-8192 │
                          └─────────────────┘
```

### Flow

1. Marketer types goal → `/api/chat` → LangGraph agent
2. Agent calls `segment_customers_tool` → shows audience count
3. Agent calls `draft_message_tool` → generates personalised copy
4. On confirmation → `create_campaign_tool` + `send_campaign_tool`
5. FastAPI `BackgroundTasks` segments customers → creates `Communication` rows → POSTs to channel service
6. Channel service simulates delivery (async) → fires receipts to `POST /api/receipt`
7. Receipt handler updates `Communication.status` (idempotent, only moves forward)
8. Frontend auto-refreshes campaign analytics every 10s

### Segment Tags

| Tag | Criteria |
|-----|----------|
| `high_value` | Total spend ≥ ₹15,000 |
| `at_risk` | No purchase in 90+ days |
| `new` | Joined < 30 days ago |
| `regular` | Steady buyers |

### Channel Delivery Simulation

| Stage | Delay | Probability |
|-------|-------|-------------|
| Delivered | 1–5s | 85% |
| Opened | 2–8s | 60% of delivered |
| Read | 2–5s | 30% of opened |
| Clicked | 1–3s | 15% of read |

---

## Pages

| Page | Description |
|------|-------------|
| `/chat` | AI chat interface with suggested prompts |
| `/campaigns` | Campaign cards with expandable analytics + Recharts |
| `/customers` | Searchable/filterable customer table |
| `/segments` | Segment cards with "Create Campaign" shortcuts |

---

## Trade-offs

- **BackgroundTasks vs Celery**: `FastAPI.BackgroundTasks` is used for simplicity. At scale, replace with **Celery + Redis** for durable task queues, retries, and horizontal scaling.
- **SQLite vs PostgreSQL**: SQLite for zero-config local dev. Replace with PostgreSQL for production concurrency.
- **No auth**: Explicitly out of scope per spec.
- **No Docker**: Explicitly out of scope per spec.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts, lucide-react |
| AI Agent | LangGraph + LangChain-Groq, llama3-8b-8192 |
| CRM Backend | FastAPI, SQLAlchemy, SQLite, httpx |
| Channel Service | FastAPI, asyncio |
| Seed Data | Python Faker, 200 customers + 500 orders |
