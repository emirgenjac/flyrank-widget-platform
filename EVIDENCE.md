# Evidence

One pasted proof per requirement. A claim without a test name and output, a curl transcript, or a log line stays unchecked. Do not tick a box from memory.

The app is not built yet, so every slot below is empty on purpose.

## Section 6, widget management

- [ ] Authenticated CRUD for widgets. Requests without valid auth are rejected.
  - Proof:

- [ ] Tenant A cannot read or modify tenant B widgets or submissions.
  - Proof:

## Section 6, widget delivery

- [ ] An embed snippet is generated per widget.
  - Proof:

- [ ] The public config endpoint serves a small payload with `Cache-Control` and a `max-age`.
  - Proof:

- [ ] Widget JavaScript is served as a versioned bundle. A new version uses a new URL or a cache-bust.
  - Proof:

- [ ] The widget renders on a page served from a different origin than the API.
  - Proof:

## Section 6, public submission API

- [ ] Cross-origin submissions work. CORS headers are correct, and `OPTIONS` preflight is handled.
  - Proof:

- [ ] Malformed and oversized payloads are rejected with 4xx JSON errors. Neither returns 500.
  - Proof:

- [ ] A valid submission is stored and linked to the right widget and tenant.
  - Proof:

## Section 6, abuse protection

- [ ] A burst hits the per-IP limit and the per-widget limit with 429. A normal request right after still succeeds.
  - Proof:

- [ ] The honeypot blocks a spam submission and does not explain the rule.
  - Proof:

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
