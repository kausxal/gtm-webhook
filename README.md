# Enterprise Event-Driven Webhook Pipeline

This project is a highly scalable, serverless webhook ingestion pipeline. It was engineered to solve the most common architectural bottlenecks found in high-volume Go-to-Market (GTM) integrations: **Data Loss, Third-Party Rate Limiting, and Duplicate Records.**

While the business logic routes B2B visitor data to CRMs and Sales Execution platforms, the underlying infrastructure demonstrates enterprise-grade backend design patterns.

## The Problem
Standard webhooks are synchronous and fragile. When a high volume of traffic hits a standard webhook, it attempts to process all downstream third-party APIs (like HubSpot or OpenAI) at once. If a third-party API is slow, the webhook times out. If the API rate-limits the request, the data is permanently lost.

## The Architecture Solution

This pipeline utilizes an event-driven, decoupled architecture on Vercel to guarantee **0% data loss** and massive scalability.

### 1. The Data Lake (PostgreSQL)
Before any processing or deduplication occurs, the raw JSON payload is instantly validated using **Zod** and inserted into a PostgreSQL database. 
* **Why:** If the scoring logic changes next year, or if a catastrophic bug occurs in the pipeline, the raw data is safely preserved in the Data Lake and can be cleanly replayed.

### 2. Workflow Engine & Circuit Breakers (Trigger.dev)
After saving to the Data Lake, the endpoint instantly returns a `200 OK` and hands the payload off to an asynchronous workflow engine (Trigger.dev). 
* **Why:** This isolates the ingestion endpoint from the processing logic. If the HubSpot API goes down, the Trigger.dev engine acts as a **Circuit Breaker**—pausing the execution and intelligently retrying the job up to 5 times over an hour using exponential backoff.

### 3. Caching & Rate Limiting (Redis / Vercel KV)
Third-party CRMs have strict API limits. To protect the pipeline from being throttled:
* **Caching:** Company domain lookups are cached in Redis for 24 hours. If 10 visitors from `acme.com` arrive, the pipeline only queries the CRM API once.
* **Deduplication:** Redis is used to track email addresses and enforce a 7-day deduplication window.
* **"Hot Spike" Tracking:** Redis actively increments and tracks the velocity of domain visits. If a domain exhibits a "Hot Spike" (e.g., 3+ visits in a 30-day window), the pipeline dynamically alters the lead tier routing.

### 4. AI & CRM Business Logic
Once the infrastructure gates are passed, the pipeline executes parallel processes:
* **AI Personalization:** Queries OpenAI (`gpt-4o-mini`) to generate a highly personalized, contextual icebreaker based on the visitor's role, company, and behavioral intent.
* **Advanced CRM Association:** Programmatically searches for the Company domain, creates the Company object if it doesn't exist, creates the Contact, and strictly associates the two entities together in the CRM.
* **Parallel Execution:** Dispatches the enriched data to email automation (Instantly), LinkedIn automation (HeyReach), and internal alerting (Slack) simultaneously via `Promise.all`.

---

## Directory Structure
* `/api/webhook-v2.js` - The main ingestion endpoint (Validation, Data Lake insertion, Task queuing).
* `/trigger/processLead.js` - The asynchronous step-function task (Retries, Circuit Breaking).
* `/lib/db.js` - PostgreSQL connection and lazy-loading table creation.
* `/lib/dedup.js` - Redis implementation for deduplication and Hot Spike tracking.
* `/lib/hubspot.js` - CRM logic featuring Redis caching for API throttling protection.
* `/lib/ai.js` - OpenAI prompt engineering and generation.

---

## Guide

This project is built to gracefully handle missing API keys via a dry-run / fallback mechanism. To demonstrate the flow without hitting live production CRMs:

1. Send a mock `POST` request to `/api/webhook-v2` with the `x-webhook-secret` header.
2. Provide a mock JSON payload:
```json
{
  "email": "test@acmecorp.com",
  "first_name": "John",
  "last_name": "Doe",
  "company_domain": "acmecorp.com",
  "job_title": "Chief Technology Officer",
  "page_url": "/enterprise-pricing"
}
```
3. Observe the logs as the pipeline strictly types the data, writes to the Postgres Data Lake, queues the background job, passes the Redis deduplication gate, falls back the AI generation, and completes the parallel executions.
