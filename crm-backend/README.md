# CampaignMind — CRM Backend

FastAPI backend with AI agent, SQLite database, and async campaign delivery.

## Setup

```bash
cd crm-backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

## Seed the database

```bash
python seed.py
```

## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API docs: http://localhost:8000/docs

## Architecture notes

- **BackgroundTasks** handles campaign sending asynchronously so the API returns immediately.
- **Channel service** receives each message and fires async delivery callbacks.
- **Receipt webhook** (`POST /api/receipt`) is idempotent — status only moves forward in the pipeline: `pending → sent → delivered → opened → read → clicked`.
- **AI agent** uses LangChain + Groq (llama3-8b-8192) with 6 tools.

## Trade-offs

At scale, `BackgroundTasks` should be replaced with **Celery + Redis** for durable task queues, retries, and horizontal scaling. This is explicitly omitted for simplicity.
