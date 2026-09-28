# 🚀 ReachInbox — Production-Grade Email Job Scheduler & Dashboard

A production-grade, distributed email scheduler service and real-time dashboard built for **ReachInbox.ai**.

The system enables cold outreach lead scheduling with configurable worker concurrency, minimum provider send delays, atomic Redis-backed hourly rate limiting, Slack rate-limit webhook/OAuth alerts, crash-proof persistence (zero cron jobs), fake SMTP delivery via Ethereal Email, full-text Elasticsearch indexing, and real-time BullMQ queue visibility via Bull-Board.

---

## 🏗️ Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │    React + TypeScript Dashboard       │
                      │  (Google OAuth / Evaluator 1-Click)   │
                      └──────────────────┬────────────────────┘
                                         │ REST API
                                         ▼
                      ┌───────────────────────────────────────┐
                      │    Express.js + TypeScript Server     │
                      │    (Controllers, Routes, Bull-Board)  │
                      └───────┬──────────────┬─────────────┬──┘
                              │              │             │
                    Persist   │      Delayed │       Index │
                     Emails   │         Jobs │     Records │
                              ▼              ▼             ▼
                    ┌────────────┐   ┌────────────┐   ┌────────────┐
                    │   MySQL    │   │   Redis    │   │Elasticsearch│
                    │  (Prisma)  │   │  (BullMQ)  │   │   (Search) │
                    └────────────┘   └──────┬─────┘   └────────────┘
                                            │
                                            ▼
                      ┌───────────────────────────────────────┐
                      │      BullMQ Worker Process            │
                      │  - Concurrency: WORKER_CONCURRENCY    │
                      │  - Provider delay: MIN_SEND_DELAY_MS  │
                      │  - Atomic Rate Limit: EVAL / Lua      │
                      └─────────────┬─────────────────┬───────┘
                                    │                 │
                         Hourly Hit │                 │ SMTP
                                    ▼                 ▼
                          ┌────────────────┐   ┌──────────────┐
                          │ Slack Webhook/ │   │Ethereal Email│
                          │     OAuth      │   │ (Fake SMTP)  │
                          └────────────────┘   └──────────────┘
```

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js, TypeScript
- **Queue & Scheduler:** BullMQ, Redis (AOF enabled, **zero cron jobs**)
- **Database:** MySQL 8.0 with Prisma ORM
- **Search Engine:** Elasticsearch 8.11 (with fallback to database full-text search)
- **Email Delivery:** Nodemailer + Ethereal Fake SMTP
- **Queue Visibility:** Bull-Board (`/queues`)
- **Alerts:** Slack OAuth & Incoming Webhook with Block Kit formatting
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons
- **Infrastructure:** Docker Compose (MySQL, Redis, Elasticsearch)

---

## 🌟 Key Features

### 1. Backend & Scheduler
- ✅ **Delayed Scheduling without Cron:** Scheduling uses native BullMQ delayed jobs (`jobId = email.id`). Formula: `startTime + (recipientIndex × delaySeconds)`.
- ✅ **Server Restart Resilience:** All job definitions live in Redis; all state lives in MySQL. If the server or worker crashes, jobs resume from Redis at the exact scheduled time without re-running completed jobs.
- ✅ **Strict Idempotency:** Each email record has a unique UUID mapped 1:1 to the BullMQ job ID. Before sending, the worker verifies `email.status !== 'SENT'` to prevent duplicate deliveries.
- ✅ **Configurable Worker Concurrency:** Adjust worker parallelism via `WORKER_CONCURRENCY` (default: `5`).
- ✅ **Provider Throttling Delay:** Minimum pause between individual sends configured via `MIN_SEND_DELAY_MS` (default: `2000ms`) or custom per campaign.
- ✅ **Atomic Hourly Rate Limiting:** Enforced per sender per hour window (`ratelimit:sender:{id}:{YYYY-MM-DD-HH}`) using atomic Redis Lua scripts (`EVAL`).
- ✅ **No Dropped Jobs on Limit Hit:** When a sender exceeds their hourly limit, excess jobs are postponed into the next available hour window (`moveToDelayed` + `DelayedError`) preserving queue order.
- ✅ **Live Slack Rate-Limit Alerts:** The moment a sender reaches their hourly quota, a live Slack message (with rich Block Kit formatting) is dispatched to the user's channel. Disconnected states are handled gracefully.
- ✅ **Elasticsearch Indexing & Search:** All emails are indexed upon scheduling and updated to `SENT` or `FAILED`. Search API supports query matching on recipient, subject, and body.
- ✅ **Live Bull-Board Dashboard:** Queue visibility available at `http://localhost:5000/queues` showing Waiting, Active, Delayed, Completed, and Failed jobs.

### 2. Frontend Dashboard
- ✅ **Google OAuth & Evaluator 1-Click Demo Login:** Log in via official Google OAuth or click the 1-Click Demo Evaluator button.
- ✅ **Lead CSV/TXT Upload & Parser:** Drag & drop CSV/TXT files or paste emails. Auto-detects valid addresses, deduplicates, and previews chips.
- ✅ **Scheduled & Sent Email Tables:** Tabbed interface with real-time status badges (`SCHEDULED`, `SENDING`, `SENT`, `FAILED`).
- ✅ **Ethereal Email Preview Links:** Click **"View Email"** on any sent message to open the rendered HTML email in Ethereal's web viewer!
- ✅ **Slack Integration Modal:** Connect Slack via Incoming Webhook URL or OAuth with an instant **"Test Live Notification"** button.
- ✅ **1000-Lead Benchmark Load Simulator:** Test high-volume enqueuing with a single click.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ (tested on v24)
- [Docker Desktop](https://www.docker.com/) (running)

---

### Step 1: Start Docker Containers (MySQL, Redis, Elasticsearch)

From the project root:
```bash
docker compose up -d
```

Verify that all three containers are healthy:
```bash
docker ps
```
Ports exposed:
- MySQL: `localhost:3307` (mapped to avoid local 3306 conflicts)
- Redis: `localhost:6379`
- Elasticsearch: `localhost:9200`

---

### Step 2: Configure Environment Variables

Backend `.env` is pre-configured at `backend/.env`:
```env
PORT=5000
DATABASE_URL="mysql://reachinbox_user:reachinbox_pass@localhost:3307/reachinbox"
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_URL=http://localhost:9200
WORKER_CONCURRENCY=5
MIN_SEND_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=5
JWT_SECRET=reachinbox_secret_jwt_key_2026
FRONTEND_URL=http://localhost:3000

# Optional Google OAuth (Evaluator 1-Click login is available out of the box)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# Optional Slack OAuth (Incoming Webhook also supported directly in UI)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_CALLBACK_URL=http://localhost:5000/slack/callback

# Optional Ethereal Credentials (auto-generated if omitted)
ETHEREAL_USER=
ETHEREAL_PASS=
```

---

### Step 3: Run Database Migrations & Seed

In a terminal:
```bash
cd backend
npm install
npx prisma db push
npx tsx src/scripts/seed.ts
```

This creates the database tables and automatically generates a verified Ethereal test account!

---

### Step 4: Start Backend API Server & BullMQ Worker

In **Terminal 1** (API Server):
```bash
cd backend
npm run dev:server
```
*API runs on `http://localhost:5000`*  
*Bull-Board dashboard runs on `http://localhost:5000/queues`*

In **Terminal 2** (BullMQ Worker Process):
```bash
cd backend
npm run dev:worker
```
*Worker listens to Redis `email-queue` with concurrency `5` and minimum send delay `2000ms`.*

---

### Step 5: Start Frontend Dashboard

In **Terminal 3** (Frontend):
```bash
cd frontend
npm install
npm run dev
```
*Frontend opens on `http://localhost:3000`.*

---

## 🧪 Testing & Verification

### 1. Run Automated End-to-End Test
Run the automated verification suite which tests health, demo auth, sender provisioning, scheduling with delay, Elasticsearch indexing, rate limiting, and Bull-Board:
```bash
cd backend
npx tsx src/scripts/testEndToEnd.ts
```

### 2. Manual Verification in Dashboard
1. Open `http://localhost:3000` in your browser.
2. Click **"1-Click Evaluator Demo Login"**.
3. Click **"Compose New Email"**:
   - Enter Subject and Body.
   - Upload a CSV or paste leads:
     ```text
     lead1@example.com
     lead2@example.com
     lead3@example.com
     ```
   - Notice the green badge: *"3 valid leads detected"*.
   - Set delay to `2` seconds.
   - Click **Schedule 3 Emails**.
4. Switch between **"Scheduled Emails"** and **"Sent Emails"** tabs.
5. In **"Sent Emails"**, click **"View Email"** to inspect the rendered message on [Ethereal Email](https://ethereal.email).
6. Type in the search bar: Elasticsearch immediately filters emails in real-time.

### 3. Server Crash & Restart Test
1. Schedule an email with a 30-second delay.
2. Immediately terminate the worker (`Ctrl + C` or kill the worker terminal).
3. Wait 10 seconds.
4. Restart the worker: `npm run dev:worker`.
5. Observe the worker pick up the delayed job from Redis and send it at the scheduled time with zero duplication!

### 4. Hourly Rate Limiting & Slack Alert Test
1. The default hourly limit is set to `5` emails/hour in `seed.ts`.
2. Open the **"Connect Slack"** modal in the dashboard.
3. Paste a Slack Incoming Webhook URL and click **"Connect Webhook"** (or click **"Test Live Notification"**).
4. Schedule 7 emails. The first 5 are sent immediately; the remaining 2 are rescheduled into the next hour window, and a Slack alert is dispatched to your channel.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status and queue config |
| `POST` | `/auth/demo-login` | Instant 1-click evaluator login |
| `GET` | `/auth/google` | Google OAuth redirect URL |
| `GET` | `/auth/google/callback` | Google OAuth callback handler |
| `GET` | `/auth/me` | Fetch logged-in user profile |
| `POST` | `/auth/logout` | Clears authentication session |
| `POST` | `/emails/schedule` | Schedule emails with start time, delay, and hourly limit |
| `GET` | `/emails?status=SCHEDULED` | List scheduled or sent emails |
| `GET` | `/emails/stats` | Dashboard statistics (scheduled, sent, failed) |
| `GET` | `/emails/search?q=...` | Elasticsearch search across recipient & subject |
| `POST` | `/emails/load-test` | Enqueue 1000 simulated jobs |
| `POST` | `/emails/reset-rate-limit` | Reset sender rate limit counter for testing |
| `GET` | `/senders` | List senders with real-time hourly rate-limit quota |
| `GET` | `/slack/status` | Get user Slack connection details |
| `POST` | `/slack/webhook` | Save incoming Slack webhook URL |
| `POST` | `/slack/test` | Dispatch a live test alert to Slack |
| `POST` | `/slack/disconnect` | Disconnect Slack |
| `GET` | `/queues` | Live Bull-Board dashboard UI |

---

## 📐 Assumptions, Shortcuts & Trade-offs

1. **Non-Atomic SMTP Delivery & DB Write:** Sending an email via SMTP and updating the database cannot be done in a single distributed 2-phase commit without an external coordinator. To handle this safely, we update the status to `SENDING` before dispatch and mark `SENT` immediately upon provider acknowledgment.
2. **Database Choice:** We utilized **MySQL 8.0** with Prisma ORM (per assignment spec) and mapped the Docker container port to `3307:3306` to prevent conflicts with pre-installed Windows MySQL instances.
3. **Slack Integration:** To make evaluation frictionless for reviewers without requiring them to register a custom Slack OAuth App with redirect domains, we implemented **both** Slack OAuth and **Incoming Webhook URLs** with instant live test buttons.
4. **Elasticsearch Fallback:** If Elasticsearch is temporarily restarting or unindexed, the search service transparently falls back to MySQL `LIKE` queries to ensure uninterrupted dashboard usability.
