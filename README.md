# Embeddable Widget and Lead-Capture Platform

A customer defines a widget, receives one line of `script`, and pastes it into any site. Visitors submit that form to this API. The API validates the payload, filters spam, enriches it with location data, stores it, and shows it to the widget owner.

This is a backend capstone. The public internet is the client: untrusted input, unknown origins, and traffic you do not control.

## Status

`docker compose up` starts the API and Postgres. `GET http://127.0.0.1:3000/health` returns `{ "ok": true, "db": "up" }` after migrations run. `POST /auth/register` and `POST /auth/login` issue a bearer token. Owner widget CRUD stores rows for that token's tenant. A missing token is 401. Another tenant's widget id is 404. `OPTIONS /submissions` and `POST /submissions` are public. A malformed or oversized body is 4xx JSON. A valid submission is stored once for that widget and tenant. The same idempotency key returns the existing row, and a different payload is 409. A burst past the per-IP limit or the per-widget limit returns 429 and stores nothing. A request that is still inside its own limit still succeeds. Mock geo tries ip-api.com, then ipapi.co. Provider A down uses B. Both down still store the row with no geo. A filled reserved field returns `{ "ok": true }` and is not stored. After the row is stored, a background job sends the confirmation. It retries, then raises a failure alert. A forced failure still returns success and keeps the row. The same idempotency key does not send twice. Secrets are read from the environment. Log lines and 500 responses do not include them. `GET /widget.v1.js` serves the widget script with a one-year immutable cache. A different version token is 404. `GET /widgets/:publicId/config` returns the public widget payload with `max-age=60`. `npm run seed` does not exist yet. `capstone.yaml` stays `not_runnable` until the seed command and the rest of the public path exist. `npm test` checks the logic.

`docker compose --profile mail up` also starts Mailpit. The plain `up` command does not.

```text
docker compose up
```

## Architecture

Three request paths stay separate.

```text
Widget owner (authenticated)
    -> Widget management API -> Postgres (tenant-isolated) -> embed snippet

Customer website (a different origin)
    <script src="widget.v1.js?id=123"></script>
          -> GET /widgets/:id/config   (public, cached, CORS)
                -> render widget

Website visitor
    -> POST /submissions   (public, CORS)
          | validation            bad payload -> 4xx, never 500
          | rate limit + honeypot flood -> 429, service stays up
          | geo: Provider A fails -> Provider B fails -> store anyway
          | store submission
          | email or webhook job   failure must not block success

Widget owner (authenticated)
    -> Dashboard API <- submissions + stats
```

Owner calls are authenticated and tenant-scoped. Script and config are public and cached. Submissions are public, cross-origin, and protected. Geo lookup and the email or webhook job degrade. They never turn a valid submission into an error.

## Stack

- Node.js, Express, Zod
- PostgreSQL via Docker Compose
- Geo provider A: ip-api.com (no key)
- Geo provider B: ipapi.co (no key)
- Email side effect: console log, or Mailpit on localhost
- Customer site: a plain HTML file on a second local port

No credit card, no paid tier, no real CDN, domain, or hosting.

## Setup

Setup steps that a stranger can run are written in Phase 3, when `docker compose up` and the seed command actually boot the system. Copy `.env.example` to `.env` only after the app exists. `.env` is gitignored. `.env.example` is the committed placeholder file.

## API documentation

Route contracts are still open. They are filled in `DESIGN.md` during Phase 1, then copied here as the API reference during Phase 3.

## Limitations

These are the scope stops from the brief. They are not bugs.

- The customer site is a plain HTML file on a second local port, or a `file://` page. No hosting and no domain.
- The widget UI is a form and a submit button. The grade is the backend.
- One or two widget types are enough if the model can represent more.
- Email can be a console log or local Mailpit. What is graded is that a failure does not block the stored submission.
- Real geo APIs are for manual development. The fallback proof uses a deterministic mock: one provider answers, and one can be toggled down.
- Secrets live only in `.env`. Nothing secret is committed.

## Required files

- `README.md`
- `capstone.yaml`
- `EVIDENCE.md`
- `BUILDLOG.md`
- `.env.example`
- `LICENSE` (MIT)

`AGENTS.md` is local agent guidance. It is listed in `.gitignore` and must not be committed.
