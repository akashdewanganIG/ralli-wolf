# Email OTP authentication

Ralli Wolf supports password login and one-time codes delivered by Resend. The two methods issue the same application session and preserve the existing role and route protections.

## Required configuration

Add these values to the API environment:

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Ralli Wolf <auth@example.com>"
RESEND_REPLY_TO=support@example.com
```

`RESEND_FROM_EMAIL` must use a sender on a domain verified in the Resend account. `RESEND_REPLY_TO` is optional. Never commit the API key.

Apply the database migration before enabling OTP login in a deployed environment:

```bash
npm run db:deploy
```

## API flow

1. `POST /api/auth/login/otp/request` with `{ "email": "user@example.com" }`.
2. Show the same success message regardless of whether the account exists.
3. `POST /api/auth/login/otp/verify` with `{ "email": "user@example.com", "otp": "123456" }`.
4. Persist the returned token and user with the same client flow used for password login.

Codes are six digits, expire after ten minutes, allow five verification attempts, and are single-use. Only bcrypt hashes are stored. Request and verification endpoints have separate rate limits, prior active codes are invalidated, and code consumption uses an atomic database claim to prevent concurrent replay.

If Resend delivery fails, the created code is invalidated and the API logs the request identifier without logging the email address or OTP. The public response remains generic to avoid exposing registered accounts.

## Operational checks

- Verify the sending domain and sender address in Resend.
- Confirm the migration is applied before starting the API release.
- Request a code for a non-privileged staging user and verify delivery, expiry, resend, invalid-code, and replay behavior.
- Monitor API logs and Resend delivery events without recording OTP values.
- For horizontally scaled API deployments, replace the in-memory request limiter with the platform's shared rate-limit store.
