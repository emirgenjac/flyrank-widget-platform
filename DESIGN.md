# Design worksheet

This is not the Phase 1 design document yet. It records decisions that are already locked. Filled sections are done. Open sections are the remaining Phase 1 tasks in `AGENTS.md`. Do not start application code until the Phase 1 gate is met: this file is a single page of finished design. When that gate is met, give Emir a commit message. Do not commit it.

Source of truth: `Lead-Capture Platform Live Capstone.pdf`. Section 6 is required in full. Section 8 sets the order. Section 7 is where to stop.

## Locked decisions

- Language and framework: Node.js and Express.
- Validation: Zod at the HTTP boundary. Bad input returns 4xx JSON and never 500.
- Database: PostgreSQL via Docker Compose. Schema changes are migrations.
- Layout: HTTP, logic, data, and jobs stay separated.
- Spam control: a honeypot field. Probe 6 requires it. A filled honeypot is not stored, and the response does not explain the rule.
- Geo chain: provider A is ip-api.com, provider B is ipapi.co. `GEO_MODE=mock` plus `GEO_MOCK_A_DOWN` and `GEO_MOCK_B_DOWN` make the proof deterministic. Both providers down still stores the submission with no geo.
- Side effect: confirmation email or webhook runs in a background job, off the request path, with retries and a failure alert. `SIDE_EFFECT_FORCE_FAIL=true` must still return success and keep the row. The job is idempotent.
- Rate limits: per IP and per widget. A burst returns 429. The next legitimate request still succeeds.
- Idempotency: a retried submission stores once, and the side effect sends once.
- Tenancy: every owner query filters by tenant. Tenant A cannot read or change tenant B widgets or submissions.
- Secrets: environment variables only, never logged, never committed.
- Product AI: none. Cost tracking is not applicable. Do not add an AI feature to satisfy that shared requirement.
- Writing: do not use em dashes anywhere in this project.

## Explicit non-goal

Phase 1 picks one explicit non-goal from the Section 7 limits and writes it here in one sentence.

Open: _not chosen yet._

## Widget model

Table `widgets`. One row is one widget owned by one tenant. The server generates `id` and `public_id`. The owner cannot send either, and cannot change `tenant_id` after create.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid | not null | Primary key. Submissions reference this. |
| `public_id` | text | not null | Unique. 12 chars from `A-Za-z0-9`. This is the snippet id. |
| `tenant_id` | uuid | not null | Foreign key to `tenants`. Immutable. |
| `type` | text | not null | `signup`, `cta`, or `popover`. |
| `title` | text | not null | 1 to 120 characters. |
| `description` | text | null | Optional copy. When set, 1 to 500 characters. |
| `fields` | jsonb | not null | Array of field objects. Default `[]`. At most 8. |
| `button_text` | text | not null | 1 to 40 characters. |
| `display_options` | jsonb | not null | Object. Always stored with `placement` and `theme`. |
| `created_at` | timestamptz | not null | Set by the database on insert. |
| `updated_at` | timestamptz | not null | Set by the database on insert and update. |

`fields` items are objects, not free-form JSON:

| Key | Type | Null | Rule |
| --- | --- | --- | --- |
| `name` | text | not null | 1 to 40 chars. `a-z`, digits, underscore. Unique inside the widget. |
| `label` | text | not null | 1 to 80 characters. |
| `input_type` | text | not null | `email`, `text`, or `tel`. |
| `required` | boolean | not null | Owner sets this. |

`type` decides whether `fields` may be empty:

- `signup`: at least one field, and one of them has `input_type` `email`.
- `cta` and `popover`: empty is allowed. The same field rules apply when fields are present.

`display_options` has two keys. Both are stored, so the public config does not invent defaults.

| Key | Type | Null | Rule |
| --- | --- | --- | --- |
| `placement` | text | not null | `inline`, `bottom-right`, or `center`. |
| `theme` | text | not null | `light` or `dark`. |

If the owner omits them, the server stores `placement` `inline` for `signup` and `cta`, `bottom-right` for `popover`, and `theme` `light`.

The honeypot is not a widget column and not an owner field. The script adds a reserved input named `company_website`. Creating a field with that name is a 4xx. Page targeting, delay, and once-per-visitor are stretch goals, so they are not keys in `display_options`.

`src/logic/widget.js` checks this on input. `migrations/001_widgets.sql` checks it again in the database. A before-update trigger rejects changes to `id`, `public_id`, `tenant_id`, and `created_at`, and sets `updated_at`. The `tenants` table in that migration is only the foreign key target. Users and submissions are later migrations.

## Submission model

Table `submissions`. One row is one accepted visitor submission. The server generates `id` and `created_at`. The visitor never sends `widget_id`, `tenant_id`, `client_ip`, or `geo`. A filled honeypot does not insert a row.

The request body is JSON, at most 8 KiB. A larger body is 413. Malformed JSON is 400. Both are JSON errors, never 500.

| Request field | Type | Null | Rule |
| --- | --- | --- | --- |
| `public_id` | text | not null | 12 characters from `A-Za-z0-9`. Resolved to `widgets.id`. Unknown id is 404. |
| `idempotency_key` | uuid | not null | Client generated. The same key must not store a second row. |
| `fields` | object | not null | Keys are that widget's field names. Values are strings, trimmed, 1 to 500 characters. |
| `company_website` | text | null | Omitted or empty is a pass. Any other value is not stored. |

`fields` must include every widget field marked required. An `email` input must contain one `@` and no spaces. Unknown keys are 400. An optional empty string is dropped, not stored.

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | uuid | not null | Primary key. |
| `widget_id` | uuid | not null | Foreign key to `widgets.id`. Immutable. |
| `tenant_id` | uuid | not null | Foreign key to `tenants.id`. Must equal that widget's tenant. Immutable. |
| `payload` | jsonb | not null | The validated `fields` object only. |
| `client_ip` | inet | not null | Taken from the connection. An IP in the body is ignored. |
| `geo` | jsonb | null | Null when both providers fail. The row is still stored. |
| `geo_provider` | text | null | `ip-api.com` or `ipapi.co`. Null only when `geo` is null. |
| `honeypot_result` | text | not null | Stored value is always `pass`. A filled honeypot never becomes a row. |
| `idempotency_key` | uuid | not null | Unique. |
| `created_at` | timestamptz | not null | Set by the database on insert. |

There is no `updated_at`. A stored submission does not change.

When `geo` is present it has this shape. `city` may be null. The other two keys may not.

| Key | Type | Null | Rule |
| --- | --- | --- | --- |
| `country_code` | text | not null | Two letters. |
| `country` | text | not null | 1 to 80 characters. |
| `city` | text | null | When set, 1 to 80 characters. |

The same `idempotency_key` and the same `public_id` plus the same `fields` returns the existing row and does not send another email. The same key with a different widget or different `fields` is 409.

`src/logic/submission.js` checks the request. `migrations/002_submissions.sql` stores the row. A filled `company_website` returns a drop result with no explanation. The database rejects updates.

## Tenancy and indexes

Owner reads go through `src/data/ownerQueries.js`. Every statement there has `WHERE tenant_id = $1`. A missing tenant id throws before a query exists.

| Index | Where | Purpose |
| --- | --- | --- |
| Unique `widgets.public_id` | `001_widgets.sql` | Snippet id |
| `widgets (tenant_id)` | `001_widgets.sql` | Owner widget list |
| Unique `submissions.idempotency_key` | `002_submissions.sql` | One row per retry key |
| `submissions (widget_id, created_at)` | `002_submissions.sql` | Submissions for one widget, newest last in the index order |
| `submissions (tenant_id)` | `002_submissions.sql` | Owner submission list |

## Embed flow

`src/logic/embed.js` builds the four payloads. The customer page and the HTTP routes come later.

1. Snippet, one line: `<script src="{origin}/widget.{version}.js" data-widget-id="{public_id}"></script>`.
2. The script URL changes when `version` changes. Its cache header is `public, max-age=31536000, immutable`. The public id is not in that URL.
3. Config is `GET /widgets/{public_id}/config`. The body is `id`, `type`, `title`, `description`, `fields`, `button_text`, `display_options`, and `submit_url`. No tenant id and no internal id. Cache header is `public, max-age=60`.
4. Render uses that config: the form fields, a submit button, and an empty `company_website` input.
5. Submit posts JSON to `{origin}/submissions` with `public_id`, `idempotency_key`, `fields`, and `company_website` set to an empty string.

## API contracts

`src/http/contracts.js` is the route list. Each entry has the method, path, auth, status codes, and a short request and response example. Phase 2 and Phase 3 use these paths. They do not add new ones.

Bearer routes take the tenant from the token. A missing or invalid token is 401 `{ "error": "unauthorized" }`. Public routes do not use auth.

| Method | Path | Auth | Statuses |
| --- | --- | --- | --- |
| POST | `/widgets` | bearer | 201, 400, 401 |
| GET | `/widgets` | bearer | 200, 401 |
| GET | `/widgets/:id` | bearer | 200, 401, 404 |
| PATCH | `/widgets/:id` | bearer | 200, 400, 401, 404 |
| DELETE | `/widgets/:id` | bearer | 204, 401, 404 |
| GET | `/widgets/:id/embed` | bearer | 200, 401, 404 |
| GET | `/widget.:version.js` | none | 200, 404 |
| GET | `/widgets/:publicId/config` | none | 200, 404 |
| OPTIONS | `/submissions` | none | 204 |
| POST | `/submissions` | none | 200, 201, 400, 404, 409, 413, 429 |
| GET | `/dashboard/submissions` | bearer | 200, 401 |
| GET | `/dashboard/stats` | bearer | 200, 401 |

`:id` is the widget uuid. `:publicId` is the 12 character snippet id. The script cache header is `public, max-age=31536000, immutable`. The config cache header is `public, max-age=60`. `POST /submissions` returns 201 when a row is stored, 200 `{ "ok": true }` when the reserved input is filled, 409 when the idempotency key is reused with different fields, 413 when the body is over 8 KiB, and 429 when a limit is exceeded. `GET /dashboard/stats` returns `counts_over_time`, `widgets`, and `geo`.

## Phase 1 gate

This worksheet becomes the design document only when the open sections above are filled and the whole document is still about one page. Application code waits until that gate is met.
