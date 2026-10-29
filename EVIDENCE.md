# Evidence

One pasted proof per requirement. A claim without a test name and output, a curl transcript, or a log line stays unchecked. Do not tick a box from memory.

Tick a box only when the proof under it is real command output. Empty slots stay empty.

## Section 6, widget management

- [x] Authenticated CRUD for widgets. Requests without valid auth are rejected.
  - Proof: 2026-10-28, API on `http://127.0.0.1:3010`. Login for tenant `576695d7-66f5-4ff5-a58c-1514e241c569` returned a token. The created widget was deleted after the reads and the update.

```text
GET /widgets missing-auth 401 application/json; charset=utf-8 {"error":"unauthorized"}
GET /widgets bad-token 401 application/json; charset=utf-8 {"error":"unauthorized"}
POST /widgets missing-auth 401 application/json; charset=utf-8 {"error":"unauthorized"}
POST /auth/login 200 tenant 576695d7-66f5-4ff5-a58c-1514e241c569 token true
POST /widgets 201 id dc7f3002-aa08-44b8-8707-933d5ffa78ac public_id 0bKJb9FAepag title Evidence form one-line true
GET /widgets 200 contains true
GET /widgets/:id 200 title Evidence form tenant 576695d7-66f5-4ff5-a58c-1514e241c569
PATCH /widgets/:id 200 title Evidence updated
GET /widgets/:id/embed 200 one-line true
PATCH /widgets/:id missing-auth 401 application/json; charset=utf-8 {"error":"unauthorized"}
DELETE /widgets/:id missing-auth 401 application/json; charset=utf-8 {"error":"unauthorized"}
DELETE /widgets/:id 204 body-length 0
GET /widgets/:id after-delete 404 application/json; charset=utf-8 {"error":"not found"}
```

- [x] Tenant A cannot read or modify tenant B widgets or submissions.
  - Proof: 2026-10-28, API on `http://127.0.0.1:3000`. Tenant A is `f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd`. Tenant B is `cf4a7880-7a28-4ad9-8079-f9ec7a2049b0`. Widget `fb6d430c-ee35-45c8-9c10-e127daab2253` belongs to A. `GET /dashboard/submissions` is not built yet, so the submission lines are the owner filter `WHERE tenant_id = $1` from `src/data/ownerQueries.js`, run in Postgres. The proof widget and submission were deleted after these results.

```text
login A 200 tenant f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd
login B 200 tenant cf4a7880-7a28-4ad9-8079-f9ec7a2049b0
A GET /widgets 200 count 1 id fb6d430c-ee35-45c8-9c10-e127daab2253 title Join the list tenant f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd
B GET /widgets/fb6d430c-ee35-45c8-9c10-e127daab2253 404 {"error":"not found"}
B PATCH /widgets/fb6d430c-ee35-45c8-9c10-e127daab2253 404 {"error":"not found"}
B DELETE /widgets/fb6d430c-ee35-45c8-9c10-e127daab2253 404 {"error":"not found"}
B GET /widgets/fb6d430c-ee35-45c8-9c10-e127daab2253/embed 404 {"error":"not found"}
B GET /widgets count 0
A GET /widgets/fb6d430c-ee35-45c8-9c10-e127daab2253 200 title Join the list tenant f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd
```

```text
INSERT 0 1
A listSubmissions count 1
B listSubmissions count 0
B listSubmissionsByWidget count 0
B INSERT on A's widget: ERROR: tenant_id must match the widget
B UPDATE widgets: UPDATE 0
B DELETE submissions: DELETE 0
widget title after B writes: Join the list, tenant f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd
submission tenant after B delete: f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd
```

Dashboard read, same day. Tenant A `7b8769ac-14b3-415a-9d0b-46ed3e6c8267` stored submission `6015efec-06d2-4ed0-be45-b76aae4cb2a7`. Tenant B `2a0704a8-6c63-4c55-b88e-23d9edc03eab` listed nothing. A missing token is 401.

```text
A GET /dashboard/submissions 200 count 1 id 6015efec-06d2-4ed0-be45-b76aae4cb2a7 tenant 7b8769ac-14b3-415a-9d0b-46ed3e6c8267
A GET /dashboard/stats 200 date 2026-10-28 count 1 widget GNHaiIm4O7Wk count 1 geo country_code null count 1
B GET /dashboard/submissions 200 count 0
B GET /dashboard/stats 200 widgets [] geo []
GET /dashboard/submissions without a token 401
```

Stats query for the older tenant `f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd`:

```text
counts 2026-10-28 count 4
widget mckICgybxZdo count 3
widget aFC44gyZ54ZY count 1
geo US count 3
geo null count 1
```

## Section 6, widget delivery

- [x] An embed snippet is generated per widget.
  - Proof: 2026-10-28. Port 3000 was already in use, so this API listened on `http://127.0.0.1:3010`. Create and `GET /widgets/:id/embed` returned the same one-line snippet. That script URL returned 200 with the long cache.

```text
POST /widgets 201
GET /widgets/:id/embed 200
<script src="http://127.0.0.1:3010/widget.v1.js" data-widget-id="6a4S9xP4LRHb"></script>
one line: true
GET /widget.v1.js 200
cache-control: public, max-age=31536000, immutable
```

- [x] The public config endpoint serves a small payload with `Cache-Control` and a `max-age`.
  - Proof: 2026-10-28. Widget `mckICgybxZdo`. Request `Origin` is `https://customer.example`. The body is 289 bytes and has no tenant id. A missing public id is 404 and is not cached.

```text
GET /widgets/mckICgybxZdo/config 200
cache-control: public, max-age=60
access-control-allow-origin: https://customer.example
vary: Origin
{"id":"mckICgybxZdo","type":"signup","title":"Geo check","description":null,"fields":[{"name":"email","label":"Email","input_type":"email","required":true}],"button_text":"Subscribe","display_options":{"placement":"inline","theme":"light"},"submit_url":"http://localhost:3000/submissions"}

GET /widgets/missing12345/config 404
cache-control: absent
```

- [x] Widget JavaScript is served as a versioned bundle. A new version uses a new URL or a cache-bust.
  - Proof: 2026-10-28, API on `http://127.0.0.1:3000`. The running version token is `v1`.

```text
GET /widget.v1.js 200
cache-control: public, max-age=31536000, immutable
content-type: application/javascript; charset=utf-8
first line: /* v1 */

GET /widget.v2.js 404 {"error":"not found"}
cache-control: absent
```

- [x] The widget renders on a page served from a different origin than the API.
  - Proof: 2026-10-28. Page origin `http://127.0.0.1:8080`. API origin `http://127.0.0.1:3000`. The page snippet loads `widget.v1.js` for `mckICgybxZdo`. The page showed the title Geo check, an Email field, and a Subscribe button. Submitting stored one row. That widget went from 2 submissions to 3. The new row is `893f1918-e988-43ea-b00d-80e0b18ac45e`, provider `ip-api.com`, country `US`.

```text
page http://127.0.0.1:8080
api http://127.0.0.1:3000
<script src="http://127.0.0.1:3000/widget.v1.js" data-widget-id="mckICgybxZdo"></script>
form title Geo check
button Subscribe
rows before 2
rows after 3
```

## Section 6, public submission API

- [x] Cross-origin submissions work. CORS headers are correct, and `OPTIONS` preflight is handled.
  - Proof: 2026-10-28. API origin `http://127.0.0.1:3000`. Request `Origin` is `https://customer.example`. Widget `mckICgybxZdo` (`89db14d2-29cd-4e29-b03c-e3cedae9add1`), tenant `f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd`. Submissions for that widget: 1 before, 2 after.

```text
OPTIONS /submissions 204
access-control-allow-origin: https://customer.example
access-control-allow-methods: POST, OPTIONS
access-control-allow-headers: Content-Type
vary: Origin

POST /submissions 201 {"ok":true,"id":"e46b6489-3b6f-4441-88ae-93633bc3e733"}
access-control-allow-origin: https://customer.example
vary: Origin

id e46b6489-3b6f-4441-88ae-93633bc3e733
widget_id 89db14d2-29cd-4e29-b03c-e3cedae9add1
tenant_id f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd
geo_provider ip-api.com
country_code US
country United States
city Ashburn
honeypot_result pass
confirmation sent submission=e46b6489-3b6f-4441-88ae-93633bc3e733
```

- [x] Malformed and oversized payloads are rejected with 4xx JSON errors. Neither returns 500.
  - Proof: 2026-10-28, API on `http://127.0.0.1:3010`. Origin `http://127.0.0.1:8080`. The malformed body was `{`. The invalid body had a public id and a key that is not a UUID. The oversized body was valid JSON larger than 8 KiB.

```text
POST /submissions malformed 400 application/json; charset=utf-8 {"error":"invalid submission"}
POST /submissions invalid 400 application/json; charset=utf-8 {"error":"invalid submission"}
POST /submissions oversized 413 application/json; charset=utf-8 {"error":"payload too large"}
```

- [x] A valid submission is stored and linked to the right widget and tenant.
  - Proof: same request as the cross-origin transcript above. `201` id `e46b6489-3b6f-4441-88ae-93633bc3e733` is widget `89db14d2-29cd-4e29-b03c-e3cedae9add1`, tenant `f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd`, `geo_provider` `ip-api.com`, country `US`. That widget went from 1 stored row to 2.

## Section 6, abuse protection

- [x] A burst hits the per-IP limit and the per-widget limit with 429. A normal request right after still succeeds.
  - Proof: 2026-10-28, API on `http://127.0.0.1:3010`. For the IP burst the running limit was 1 request per 10 seconds. The third request waited for that window. For the widget burst the running limit was 1 request per widget. The next request used `demoBwidget1` and did not wait. Both limits were then restored to 30 per IP and 60 per widget.

```text
POST /submissions demoAwidget1 201 {"ok":true,"id":"233d7d86-5deb-4ff9-be34-4fb216ceb0fc"}
POST /submissions demoAwidget1 429 {"error":"too many requests"}
POST /submissions demoAwidget1 201 {"ok":true,"id":"915a79d8-2094-4851-9605-cad0c97ecbec"}
ip-summary 201 429 201

POST /submissions demoAwidget1 201 {"ok":true,"id":"c91be97b-b58b-4c33-b0b0-b926712092c5"}
POST /submissions demoAwidget1 429 {"error":"too many requests"}
POST /submissions demoBwidget1 201 {"ok":true,"id":"f3c7629f-afda-4ab6-a990-31b782ef417d"}
widget-summary 201 429 201
```

- [x] The honeypot blocks a spam submission and does not explain the rule.
  - Proof: 2026-10-28, API on `http://127.0.0.1:3000`. Widget `6eef7ad3-0f6e-4dcf-8028-5e4d79760d9a`. The request body included a non-empty reserved field. The response does not name the field or the rule. Postgres stored no row for that widget.

```text
submit 200 body {"ok":true}
names honeypot false
names company_website false
names spam false
stored_rows 0
```

## Section 6, enrichment and safe side effects

- [x] Provider A is down, provider B answers, and the stored submission is enriched.
  - Proof: 2026-10-28, API on `http://127.0.0.1:3010`. `GEO_MODE=mock`, `GEO_MOCK_A_DOWN=true`, `GEO_MOCK_B_DOWN=false`. Widget `demoAwidget1`.

```text
POST /submissions demoAwidget1 201 {"ok":true,"id":"d7b2c3ce-285b-4566-8c43-5636344f1232"}
geo_provider ipapi.co
country_code DE
country Germany
city Berlin
```

- [x] Both providers are down. The submission still succeeds, without geo.
  - Proof: 2026-10-28, same API. `GEO_MOCK_A_DOWN=true` and `GEO_MOCK_B_DOWN=true`. The response is 201 and the geo columns are null.

```text
POST /submissions demoAwidget1 201 {"ok":true,"id":"daa4d90c-89a6-499e-ab09-5cb44cee02ff"}
geo_provider null
geo null
```

- [x] A failing confirmation email or webhook does not prevent the submission from being stored.
  - Proof: 2026-10-28, same API. `SIDE_EFFECT_FORCE_FAIL=true`. The HTTP response was already 201. The worker logged the alert after 3 attempts. The line has no recipient. The flags were restored afterward: geo mock down flags false, force fail false, IP limit 30, widget limit 60. Health then returned `{ "ok": true, "db": "up" }`.

```text
POST /submissions demoAwidget1 201 {"ok":true,"id":"fe80e263-2cf5-4852-a2a3-86487659d99e"}
side effect failed submission=fe80e263-2cf5-4852-a2a3-86487659d99e attempts=3
stored id fe80e263-2cf5-4852-a2a3-86487659d99e
```

## Section 6, documentation

- [x] `README.md` has an architecture diagram, setup instructions, and API documentation. `capstone.yaml`, `EVIDENCE.md`, `BUILDLOG.md`, and `.env.example` are present.
  - Proof: 2026-10-28. File sizes are bytes. The architecture section contains the one-line snippet.

```text
README.md 6252
capstone.yaml 1073
EVIDENCE.md 14086
BUILDLOG.md 25587
.env.example 1187
## Setup
## Architecture
## Stack
## API documentation
## Limitations
## Required files
<script src="http://127.0.0.1:3010/widget.v1.js" data-widget-id="demoAwidget1"></script>
```

## Phase 3 gate

- [x] The widget renders on the second-origin page. The page origin and the API origin are different.
  - Proof: 2026-10-29. The customer page showed Join the list, Weekly notes, an Email field, and Subscribe. The script on that page points at the API. `GET /health` on the API origin returned `{ "ok": true, "db": "up" }`.

```text
page http://127.0.0.1:8080
api http://127.0.0.1:3010
script http://127.0.0.1:3010/widget.v1.js
widget demoAwidget1
title Join the list
email true
button Subscribe
health 200 {"ok":true,"db":"up"}
```

## Acceptance probes

- [x] Probe 1. `POST` a valid submission from the second-origin test page. It is stored, the status is 2xx, and it is visible through the dashboard API.
  - Proof: 2026-10-29. The form on `http://127.0.0.1:8080` submitted `probe1@example.com`. The page then said Thanks. The owner dashboard for tenant `576695d7-66f5-4ff5-a58c-1514e241c569` listed that one row.

```text
page http://127.0.0.1:8080
POST http://127.0.0.1:3010/submissions 201
page text Thanks.
login 200
GET /dashboard/submissions 200 matches 1
id 51e06afa-5461-4ef8-ad04-1cbde33417eb
tenant 576695d7-66f5-4ff5-a58c-1514e241c569
city Ashburn
country US
```

- [x] Probe 2. A malformed payload and an oversized payload return clean 4xx JSON errors, never 500.
  - Proof: 2026-10-29, API on `http://127.0.0.1:3010`. Origin `http://127.0.0.1:8080`. The first body was `{`. The second was JSON with a key that is not a UUID. The third was valid JSON larger than 8 KiB. None returned 500.

```text
400 application/json; charset=utf-8 {"error":"invalid submission"}
400 application/json; charset=utf-8 {"error":"invalid submission"}
413 application/json; charset=utf-8 {"error":"payload too large"}
```

- [x] Probe 3. A burst of rapid submissions returns 429. A normal request right after still succeeds.
  - Proof: 2026-10-29, API on `http://127.0.0.1:3010`. The IP burst used a limit of 1 request per 10 seconds, and the third request waited for that window. The widget burst used a limit of 1 request per widget. The next request used `demoBwidget1` and did not wait. Limits were restored to 30 per IP and 60 per widget.

```text
201 application/json; charset=utf-8 {"ok":true,"id":"4e9ce61f-b90c-4104-8588-a1f183e5eae1"}
429 application/json; charset=utf-8 {"error":"too many requests"}
201 application/json; charset=utf-8 {"ok":true,"id":"cd43bc67-01f1-4183-a1f6-9b3f40db5207"}
ip-summary 201 429 201

201 application/json; charset=utf-8 {"ok":true,"id":"0d11fde3-be9d-49d7-b4a2-4dbeb409e1ed"}
429 application/json; charset=utf-8 {"error":"too many requests"}
201 application/json; charset=utf-8 {"ok":true,"id":"e8dfe313-ce04-484c-bb7c-5b4936f45b4a"}
widget-summary 201 429 201
```

- [x] Probe 4. Disable geo provider A. The next submission is stored and enriched by provider B. Disable both. The submission is stored without geo.
  - Proof: 2026-10-29, API on `http://127.0.0.1:3010`, `GEO_MODE=mock`. First `GEO_MOCK_A_DOWN=true` and `GEO_MOCK_B_DOWN=false`. Then both flags true.

```text
POST 201 {"ok":true,"id":"411a0d2a-8b6b-434f-ac7f-7ec6e34bfa93"}
geo_provider ipapi.co
country_code DE
country Germany
city Berlin

POST 201 {"ok":true,"id":"7db43b74-1b59-4b25-9d20-e7252eab9f35"}
geo_provider null
geo null
```

- [x] Probe 5. Force the email or webhook side effect to throw. The submission still returns success and is stored.
  - Proof: 2026-10-29, API on `http://127.0.0.1:3010`. `SIDE_EFFECT_FORCE_FAIL=true`. The response was 201. The alert has no recipient.

```text
POST 201 {"ok":true,"id":"6249c712-343b-47f1-a7dc-8a08bf04920f"}
side effect failed submission=6249c712-343b-47f1-a7dc-8a08bf04920f attempts=3
stored id 6249c712-343b-47f1-a7dc-8a08bf04920f
```

- [x] Probe 6. Fill the honeypot field the way a bot would. The submission is silently dropped or rejected, without revealing the honeypot.
  - Proof: 2026-10-29, API on `http://127.0.0.1:3010`, after the flags were restored. The body included a non-empty reserved field. The response does not name the field or the rule. Postgres stored no row for that idempotency key. Restored settings: IP limit 30, widget limit 60, both geo mock flags false, force fail false.

```text
200 application/json; charset=utf-8 {"ok":true}
names honeypot false
names company_website false
names spam false
stored_rows 0
```

## Shared requirements

- [x] 1. Layered architecture. Data, logic, and HTTP are separated. Jobs are separate from the request path.
  - Proof: 2026-10-29. `src` has separate `data`, `http`, `jobs`, and `logic` folders. The submission route does not call the mailer. It enqueues the job from the response `finish` event.

```text
data
http
jobs
logic
widget
res.once("finish", () => {
deliverConfirmation in http: 0
```

- [x] 2. Validation at the boundary. Bad input returns a clean 4xx, never a 500.
  - Proof: 2026-10-29, the same run as Probe 2. API `http://127.0.0.1:3010`. None of the three responses is 500.

```text
400 application/json; charset=utf-8 {"error":"invalid submission"}
400 application/json; charset=utf-8 {"error":"invalid submission"}
413 application/json; charset=utf-8 {"error":"payload too large"}
```

- [x] 3. At least one background job. Slow work is off the request path, with retries and a failure alert.
  - Proof: 2026-10-29, the same run as Probe 5. The HTTP status was already 201. The worker then logged the alert after 3 attempts. The enqueue sits on `res.once("finish")`, so the job is not part of the request function.

```text
POST 201 {"ok":true,"id":"6249c712-343b-47f1-a7dc-8a08bf04920f"}
side effect failed submission=6249c712-343b-47f1-a7dc-8a08bf04920f attempts=3
stored id 6249c712-343b-47f1-a7dc-8a08bf04920f
```

- [x] 4. Real persistence. Schema lives in migrations, indexes match the queries, and tenants are isolated.
  - Proof: 2026-10-29. Migrations are `migrations/001_widgets.sql`, `migrations/002_submissions.sql`, and `migrations/003_users.sql`. Postgres has the public id, idempotency key, widget-time, and tenant indexes. `node --test src/data/ownerQueries.test.js` passed `every owner query filters by tenant id`.

```text
submissions_idempotency_key_key
submissions_widget_created_at_idx
submissions_tenant_id_idx
users_tenant_id_idx
widgets_public_id_key
widgets_tenant_id_idx
every owner query filters by tenant id
the migrations define the public id, idempotency key, and submission time indexes
```

- [x] 5. Idempotency where it matters. A retried submission is stored once, and the side effect runs once.
  - Proof: 2026-10-29, API on `http://127.0.0.1:3010`. The same key and payload were posted twice. Postgres has one row. The API log has one confirmation line for that id.

```text
201 {"ok":true,"id":"658f473c-f060-408c-8e79-f9e00369c147"}
200 {"ok":true,"id":"658f473c-f060-408c-8e79-f9e00369c147"}
rows 1
confirmation-lines 1
```

- [x] 6. Secrets stay clean. Environment only, never logged, never committed.
  - Proof: 2026-10-29. `.env` is ignored. `git ls-files` lists `.env.example` and does not list `.env`. The API log has no database URL. The logging tests passed.

```text
.gitignore:5:.env	.env
tracked .env.example
confirmation-lines checked separately
url-lines 0
log lines drop secret values, database passwords, and bearer tokens
tests 6
pass 6
fail 0
```

- [x] 7. Cost tracking if AI is used. Not applicable: this product does not call an AI API. Do not add one only to satisfy this line.
  - Proof: N/A. A search of `src` for an AI client found no matches. If a product AI call is added later, record per-call cost, attribution, and a budget guard here before calling the feature done.

## README boot

- [x] `docker compose up` and `npm run seed` from `README.md` boot the API, Postgres, and the customer page.
  - Proof: 2026-10-29. Compose was already up from `docker compose up`. Health, the page, and a second seed matched the README. The seed printed the same two tenant ids.

```text
api Up 0.0.0.0:3010->3000/tcp
customer-site Up 0.0.0.0:8080->8080/tcp
db Up (healthy) 0.0.0.0:5435->5432/tcp
health 200 {"ok":true,"db":"up"}
page 200 demoAwidget1 true
tenant 576695d7-66f5-4ff5-a58c-1514e241c569 email owner-a@example.com widget demoAwidget1
tenant fbd8c354-f706-4df7-9450-add61829c9ca email owner-b@example.com widget demoBwidget1
```
