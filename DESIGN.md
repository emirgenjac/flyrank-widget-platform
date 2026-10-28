# Design

A tenant defines a widget and receives one script line. A visitor on another origin submits the form. This API validates the body, drops a filled reserved field, adds geo when a provider answers, stores the row, and lets that tenant read it. Column rules and route examples live in the code named below. This page is the Phase 1 design.

## Stack

Node.js, Express, and Zod, with PostgreSQL through Docker Compose. Schema changes are migrations. Code is split into `src/http`, `src/logic`, `src/data`, and `src/jobs`. Secrets stay in the environment and are never logged. The product does not call an AI API.

## Non-goal

A real CDN, domain, or hosted deployment is a non-goal, so the API and the customer page stay on local ports.

## Widget

`widgets` stores `id`, a unique 12 character `public_id`, an immutable `tenant_id`, `type` (`signup`, `cta`, or `popover`), `title`, a nullable `description`, up to 8 `fields`, `button_text`, and `display_options` (`placement`, `theme`). A signup widget needs an email field. The other types may have none. The script adds `company_website`. That name is not an owner field. `src/logic/widget.js` and `migrations/001_widgets.sql` enforce this. `id`, `public_id`, `tenant_id`, and `created_at` do not change.

## Submission

`POST /submissions` takes at most 8 KiB of JSON: `public_id`, `idempotency_key`, `fields`, and optional `company_website`. The stored IP comes from the connection. `payload` is the validated fields only. `geo` is null when both providers fail, and the row is still stored. When present, geo is `country_code`, `country`, and nullable `city`, with `geo_provider` set to `ip-api.com` or `ipapi.co`. A filled `company_website` is not stored, and the response is `{ "ok": true }` with no explanation. The same key and payload returns the existing row. A different payload is 409. The row has `created_at` and no `updated_at`. `src/logic/submission.js` and `migrations/002_submissions.sql` enforce this.

## Tenancy

Every owner query is built in `src/data/ownerQueries.js` and includes `WHERE tenant_id = $1`. The indexes are a unique `widgets.public_id`, `widgets (tenant_id)`, a unique `submissions.idempotency_key`, `submissions (widget_id, created_at)`, and `submissions (tenant_id)`.

## Embed

The snippet is `<script src="{origin}/widget.{version}.js" data-widget-id="{public_id}"></script>`. A new version is a new script URL, cached with `public, max-age=31536000, immutable`. `GET /widgets/{public_id}/config` returns `id`, `type`, `title`, `description`, `fields`, `button_text`, `display_options`, and `submit_url`, with no tenant id, cached for 60 seconds. The form posts `public_id`, `idempotency_key`, `fields`, and an empty `company_website`. `src/logic/embed.js` builds these payloads.

## API

`src/http/contracts.js` lists every route, with auth, status codes, and one example. Do not add paths beyond that file. Bearer routes take the tenant from the token. A missing or invalid token is 401. Public routes are `GET /widget.:version.js`, `GET /widgets/:publicId/config`, `OPTIONS /submissions`, and `POST /submissions`. Owner routes are widget CRUD and `GET /widgets/:id/embed`. Dashboard routes are `GET /dashboard/submissions` and `GET /dashboard/stats` (counts over time, per widget, and geo). `:id` is the widget uuid. `:publicId` is the snippet id. A stored submit is 201. Bad input is 4xx JSON, never 500. Oversized is 413. A burst is 429, and the next normal request still works.

## Failure behavior

Geo tries ip-api.com, then ipapi.co. `GEO_MODE=mock` proves one provider down and both down. The email or webhook runs after the insert, in a job with retries and a failure alert. `SIDE_EFFECT_FORCE_FAIL=true` still returns success and keeps the row. The same idempotency key does not store or send twice.
