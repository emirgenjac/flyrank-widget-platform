# Design worksheet

This is not the Phase 1 design document yet. It records decisions that are already locked. Open sections are the Phase 1 tasks in `AGENTS.md`. Do not start application code until the Phase 1 gate is met: this file is a single page of finished design, and it is committed only when a commit is requested.

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

Open. Phase 1 fills fields, types, and nullability.

Required concepts, not a finished schema:

- Type: `signup`, `cta`, or `popover`. One or two types are enough to implement if the model can hold the others.
- Title, description, form fields, button text, display options.
- Tenant id.
- Public id used by the embed snippet.
- Unique public id index.

## Submission model

Open. Phase 1 fills fields, types, and nullability.

Required concepts, not a finished schema:

- Validated payload.
- Widget id and tenant id.
- Client IP.
- Nullable geo (country and city). Missing geo is a valid stored row.
- Honeypot result.
- Idempotency key, unique.
- Timestamps.
- Index for submissions by widget and time.

## Tenancy and indexes

Open. Phase 1 names each index and states which owner queries must include the tenant filter.

## Embed flow

The sequence is locked. The payloads are open.

1. The owner creates a widget and receives one `script` line.
2. The customer page loads the versioned bundle from a URL that changes when the file changes.
3. The bundle fetches `GET /widgets/:id/config` (small body, short `Cache-Control` max-age).
4. The widget renders a form and a submit button.
5. The visitor posts to `POST /submissions` from a different origin than the API.

## API contracts

Open. Phase 1 writes method, path, auth, status codes, and a short request and response example for each route below. Do not invent new routes in Phase 3.

### Owner path: widget management

- Authenticated CRUD for widgets.
- Missing or invalid auth is rejected.
- Responses are limited to the caller's tenant.

### Public path: delivery

- One-line embed snippet per widget.
- Versioned widget JavaScript with a long cache lifetime.
- Public config with a short `Cache-Control` max-age and a small payload.
- CORS allowed for the customer page origin.

### Public path: submission

- `OPTIONS /submissions` answers the preflight.
- `POST /submissions` accepts a cross-origin form post.
- Malformed body: 4xx JSON.
- Oversized body: 4xx JSON (413).
- Rate limit exceeded: 429, then a normal request still works.
- Honeypot filled: not stored, and the body does not reveal why.
- Success: 2xx, row linked to the widget and tenant, geo attached when a provider answers.

### Owner path: dashboard

- Authenticated.
- Tenant scoped, including submissions.
- List submissions.
- Counts over time.
- Per-widget stats.
- Geo breakdown.

## Phase 1 gate

This worksheet becomes the design document only when the open sections above are filled and the whole document is still about one page. Application code waits until that gate is met.
