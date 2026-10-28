# Build log

Honesty is the point of this file. Perfection is not. When AI helps, write down where it helped, where it was wrong, and what you changed. "The AI wrote it" is not an explanation you can give in review.

The product does not call an AI API. That is a locked decision in `DESIGN.md`. This log is about help while building, not about a runtime model.

## How to add an entry

Copy the block below and put the newest entry at the top. Keep command output and file names specific. `What I asked for` names the feature. `What I changed myself` says that the code and prompts were reviewed.

```text
Date:
Phase:
What I asked for:
Where it helped:
Where it was wrong:
What I changed myself:
What I can explain line by line:
```

## Entries

Date: 2026-10-29
Phase: 4, task 4.2 acceptance probes
What I asked for: The six acceptance probes, run in order, with each result pasted into `EVIDENCE.md`.
Where help was useful: The page at `http://127.0.0.1:8080` posted to `http://127.0.0.1:3010/submissions` and got 201. The page said Thanks. The owner dashboard listed `51e06afa-5461-4ef8-ad04-1cbde33417eb` for tenant `576695d7-66f5-4ff5-a58c-1514e241c569`, city Ashburn. Malformed JSON was 400 and the oversized body was 413. An IP burst returned 429, then the next window stored a row. A second request to `demoAwidget1` returned 429, and `demoBwidget1` stored `e8dfe313-ce04-484c-bb7c-5b4936f45b4a`. Provider A down stored `411a0d2a-8b6b-434f-ac7f-7ec6e34bfa93` from `ipapi.co` in Berlin. Both down stored `7db43b74-1b59-4b25-9d20-e7252eab9f35` with no geo. Forced confirmation failure stored `6249c712-343b-47f1-a7dc-8a08bf04920f` and logged `attempts=3`. A filled reserved field returned `{ "ok": true }` and stored 0 rows.
Where it was wrong: Nothing in the six results had to be rerun. The limits and flags were put back: 30 per IP, 60 per widget, both geo mock flags false, force fail false.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the page submit and the dashboard row are the same lead, and why a thrown confirmation still returns 201.

Date: 2026-10-29
Phase: 4, task 4.1 Section 6 review
What I asked for: A pass over every Section 6 box, ticking one only when the proof is real command output.
Where help was useful: The PDF outline names the same six groups as this file: widget management, widget delivery, public submission API, abuse protection, enrichment and safe side effects, and documentation. `EVIDENCE.md` has 15 ticked boxes under those groups. Each tick has a transcript: status codes, cache headers, a stored id, or a file listing.
Where it was wrong: The PDF body is stored as font glyphs, so the outline titles are the readable part. The box wording I compared is the wording in this file, which was taken from that PDF.
What I changed myself: I reviewed the code and prompts. No tick was removed. No new transcript was required.
What I can explain line by line: Why a box stays ticked only when a command result sits under it.

Date: 2026-10-29
Phase: 3, task 3.9 page and API origins
What I asked for: The Phase 3 gate, with the widget rendering on the customer page and the two origins recorded.
Where help was useful: The page at `http://127.0.0.1:8080` showed Join the list, an Email field, and Subscribe. Its script is `http://127.0.0.1:3010/widget.v1.js` for `demoAwidget1`. `GET /health` on that API origin returned `{ "ok": true, "db": "up" }`.
Where it was wrong: An earlier render proof in `EVIDENCE.md` still names API port 3000. That transcript matches the API port from that session. This gate records the current pair, 8080 and 3010.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the page origin and the script origin are different hosts, and why the form is built from the public config.

Date: 2026-10-28
Phase: 3, task 3.8 Section 6 proofs
What I asked for: One real command proof for every Section 6 box.
Where help was useful: The empty boxes now have transcripts from `http://127.0.0.1:3010`. Missing and invalid auth are 401. Create, read, update, and delete ran for tenant `576695d7-66f5-4ff5-a58c-1514e241c569`, and the proof widget was deleted. Malformed JSON is 400 and the oversized body is 413. An IP burst of one allowed request returned 429, then the next window stored `915a79d8-2094-4851-9605-cad0c97ecbec`. A second request to `demoAwidget1` returned 429, and `demoBwidget1` still stored `f3c7629f-afda-4ab6-a990-31b782ef417d`. Provider A down stored `d7b2c3ce-285b-4566-8c43-5636344f1232` with `ipapi.co`, `DE`, Berlin. Both providers down stored `daa4d90c-89a6-499e-ab09-5cb44cee02ff` with no geo. Forced confirmation failure stored `fe80e263-2cf5-4852-a2a3-86487659d99e` and logged `attempts=3` with no recipient.
Where it was wrong: The first IP burst allowed two requests and waited before the third, so that burst stored three rows. The recorded burst uses a limit of one. The API also needed a moment after each recreate before it accepted connections.
What I changed myself: I reviewed the code and prompts. The live limits are back to 30 per IP and 60 per widget, both geo mock flags are false, and the forced failure flag is false.
What I can explain line by line: Why the IP check runs before the widget check, and why a thrown confirmation still returns 201.

Date: 2026-10-28
Phase: 3, task 3.7 seed and runnable setup
What I asked for: A seed command with two demo tenants, and a README a stranger can follow to boot the app.
Where help was useful: `npm run seed` loads Northwind (`owner-a@example.com`, widget `demoAwidget1`) and Brightpath (`owner-b@example.com`, widget `demoBwidget1`), plus one enriched submission for Northwind. A second run printed the same tenant ids, `576695d7-66f5-4ff5-a58c-1514e241c569` and `fbd8c354-f706-4df7-9450-add61829c9ca`. `docker compose up -d` then `GET http://127.0.0.1:3010/health` returned `{ "ok": true, "db": "up" }`. Owner A saw 1 dashboard row and owner B saw 0. The customer page at `http://127.0.0.1:8080` rendered Join the list and, after submit, said Thanks. That widget then had 2 enriched rows.
Where it was wrong: Host port 5432 is already a local Postgres, and host port 3000 was already taken, so Compose could not publish the original ports. Postgres is now on host port 5435 and the API is on host port 3010.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the seed looks up the email and the public id before inserting, and why a second run does not add another submission.

Date: 2026-10-28
Phase: 3, task 3.6 dashboard
What I asked for: An authenticated dashboard for the submission list, counts over time, per-widget stats, and a geo breakdown.
Where help was useful: `GET /dashboard/submissions` and `GET /dashboard/stats` take the tenant from the bearer token. A missing token is 401. Tenant A saw submission `6015efec-06d2-4ed0-be45-b76aae4cb2a7`. Tenant B saw no rows. The list leaves out the client IP and the idempotency key. Counts are grouped by UTC date. The stats query on the older tenant returned 4 rows on 2026-10-28, widget `mckICgybxZdo` count 3, and geo `US` count 3.
Where it was wrong: The proof server for the new tenant did not run the geo lookup, so that one dashboard row has a null country. The geo query itself still groups a null country separately from `US`.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why both dashboard queries filter with `WHERE tenant_id = $1`, and why a widget with no submissions can still appear in the per-widget counts.

Date: 2026-10-28
Phase: 3, task 3.5 widget form on the customer page
What I asked for: The widget form and submit button on the customer page, loaded from the snippet.
Where help was useful: `customer-site/index.html` now has the one script line for widget `mckICgybxZdo`. The page origin is `http://127.0.0.1:8080` and the script origin is `http://127.0.0.1:3000`. The browser showed Geo check, an Email field, and Subscribe. After submit the page said Thanks. The widget's submission count went from 2 to 3, and the new row is enriched by `ip-api.com`.
Where it was wrong: The API process that was already on port 3000 did not have the config route yet, so the form would have stayed unavailable. Rebuilding that image made `GET /widgets/mckICgybxZdo/config` return 200 to the page origin. The pasted public id belongs to this database. A fresh database needs its own snippet.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the script tag is on the customer page, and why the form is built from the public config.

Date: 2026-10-28
Phase: 3, task 3.4 customer site
What I asked for: One HTML page for the customer site, served on a port that is not the API port.
Where help was useful: `customer-site` serves `index.html` on port 8080. The API stays on port 3000. The page is a heading and a line that says the widget snippet is pasted below. Compose starts that service with the API and Postgres.
Where it was wrong: The page does not load the widget yet. That render is the next task, so the HTML does not include the script tag.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why this origin is separate from the API, and why the server only returns that one page.

Date: 2026-10-28
Phase: 3, task 3.3 embed snippet
What I asked for: One embed line per widget, pointing at the versioned script and the widget id.
Where help was useful: Create and `GET /widgets/:id/embed` already returned that line. The check now requires the exact one-line snippet: `src` is `/widget.v1.js` and `data-widget-id` is the public id. Another tenant's embed request is 404. A live create returned `<script src="http://127.0.0.1:3010/widget.v1.js" data-widget-id="6a4S9xP4LRHb"></script>`, and that URL returned the cached script.
Where it was wrong: Port 3000 was already in use, so the proof listened on port 3010. The snippet origin follows the API origin used for that process.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the snippet is one script tag, and why the public id is the `data-widget-id` value.

Date: 2026-10-28
Phase: 3, task 3.2 public widget config
What I asked for: The public widget config as a small payload with a short cache.
Where help was useful: `GET /widgets/:publicId/config` needs no token. The body is the embed config: public id, type, title, description, fields, button text, display options, and submit URL. `Cache-Control` is `public, max-age=60`. A foreign Origin is echoed. The tenant id and the widget uuid are absent. The live widget `mckICgybxZdo` returned 289 bytes. A missing public id was 404 with no cache header.
Where it was wrong: Caching a missing widget for 60 seconds would hide a widget created just after that. The short cache is only on the 200 response.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why this route uses the public id, and why the response leaves out the tenant id.

Date: 2026-10-28
Phase: 3, task 3.1 versioned widget script
What I asked for: The widget script at a versioned URL with a long cache.
Where help was useful: `GET /widget.v1.js` returns the bundle with `Cache-Control: public, max-age=31536000, immutable`. The response body starts with the version token. `GET /widget.v2.js` is 404 while the app version is v1, and the reverse is true when the token is v2. The same token is the one in the embed snippet. The API on port 3000 returned that pair.
Where it was wrong: A one-year cache on a 404 would pin a missing version. Only the 200 response sets that header.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the script URL has to change when the bundle changes, and why the route is public.

Date: 2026-10-28
Phase: 2, task 2.13 foreign-origin submission
What I asked for: A submission with a foreign Origin that stores one enriched row.
Where help was useful: `OPTIONS` and `POST /submissions` from `https://customer.example` to the API on port 3000. The response is 201 `e46b6489-3b6f-4441-88ae-93633bc3e733`. That row is widget `89db14d2-29cd-4e29-b03c-e3cedae9add1`, tenant `f4ed0d3f-4f05-4efa-a3bf-66706b6e2ffd`, provider `ip-api.com`, country `US`, city Ashburn. The widget's submission count went from 1 to 2.
Where it was wrong: Host port 5432 was already taken, so the existing database volume was started on port 5434. The API still used the compose network. The stored row is the proof.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the response echoes `https://customer.example`, and why the stored geo is the mock result from provider A.

Date: 2026-10-28
Phase: 2, task 2.12 secrets and logs
What I asked for: Secrets stay in the environment, and log lines do not include them.
Where help was useful: Startup, confirmation, and failure lines already named only the port, the submission id, or the attempt count. The remaining leak was an unexpected error: Express would print the exception. That handler now logs `request failed` and returns `{ "error": "unavailable" }`. A logger strips configured secret values, database userinfo passwords, and bearer tokens before write.
Where it was wrong: Printing the exception message would have been useful for debugging, and it can also carry a connection string. The fixed line is the one that ships.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the error handler does not forward the exception, and why a database URL in a log line loses the password.

Date: 2026-10-28
Phase: 2, task 2.11 confirmation job
What I asked for: A background confirmation after the row is stored, with retries, a failure alert, and one send per idempotency key.
Where help was useful: The handler enqueues the job on response finish, so the send is not part of the request. A forced failure retries 3 times, alerts with the submission id and attempt count, and the HTTP response stays 201 with the row kept. A replay does not send again. Console mode writes one line. SMTP can deliver to local Mailpit.
Where it was wrong: The alert does not include the recipient. That keeps the address out of the failure line.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why a replay does not enqueue another send, and why a thrown job cannot change the status code.

Date: 2026-10-28
Phase: 2, task 2.10 geo chain
What I asked for: One geo lookup that tries ip-api.com and then ipapi.co, with mock proof for A down and for both down.
Where help was useful: Mock mode does not call the network. A down and B up stores `geo_provider` `ipapi.co` and country `DE`. Both down still return 201 and store null geo. Live mode uses the same order and treats a bad response as that provider being down.
Where it was wrong: The default mock has both providers up, so a normal local submit is enriched by provider A. The down cases are flag settings, not the Compose default.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why a provider with a bad payload is skipped, and why a lookup failure still inserts the row.

Date: 2026-10-28
Phase: 2, task 2.9 reserved field
What I asked for: A filled reserved field is not stored, and the response does not name the rule.
Where help was useful: `POST /submissions` returned 200 `{ "ok": true }`. The body did not contain the field name or the submitted value. Postgres counted 0 rows for widget `6eef7ad3-0f6e-4dcf-8028-5e4d79760d9a`. The transcript is in `EVIDENCE.md`.
Where it was wrong: The earlier check used an in-memory store. This pass checked the live database.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why a non-empty reserved field returns before `storeSubmission`, and why the response body is only `{ "ok": true }`.

Date: 2026-10-28
Phase: 2, task 2.8 rate limits
What I asked for: Per-IP and per-widget submission limits that return 429, while a request still inside its limit succeeds.
Where help was useful: `POST /submissions` counts the connection IP and, once the widget is known, that widget. The over-limit response is 429 `{ "error": "too many requests" }` and the row is not stored. A different widget still stores during the same window. After the window, the same IP stores again. The limits are read from the environment.
Where it was wrong: The running API uses 30 requests per IP and 60 per widget each minute, so a short manual burst under those numbers still succeeds. The proof uses a lower limit in the test process.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the body cannot choose the IP that is counted, and why a full bucket for one widget does not block another widget.

Date: 2026-10-28
Phase: 2, task 2.7 store a submission
What I asked for: Store one submission per idempotency key, linked to the widget and tenant.
Where help was useful: A valid `POST /submissions` inserts one row linked to the widget and its tenant. The same idempotency key and payload returns that row with 200. A different payload, or the same key on another widget, returns 409 and does not insert again. Geo stays null until the provider chain exists.
Where it was wrong: The first write is 201 and the replay is 200. Both bodies are `{ "ok": true, "id" }`. The contract example for 200 is only `{ "ok": true }`, which remains the filled-field response.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the tenant id comes from the widget row, and why a unique-key race reads the existing row instead of inserting a second one.

Date: 2026-10-28
Phase: 2, task 2.6 submission HTTP
What I asked for: Public `POST /submissions` and `OPTIONS /submissions`, with CORS and a 4xx JSON body for a malformed or oversized payload.
Where help was useful: `OPTIONS /submissions` returns 204 with the CORS headers, and echoes the request `Origin`. Malformed JSON is 400 `{ "error": "invalid submission" }`. An oversized body is 413 `{ "error": "payload too large" }`. An unknown public id is 404. A filled `company_website` returns `{ "ok": true }` and the body does not name the rule.
Where it was wrong: A valid submission returns 503 `{ "error": "unavailable" }` because the row is not stored yet. That status is not in the submission contract. Storage was not part of this route yet.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the allowed origin is the caller's `Origin`, and why a bad JSON object is 400 before the widget lookup.

Date: 2026-10-28
Phase: 2, task 2.5 isolation proof
What I asked for: Proof that one tenant cannot read or change another tenant's widgets or submissions.
Where help was useful: Two live tenants. Tenant B received 404 for read, patch, delete, and embed of tenant A's widget, and an empty list. A stored submission for A was invisible to B's `WHERE tenant_id = $1` queries. B's insert was rejected with `tenant_id must match the widget`. B's update and delete changed 0 rows. The transcript is in `EVIDENCE.md`.
Where it was wrong: Host port 5432 refused the Compose password, so the submission lines were run inside the database container. `GET /dashboard/submissions` is still unbuilt, so that half is SQL, not HTTP.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why B's widget calls are 404, and why a submission row cannot be stored under a different tenant than its widget.

Date: 2026-10-28
Phase: 2, task 2.4 widget CRUD
What I asked for: Tenant-scoped widget create, read, update, delete, and the embed snippet.
Where help was useful: `POST`, `GET`, `PATCH`, and `DELETE /widgets`, plus `GET /widgets/:id/embed`. The tenant id comes from the token. A second tenant gets 404 for the same widget id. Create returns the one-line embed snippet.
Where it was wrong: Delete of a widget that already has submissions is 409. The first contract only listed 204, 401, and 404. I kept 409 so that case is not a 500.
What I changed myself: I reviewed the code and prompts. I kept 409 when a widget already has submissions so that case is not a 500.
What I can explain line by line: Why `tenant_id` in the body is 400, and why list and read both use `WHERE tenant_id = $1`.

Date: 2026-10-28
Phase: 2, task 2.3 auth
What I asked for: Register, login, and a bearer token on owner and dashboard routes.
Where help was useful: scrypt password hashes, HMAC bearer tokens, `POST /auth/register`, `POST /auth/login`, and the gate on owner and dashboard paths. A live register returned a token. `GET /widgets` without it was 401. The same call with the token was 404. Public config and `POST /submissions` stayed open.
Where it was wrong: Widget CRUD is still the 404 behind the gate. The token is not a stored session.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why a wrong password and a missing user share the 401 body, and why `/widgets/:publicId/config` does not require a token.

Date: 2026-10-28
Phase: 2, task 2.2 users migration
What I asked for: The users migration, with a tenant name, a unique email, and a password hash.
Where help was useful: `migrations/003_users.sql` adds `tenants.name` and `users` with a tenant foreign key, a unique lowercase email, and a password hash. The API applied it on startup.
Where it was wrong: There is still no login route. The hash column is empty until auth is added.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the email must already be lowercase, and why `password_hash` cannot be empty.

Date: 2026-10-28
Phase: 2, task 2.1 Express and Compose
What I asked for: An Express app and Docker Compose that boot the API and Postgres, with `GET /health`.
Where help was useful: `src/main.js`, `src/http/app.js`, `src/data/migrate.js`, `src/jobs/runner.js`, and `docker-compose.yml`. `GET /health` returned `{ "ok": true, "db": "up" }`.
Where it was wrong: The contract routes still 404. This boot is the process and the database, not a working widget.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why Mailpit is behind a Compose profile, and why the API waits for Postgres before it listens.

Date: 2026-10-28
Phase: 1, task 1.7 design gate
What I asked for: A one-page `DESIGN.md` that closes the design gate.
Where help was useful: `DESIGN.md` was cut from the long worksheet to one page. The column rules and route examples stay in the code files the page names.
Where it was wrong: Nothing here boots a server. Phase 2 has not started.
What I changed myself: I reviewed the code and prompts, including the one-page design, before treating Phase 1 as closed.
What I can explain line by line: Why the page points at `src/http/contracts.js` instead of copying every example, and why the non-goal is local ports only.

Date: 2026-10-28
Phase: 1, task 1.6 non-goal
What I asked for: One non-goal sentence: no real CDN, domain, or hosted deployment.
Where help was useful: One sentence in `DESIGN.md`. A real CDN, domain, or hosted deployment stays out of scope.
Where it was wrong: Nothing to run. This entry is a scope sentence, not a running feature.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why local ports are the whole deployment, and why a public host is not part of the capstone.

Date: 2026-10-28
Phase: 1, task 1.5 API contracts
What I asked for: API contracts for the owner, public delivery, public submission, and dashboard routes.
Where help was useful: `src/http/contracts.js` locks the method, path, auth, status codes, and one example per route. `npm test` passed 34 checks.
Where it was wrong: These are contracts, not a listening server. Calling the paths now will fail because Express is not built.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why a missing token is 401 on owner and dashboard routes, and why a filled reserved field is 200 with `{ "ok": true }` and no explanation.

Date: 2026-10-28
Phase: 1, task 1.4 embed flow
What I asked for: The embed flow in code: snippet, versioned script, cached config, form, and submit body.
Where help was useful: `src/logic/embed.js` builds the snippet, the versioned script URL, the small config, the form, and the submit body. `npm test` passed 29 checks.
Where it was wrong: Nothing is served over HTTP yet. The cache headers are values the later route must send.
What I changed myself: I reviewed the code and prompts.
What I can explain line by line: Why the public id is on the script tag and not in the script URL, and why the config omits the tenant id.

Date: 2026-10-28
Phase: 1, tasks 1.2 and 1.3 in code
What I asked for: Code the submission model, then the tenant queries and indexes.
Where help was useful: `src/logic/submission.js`, `migrations/002_submissions.sql`, and `src/data/ownerQueries.js`. `npm test` passed 26 checks.
Where it was wrong: The SQL has not been applied. Docker is installed, and the engine was not running.
What I changed myself: I reviewed the code and prompts, and asked for the submission model and tenant queries in code instead of another design-only pass.
What I can explain line by line: Why a filled reserved field returns `action: "drop"` with no message, and why every owner query starts with `tenant_id = $1`.

Date: 2026-10-28
Phase: 1, task 1.2 submission model
What I asked for: The submission model in `DESIGN.md`: request fields, null geo, and the idempotency rule.
Where help was useful: `npm test` passed 12 checks. The `submissions` table, the request fields, and the retry rule are now in `DESIGN.md`.
Where it was wrong: This is a draft, not a migration. Postgres has not checked these columns.
What I changed myself: I reviewed the code and prompts. I have not edited the draft yet.
What I can explain line by line: Why `geo` may be null, why a filled `company_website` stores nothing, and why the same idempotency key does not insert twice.

Date: 2026-10-28
Phase: 1, task 1.1 widget model code
What I asked for: Code the widget model from the design. No HTTP server.
Where help was useful: Zod checks in `src/logic/widget.js`, the Postgres constraints in `migrations/001_widgets.sql`, and `npm test`.
Where it was wrong: Nothing in the request path yet. A passing unit test is not a stored row until Postgres is running.
What I changed myself: I reviewed the code and prompts, and asked for the widget model to be coded before the rest of the design page was finished.
What I can explain line by line: Why signup requires an email field, why `company_website` is rejected without calling it a honeypot, and why `tenant_id` cannot change.

Date: 2026-10-28
Phase: 1, task 1.1 widget model
What I asked for: Fill the widget fields, types, and nullability in `DESIGN.md`. No application code.
Where help was useful: The `widgets` table, the `fields` object, and the two `display_options` keys.
Where it was wrong: It is a draft, not a migration. Nothing has been checked against Postgres.
What I changed myself: I reviewed the code and prompts. I have not edited the draft yet.
What I can explain line by line: Why `public_id` is separate from `id`, why `description` is nullable, why `signup` requires an email field, and why the honeypot is not a widget column.

Date: 2026-10-27
Phase: skeleton, before Phase 1
What I asked for: A local repo skeleton and an ordered plan from the capstone brief. No application code.
Where it helped: Mapped Section 6, the Section 8 gates, the six probes, and the shared requirements into `README.md`, `DESIGN.md`, `EVIDENCE.md`, `capstone.yaml`, `.env.example`, and `AGENTS.md`.
Where it was wrong: Nothing in the running system yet, because there is no running system. Treat every route and schema note as a worksheet, not as implemented behavior.
What I changed myself: I reviewed the code and prompts. Stack choice is Node.js and Express. The remote is attached by me, not by the agent. `AGENTS.md` stays uncommitted.
What I can explain line by line: The file list, why the honeypot is mandatory (Probe 6), and why geo and email failures must not fail a valid submission.
