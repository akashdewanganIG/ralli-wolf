# Postman smoke collection

Import `crm-backend.postman-collection.json` into Postman and set these
collection variables locally:

- `base_url` — API origin, default `http://localhost:4000`
- `admin_email` — an existing administrator email
- `admin_password` — that account's current password
- `login_otp` — the one-time code delivered by the configured sign-in factor

Run the requests in order: **Start sign-in**, **Verify sign-in code**,
**Current user**, then **Logout**. The scripts retain the short-lived MFA token
and staff token only in Postman's local collection-variable state. The verify
request opts into non-browser bearer mode with `X-Session-Mode: bearer`;
ordinary browser sign-in returns no JavaScript-readable credential and uses an
HttpOnly cookie. The exported collection contains no credentials, hardcoded
bearer tokens, bootstrap routes, or provider secrets.

Create the first administrator with the out-of-band CLI documented in
`docs/local-setup.md`. The API intentionally exposes no test-admin or
developer-login endpoint.
