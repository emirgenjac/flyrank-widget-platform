# Embeddable Widget and Lead-Capture Platform

A customer defines a widget, receives one line of `script`, and pastes it into any site. Visitors submit that form to this API. The API validates the payload, filters spam, enriches it with location data, stores it, and shows it to the widget owner.

This is a backend capstone. The public internet is the client: untrusted input, unknown origins, and traffic you do not control.

## Setup

From this directory:

```text
npm install
docker compose up
```

Postgres is published on port 5435, beside a local Postgres on 5432. Wait until this returns `{ "ok": true, "db": "up" }`:

```text
GET http://127.0.0.1:3010/health
```

Then load the two demo tenants:

```text
npm run seed
```

The command prints `owner-a@example.com` and `owner-b@example.com`, their tenant ids, and the password it used. Set `SEED_PASSWORD` in the environment before the command to choose that password. A second run keeps the existing password and does not insert the rows again.

Open the customer page at `http://127.0.0.1:8080`. It is a different origin from the API at `http://127.0.0.1:3010`. The page includes the snippet for widget `demoAwidget1`.

`docker compose --profile mail up` also starts Mailpit on ports 1025 and 8025. The plain `up` command does not. Confirmation email stays on the API console unless `EMAIL_MODE=smtp`.

Copy `.env.example` to `.env` only when you want to override the Compose environment. `.env` is gitignored. Compose already sets the local API environment.

`npm test` runs the checks.

## Architecture

Three request paths stay separate.

```text
Widget owner (authenticated)
    -> Widget management API -> Postgres (tenant filter on every query) -> one-line embed snippet

Customer website (http://127.0.0.1:8080)
    <script src="http://127.0.0.1:3010/widget.v1.js" data-widget-id="demoAwidget1"></script>
          -> GET /widgets/demoAwidget1/config   (public, max-age 60)
                -> form and submit button

Website visitor
    -> POST /submissions   (public, CORS)
          | validation            bad payload -> 4xx, never 500
          | per-IP and per-widget limits -> 429, then a normal request still succeeds
          | filled reserved field -> 200 and no stored row
          | geo: provider A, then provider B, then store with no geo
          | store submission
          | confirmation job after the response. A thrown job still returns success

Widget owner (authenticated)
    -> GET /dashboard/submissions and GET /dashboard/stats
```

Owner calls are authenticated and tenant-scoped. Script and config are public and cached. Submissions are public, cross-origin, and protected. Geo lookup and the confirmation job degrade. They never turn a valid submission into an error.

## Stack

- Node.js, Express, Zod
- PostgreSQL via Docker Compose
- Geo provider A: ip-api.com (no key)
- Geo provider B: ipapi.co (no key)
- Email side effect: console log, or Mailpit on localhost
- Customer site: a plain HTML file on port 8080

No credit card, no paid tier, no real CDN, domain, or hosting.

## API documentation

Examples with status codes live in `src/http/contracts.js`. `:id` is the widget uuid. `:publicId` is the 12 character snippet id.

Health

- `GET /health` returns `{ "ok": true, "db": "up" }` after migrations. No auth.

Auth

- `POST /auth/register` creates a tenant and a user. 201 returns a bearer token. Duplicate email is 409. A bad body is 400.
- `POST /auth/login` returns a bearer token. A wrong password is 401. The password hash is never returned.

Widgets, bearer token, tenant from that token

- `POST /widgets` creates a widget and returns the one-line embed snippet. 201, 400, or 401.
- `GET /widgets` lists the caller's widgets.
- `GET /widgets/:id` reads one widget. Another tenant's id is 404.
- `PATCH /widgets/:id` updates it. 400 when the body is invalid.
- `DELETE /widgets/:id` returns 204. 409 when the widget has submissions.
- `GET /widgets/:id/embed` returns `{ "embed": "<script ...></script>" }`.

Public delivery

- `GET /widget.v1.js` is the widget script. `Cache-Control` is `public, max-age=31536000, immutable`. A different version token is 404. Changing the script means changing `WIDGET_ASSET_VERSION`, which changes the URL.
- `GET /widgets/:publicId/config` is the small public payload. `Cache-Control` is `public, max-age=60`. It echoes a safe `Origin`. No tenant id.

Submissions, no auth

- `OPTIONS /submissions` is the preflight. 204, with `POST, OPTIONS` and `Content-Type`.
- `POST /submissions` stores a valid body once for that widget and tenant. 201 on insert, 200 when the same idempotency key is replayed. A different payload for that key is 409. Malformed JSON is 400. An oversized body is 413. Unknown widget is 404. A burst past the per-IP or per-widget limit is 429, and a later request inside the limit still succeeds. A filled reserved field returns `{ "ok": true }` and stores nothing. The response does not explain that rule.

Dashboard, bearer token, same tenant rule as widgets

- `GET /dashboard/submissions` lists that tenant's rows.
- `GET /dashboard/stats` returns counts by UTC day, a count per widget, and a count per country. A missing token is 401.

## Limitations

These are the scope stops from the brief. They are not bugs.

- No real CDN, domain, or hosted deployment. The API and the customer page stay on local ports.
- The customer site is one plain HTML page on port 8080.
- The widget UI is a form and a submit button.
- Signup and call-to-action widgets are enough. The model can also store a popover.
- Email is a console log, or local Mailpit. A thrown confirmation still returns success and keeps the row.
- Real geo APIs are for manual development. The graded fallback is `GEO_MODE=mock`, with `GEO_MOCK_A_DOWN` and `GEO_MOCK_B_DOWN`.
- Secrets stay in the environment. Do not commit `.env`, an API key, or an SMTP password.

## Required files

- `README.md`
- `capstone.yaml`
- `EVIDENCE.md`
- `BUILDLOG.md`
- `.env.example`
- `LICENSE` (MIT)

`AGENTS.md` is local agent guidance. It is listed in `.gitignore` and must not be committed.
