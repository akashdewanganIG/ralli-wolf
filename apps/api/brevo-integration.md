# Brevo integration

Brevo is the provider behind CRM email campaigns. The integration synchronizes
eligible leads, exposes provider campaign management, sends selected campaign
content as transactional messages, records durable delivery state, ingests
engagement webhooks, and returns aggregate SMTP statistics.

## Configuration

Configure the integration through **Integration Manager**:

- Provider `email` stores the encrypted Brevo API key.
- `email.baseUrl` optionally overrides `https://api.brevo.com/v3`. Overrides
  are restricted to an approved Brevo HTTPS origin.
- `email.webhookSecret` stores the encrypted webhook authentication secret.

`BREVO_WEBHOOK_SECRET` is a deployment fallback for the webhook secret. The API
key is deliberately not read from an environment variable.

All non-webhook routes require an authenticated staff session and the
`campaigns.manage` permission.

## Routes

| Method   | Route                             | Purpose                                                                                       |
| -------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST`   | `/api/brevo/sync-leads`           | Synchronize 1–500 unique, active, email-eligible leads.                                       |
| `GET`    | `/api/brevo/campaigns`            | List provider campaigns with provider-side pagination and optional exact status filtering.    |
| `GET`    | `/api/brevo/campaigns/:id`        | Read one provider campaign; `statistics` accepts a documented Brevo statistics selector.      |
| `PUT`    | `/api/brevo/campaigns/:id`        | Update a strict allowlist of campaign fields. Only provider-editable campaign states succeed. |
| `PUT`    | `/api/brevo/campaigns/:id/status` | Apply one documented Brevo status action.                                                     |
| `DELETE` | `/api/brevo/campaigns/:id`        | Delete a provider campaign.                                                                   |
| `POST`   | `/api/brevo/send-campaign`        | Send a provider campaign to 1–500 eligible, synchronized leads.                               |
| `GET`    | `/api/brevo/analytics`            | Return aggregate SMTP metrics and total/sent campaign counts.                                 |
| `GET`    | `/api/brevo/test-connection`      | Verify the configured credential without returning account details.                           |
| `POST`   | `/api/brevo/webhooks`             | Authenticate and ingest a flat event or a batch of up to 500 events.                          |

List query bounds are `limit=1..100` and a non-negative integer `offset`.
Accepted list statuses are `draft`, `sent`, `archive`, `queued`, `suspended`,
and `in_process`.

## Delivery guarantees

`send-campaign` creates a local campaign/channel link and one durable delivery
row per normalized email address. Each provider request has a deterministic
idempotency key. A confirmed provider response is recorded as sent and linked
to a campaign member transactionally. Rejected requests may be retried within
the attempt limit; network or server outcomes that could have been accepted by
Brevo are quarantined as `OUTCOME_UNKNOWN` for manual reconciliation instead
of being blindly resent.

Deleted leads, email opt-outs, unsynchronized leads, duplicate email addresses,
and leads whose eligibility changes during processing are not sent.

## Webhooks

Configure Brevo to send transactional and marketing events to
`/api/brevo/webhooks`. The handler accepts Brevo's flat event object or batch
array—not a nested `{ "event": ... }` wrapper.

Authenticate the webhook using one of the following with the configured secret:

- `Authorization: Bearer <secret>`
- `X-Webhook-Secret: <secret>`
- `X-Brevo-Signature: sha256=<hex HMAC-SHA256 of the exact request body>`

Authentication is fail-closed. Authenticated payloads are deduplicated for 24
hours before database ingestion. Processing failures release the receipt so a
provider retry can succeed.

Hard bounces, blocked/invalid addresses, unsubscribes, and spam complaints set
email suppression on every active CRM lead with the normalized email. Soft
bounces do not suppress. Known engagement events update lead score and create
analytics records transactionally; unknown event names are acknowledged but
have no side effects.

## Verification

Run deterministic validation, webhook, and idempotency tests:

```powershell
npx tsx --test "apps/api/test/brevo-*.test.ts" apps/api/test/validators.test.ts
```

Then run both package type checks:

```powershell
npm run check-types -w api
npm run check-types -w web
```

Provider smoke tests require a non-production Brevo account, a configured
Integration Manager credential, an authenticated staff session, and test leads
that are safe to contact. Never use fabricated production IDs or direct SQL
inserts as a substitute for the application workflow.
