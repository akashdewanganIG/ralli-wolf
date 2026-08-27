# Email OTP authentication

Signing in is two steps: a password, then a second factor. The second factor is
an authenticator code when the account has one enrolled, and an emailed
six-digit code otherwise. Both produce the same session token, and the existing
role and route protections are unchanged.

## Required configuration

Add these values to the API environment:

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Ralli Wolf <auth@example.com>"
RESEND_REPLY_TO=support@example.com
```

`RESEND_FROM_EMAIL` must use a sender on a domain verified in the Resend
account. `RESEND_REPLY_TO` is optional; omit it to send with no reply address.
Never commit the API key.

Resend is the transport for **all** application email — sign-in codes, security
alerts, account credentials, password resets, approvals, notifications and
quotes. There is no second provider.

Apply the database migrations before enabling OTP login in a deployed
environment:

```bash
npm run db:deploy
```

## API flow

1. `POST /api/auth/login` with `{ "email": "...", "password": "..." }`.
   On success it returns `mfaRequired: true`, a short-lived `mfaToken`, a
   `maskedEmail`, and `factor` — `"email"` or `"totp"` — telling the client
   which challenge to present. No session token is issued here.
2. If `factor` is `"email"`, a code has already been sent. If it is `"totp"`,
   nothing was sent and the user reads the code from their authenticator.
3. `POST /api/auth/login/otp/verify` with `{ "mfaToken": "...", "otp": "123456" }`
   returns the session `token` and `user`.
4. `POST /api/auth/login/otp/resend` with `{ "mfaToken": "..." }` mails a
   replacement code. It requires the MFA token, so codes cannot be triggered by
   anyone who has not already passed the password check. This route mails a
   code even for an account whose preferred factor is `totp`, which is what
   backs the client's "email a code instead" fallback.

There is no endpoint that mails a code from an email address alone.

Codes are six digits, expire after ten minutes, allow five verification
attempts, and are single-use. Only bcrypt hashes are stored. Requesting a new
code invalidates any code still outstanding for that user, so only the most
recently sent code can be redeemed. Consumption uses an atomic database claim,
so two concurrent requests carrying the same code cannot both succeed.

## Second factors and the two-method rule

`emailOtpVerifiedAt` and `totpVerifiedAt` on `users` record which methods an
account has proved. An account must keep at least two verified methods, and
`emailOtpVerifiedAt` is defaulted on insert — an account with neither factor
verified has no working second step, and `/login` would report a challenge it
never issued. `/login` also falls back to mailing a code whenever the preferred
factor is not `totp`, so a stranded account can still sign in.

## Delivery failures

If Resend rejects a sign-in code, the created code is invalidated and `/login`
returns `503` with `OTP_DELIVERY_FAILED`. The API logs the request identifier
and Resend's message id, and never logs the email address or the code itself.

That message id is the only handle tying a row in `login_otps` to a message in
the Resend dashboard. When someone reports a code that never arrived, find the
`Login OTP dispatched` log line for their request id and search that id in
Resend.

Note that Resend reporting `delivered` means the recipient's mail server
accepted the message — not that it reached the inbox. A message can be
delivered and then quarantined or filed as junk by the recipient's provider,
and that decision is frequently made per-recipient rather than per-domain. If
Resend shows `delivered` and the user still has nothing, the next step is a
message trace on the receiving side, not a change here.

## Operational checks

- Verify the sending domain and sender address in Resend, including SPF and
  DKIM on the domain the `From` address actually uses.
- Confirm migrations are applied before starting the API release.
- Request a code for a non-privileged staging user and verify delivery, expiry,
  resend, invalid-code, and replay behavior.
- Monitor API logs and Resend delivery events without recording OTP values.
- For horizontally scaled API deployments, replace the in-memory request
  limiter with the platform's shared rate-limit store.
