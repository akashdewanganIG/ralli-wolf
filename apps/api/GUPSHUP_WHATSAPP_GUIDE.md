## Gupshup WhatsApp Phase 1 (Multi‑WABA, Reuse‑First)

This guide describes the implementation, user flow, CRM constraints, and Gupshup constraints for Phase 1 (template broadcasts) using the reuse‑first data model.

### Data Model (reused and generic additions)

- Reuse: `Campaign`, `CampaignMember`, `CampaignChannel`, `AnalyticsEvent`.
- Add:
  - `MessagingAccount` (provider=gupshup, WABA/app credentials and source phone)
  - `MessageTemplate` (provider template metadata, components)
  - `CampaignDelivery` (per‑recipient delivery state and timestamps)
  - `OptOut` (channel/address suppression)

### Backend modules (apps/api)

- Services (in `src/services/whatsapp`):
  - TemplateService: sync/list templates per `MessagingAccount`.
  - SendService: enqueue/send template messages (batch+throttle) and update `CampaignDelivery`.
  - WebhookService: normalize events (sent/delivered/read/failed/inbound) → `AnalyticsEvent` + update `CampaignDelivery`.
  - OptOutService: check and record suppressions.
  - Scheduler: in‑process queue with pause/cancel/backoff.
- Routes/Controllers:
  - Accounts: `POST/GET /whatsapp/accounts`
  - Templates: `GET /whatsapp/templates`, `POST /whatsapp/templates/sync`
  - Campaigns: `POST/GET /whatsapp/campaigns`, `GET /whatsapp/campaigns/:id`, actions: `/schedule`, `/send`, `/pause`
  - Events: `GET /whatsapp/events?campaignId=...`
  - Webhook: `POST /webhooks/gupshup`

### Environment/Config

- DB holds multiple `MessagingAccount` entries (4 WABAs). For local dev provide fallbacks:
  - `GUPSHUP_DEFAULT_API_KEY`, `GUPSHUP_DEFAULT_SOURCE`, `GUPSHUP_DEFAULT_APP_NAME`

### User flows (CRM)

1. Admin setup (one‑time per WABA)
   - Add a Messaging Account in Admin → WhatsApp Accounts: provider=gupshup, API key, source phone, app identifiers.
   - Press "Sync Templates" for each account.
   - Configure Gupshup portal to call `POST /webhooks/gupshup`.
2. Create a campaign
   - Step 1: Select WABA (MessagingAccount)
   - Step 2: Pick approved template and language; inspect variables/components
   - Step 3: Select audience (Contacts/Leads filters); dedupe and E.164 normalize
   - Step 4: Map variables, Schedule or Send Now (confirmation on large sends)
3. Monitor campaign
   - View KPIs (Queued/Sent/Delivered/Read/Failed), progress bar
   - Inspect deliveries table (per‑recipient) and errors; export failures
   - Pause/cancel as needed

### CRM constraints

- We only send approved templates. All variables must be resolved.
- Opt‑in required; `OptOut` checked before enqueueing.
- Throughput throttled (5–10 rps, tunable) and batched (50–100). Retries for transient failures; 4xx business errors marked failed.
- Session inbox and interactive follow‑ups are Phase 2.

### Gupshup constraints (self‑serve)

- Must have approved templates; free‑form outside 24h not allowed.
- Interactive elements must be part of an approved template type.
- Webhook endpoint must be configured in Gupshup app.
- Throughput/limits depend on WhatsApp tier and quality; we respect backoff.

### API notes

- Send (template): `POST https://api.gupshup.io/wa/api/v1/template/msg` with apikey header; form‑urlencoded.
- Templates: use Gupshup template list endpoint per app.
- Webhooks: normalize payload fields to our `AnalyticsEvent.eventData` and update `CampaignDelivery`.

### Go‑Live checklist

- [ ] Four Messaging Accounts created and active
- [ ] Webhook URL configured in Gupshup portal
- [ ] Templates synced and visible in Templates page
- [ ] Test send to a small audience
- [ ] Monitoring via Campaign detail works (sent/delivered/read)

### Troubleshooting

- Delivery shows failed: check template variables, opt‑in, country code formatting, and account throughput.
- Missing events: verify webhook URL and provider message id mapping.
