# Evidence

One pasted proof per requirement. A claim without a test name and output, a curl transcript, or a log line stays unchecked. Do not tick a box from memory.

Tick a box only when the proof under it is real command output. Empty slots stay empty.

## Section 6, widget management

- [ ] Authenticated CRUD for widgets. Requests without valid auth are rejected.
  - Proof:

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

- [ ] Malformed and oversized payloads are rejected with 4xx JSON errors. Neither returns 500.
  - Proof:

- [x] A valid submission is stored and linked to the right widget and tenant.
  - Proof: same request as the cross-origin transcript above. `201` id `e46b6489-3b6f-4441-88ae-93633bc3e733` is widget `89db14d2-29cd-4e29-b03c-e3cedae9add1`, tenant `f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd`, `geo_provider` `ip-api.com`, country `US`. That widget went from 1 stored row to 2.

## Section 6, abuse protection

- [ ] A burst hits the per-IP limit and the per-widget limit with 429. A normal request right after still succeeds.
  - Proof:

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

- [ ] Provider A is down, provider B answers, and the stored submission is enriched.
  - Proof:

- [ ] Both providers are down. The submission still succeeds, without geo.
  - Proof:

- [ ] A failing confirmation email or webhook does not prevent the submission from being stored.
  - Proof:

## Section 6, documentation

- [ ] `README.md` has an architecture diagram, setup instructions, and API documentation. `capstone.yaml`, `EVIDENCE.md`, `BUILDLOG.md`, and `.env.example` are present.
  - Proof:

## Acceptance probes

- [ ] Probe 1. `POST` a valid submission from the second-origin test page. It is stored, the status is 2xx, and it is visible through the dashboard API.
  - Proof:

- [ ] Probe 2. A malformed payload and an oversized payload return clean 4xx JSON errors, never 500.
  - Proof:

- [ ] Probe 3. A burst of rapid submissions returns 429. A normal request right after still succeeds.
  - Proof:

- [ ] Probe 4. Disable geo provider A. The next submission is stored and enriched by provider B. Disable both. The submission is stored without geo.
  - Proof:

- [ ] Probe 5. Force the email or webhook side effect to throw. The submission still returns success and is stored.
  - Proof:

- [ ] Probe 6. Fill the honeypot field the way a bot would. The submission is silently dropped or rejected, without revealing the honeypot.
  - Proof:

## Shared requirements

- [ ] 1. Layered architecture. Data, logic, and HTTP are separated. Jobs are separate from the request path.
  - Proof:

- [ ] 2. Validation at the boundary. Bad input returns a clean 4xx, never a 500.
  - Proof:

- [ ] 3. At least one background job. Slow work is off the request path, with retries and a failure alert.
  - Proof:

- [ ] 4. Real persistence. Schema lives in migrations, indexes match the queries, and tenants are isolated.
  - Proof:

- [ ] 5. Idempotency where it matters. A retried submission is stored once, and the side effect runs once.
  - Proof:

- [ ] 6. Secrets stay clean. Environment only, never logged, never committed.
  - Proof:

- [ ] 7. Cost tracking if AI is used. Not applicable: this product does not call an AI API. Do not add one only to satisfy this line.
  - Proof: N/A until a product AI call exists. If one is added later, record per-call cost, attribution, and a budget guard here before calling the feature done.
