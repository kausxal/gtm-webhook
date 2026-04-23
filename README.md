# Go-to-Market Webhook Integration

This repository contains a production-ready, serverless webhook built to process inbound lead data from RB2B. It automatically deduplicates, validates, scores, and routes visitor data to your Go-to-Market stack (HubSpot, HeyReach, Instantly, and Slack).

## Architecture Overview

The system is designed to run on Vercel's Serverless Functions.

1. **Endpoint Reception**: The main endpoint (`/api/webhook`) receives the payload, validates the secret key, and strictly verifies the data format using Zod.
2. **Asynchronous Background Processing**: To prevent timeouts from RB2B, the endpoint uses Vercel's `waitUntil` function. It instantly returns a 200 OK response to RB2B while seamlessly continuing to process the data in the background.
3. **Deduplication**: Vercel KV (Redis) is used to check if the lead was processed within a defined time window.
4. **Enrichment and Routing**: 
   - Queries HubSpot to see if the contact already exists or is in a blocked lifecycle stage.
   - Calculates an Ideal Customer Profile (ICP) score based on industry, title, and company size.
   - Pushes hot leads to HeyReach and Instantly in parallel.
   - Sends targeted alerts to Slack based on the lead's qualification tier.

## Directory Structure

* `/api/webhook.js`: The central ingestion point. Handles security validation, Zod parsing, deduplication, and all third-party integrations using background execution.
* `/lib/dedup.js`: Connects to Vercel KV to prevent duplicate leads from entering the pipeline.
* `/lib/hubspot.js`: Manages querying and creating contacts in HubSpot CRM.
* `/lib/icp.js`: Contains the scoring algorithm to determine lead quality.
* `/lib/heyreach.js`: Handles adding prospects to LinkedIn automation campaigns via HeyReach.
* `/lib/instantly.js`: Handles enrolling prospects into email sequences via Instantly.
* `/lib/slack.js`: Manages formatting and sending notifications to your Slack workspace.

## Environment Variables

To run this project, you need to configure the following environment variables in your Vercel dashboard:

### Platform & Security
* `RB2B_SECRET`: A custom string you generate to authenticate incoming requests from RB2B.

### Integration Keys
* `HUBSPOT_API_KEY`: A private app token from your HubSpot account with read/write access to contacts.
* `HEYREACH_API_KEY`: Your HeyReach API key.
* `HEYREACH_CAMPAIGN_ID`: The specific campaign ID in HeyReach where leads should be added.
* `INSTANTLY_API_KEY`: Your Instantly API key.
* `INSTANTLY_CAMPAIGN_ID`: The specific campaign ID in Instantly where leads should be enrolled.
* `SLACK_WEBHOOK_URL`: The incoming webhook URL for your designated Slack channel.

### ICP Scoring Configuration
* `ICP_INDUSTRIES`: Comma-separated list of target industries (e.g., SaaS, B2B Tech, Fintech).
* `ICP_TITLES`: Comma-separated list of target job titles (e.g., Founder, CEO, CMO).
* `ICP_MIN_EMPLOYEES`: Minimum employee count for a qualified account.
* `ICP_MAX_EMPLOYEES`: Maximum employee count for a qualified account.
* `ICP_MIN_SCORE`: The threshold score required (0-100) to trigger outreach actions.
* `DEDUP_WINDOW_DAYS`: The number of days to wait before allowing the same email to be processed again.

## Deployment & Configuration

### 1. Deploy to Vercel
Push this repository to GitHub and import it into Vercel. Ensure all environment variables listed above are added to the project settings.

### 2. Configure Vercel KV
In the Vercel Dashboard, navigate to the Storage tab and create a new KV database. Link it to this project to enable deduplication.

### 3. Configure Axiom Logging (Optional but Recommended)
For deep observability, navigate to the Integrations tab in Vercel and install Axiom. It will automatically capture all structured logs output by the webhook, allowing you to trace errors and monitor lead flow without any additional code configuration.

## Development

To run this application locally for testing:

1. Install the Vercel CLI.
2. Run `vercel dev` to start the local development server.
3. Use a tool like cURL or Postman to send a test POST request to `http://localhost:3000/api/webhook`.

Make sure to include the `x-webhook-secret` header in your test requests to bypass the security check.
