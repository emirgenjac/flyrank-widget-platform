# Build log

Honesty is the point of this file. Perfection is not. When AI helps, write down where it helped, where it was wrong, and what you changed. "The AI wrote it" is not an explanation you can give in review.

The product does not call an AI API. That is a locked decision in `DESIGN.md`. This log is about help while building, not about a runtime model.

## How to add an entry

Copy the block below and put the newest entry at the top. Keep command output and file names specific.

```text
Date:
Phase:
What I asked AI to do:
Where it helped:
Where it was wrong:
What I changed myself:
What I can explain line by line:
```

## Entries

Date: 2026-10-28
Phase: 2, task 2.4 widget CRUD
What I asked for: Do the next task.
Where help was useful: `POST`, `GET`, `PATCH`, and `DELETE /widgets`, plus `GET /widgets/:id/embed`. The tenant id comes from the token. A second tenant gets 404 for the same widget id. Create returns the one-line embed snippet.
Where it was wrong: Delete of a widget that already has submissions is 409. The first contract only listed 204, 401, and 404. I kept 409 so that case is not a 500.
What I changed myself: I asked for the next task.
What I can explain line by line: Why `tenant_id` in the body is 400, and why list and read both use `WHERE tenant_id = $1`.

Date: 2026-10-28
Phase: 2, task 2.3 auth
What I asked for: Do the next task.
Where help was useful: scrypt password hashes, HMAC bearer tokens, `POST /auth/register`, `POST /auth/login`, and the gate on owner and dashboard paths. A live register returned a token. `GET /widgets` without it was 401. The same call with the token was 404. Public config and `POST /submissions` stayed open.
Where it was wrong: Widget CRUD is still the 404 behind the gate. The token is not a stored session.
What I changed myself: I asked for the next task.
What I can explain line by line: Why a wrong password and a missing user share the 401 body, and why `/widgets/:publicId/config` does not require a token.

Date: 2026-10-28
Phase: 2, task 2.2 users migration
What I asked for: Do the next task.
Where help was useful: `migrations/003_users.sql` adds `tenants.name` and `users` with a tenant foreign key, a unique lowercase email, and a password hash. The API applied it on startup.
Where it was wrong: There is still no login route. The hash column is empty until task 2.3.
What I changed myself: I asked for the next task.
What I can explain line by line: Why the email must already be lowercase, and why `password_hash` cannot be empty.

Date: 2026-10-28
Phase: 2, task 2.1 Express and Compose
What I asked for: Do the next task.
Where help was useful: `src/main.js`, `src/http/app.js`, `src/data/migrate.js`, `src/jobs/runner.js`, and `docker-compose.yml`. `GET /health` returned `{ "ok": true, "db": "up" }`.
Where it was wrong: The contract routes still 404. This boot is the process and the database, not a working widget.
What I changed myself: I asked for the next task after the design gate.
What I can explain line by line: Why Mailpit is behind a Compose profile, and why the API waits for Postgres before it listens.

Date: 2026-10-28
Phase: 1, task 1.7 design gate
What I asked for: Do the next task, the one-page design gate.
Where help was useful: `DESIGN.md` was cut from the long worksheet to one page. The column rules and route examples stay in the code files the page names.
Where it was wrong: Nothing here boots a server. Phase 2 has not started.
What I changed myself: I asked for the next task. I still review the page before treating Phase 1 as closed.
What I can explain line by line: Why the page points at `src/http/contracts.js` instead of copying every example, and why the non-goal is local ports only.

Date: 2026-10-28
Phase: 1, task 1.6 non-goal
What I asked for: Do the next task.
Where help was useful: One sentence in `DESIGN.md`. A real CDN, domain, or hosted deployment stays out of scope.
Where it was wrong: Nothing to run. This task is a scope sentence, not a feature.
What I changed myself: I asked for the next task.
What I can explain line by line: Why local ports are the whole deployment, and why a public host is not part of the capstone.

Date: 2026-10-28
Phase: 1, task 1.5 API contracts
What I asked for: Do the next task.
Where help was useful: `src/http/contracts.js` locks the method, path, auth, status codes, and one example per route. `npm test` passed 34 checks.
Where it was wrong: These are contracts, not a listening server. Calling the paths now will fail because Express is not built.
What I changed myself: I asked for the next task after the embed flow.
What I can explain line by line: Why a missing token is 401 on owner and dashboard routes, and why a filled reserved field is 200 with `{ "ok": true }` and no explanation.

Date: 2026-10-28
Phase: 1, task 1.4 embed flow
What I asked for: Start the next task in code.
Where help was useful: `src/logic/embed.js` builds the snippet, the versioned script URL, the small config, the form, and the submit body. `npm test` passed 29 checks.
Where it was wrong: Nothing is served over HTTP yet. The cache headers are values the later route must send.
What I changed myself: I asked to start task 1.4.
What I can explain line by line: Why the public id is on the script tag and not in the script URL, and why the config omits the tenant id.

Date: 2026-10-28
Phase: 1, tasks 1.2 and 1.3 in code
What I asked for: Stop leaving tasks as markdown only. Code the submission model, then the tenant queries and indexes.
Where help was useful: `src/logic/submission.js`, `migrations/002_submissions.sql`, and `src/data/ownerQueries.js`. `npm test` passed 26 checks.
Where it was wrong: The SQL has not been applied. Docker is installed, and the engine was not running.
What I changed myself: I asked for code per task instead of another design-only pass.
What I can explain line by line: Why a filled reserved field returns `action: "drop"` with no message, and why every owner query starts with `tenant_id = $1`.

Date: 2026-10-28
Phase: 1, task 1.2 submission model
What I asked for: Run the widget tests. If they passed, write the next task, the submission model.
Where help was useful: `npm test` passed 12 checks. The `submissions` table, the request fields, and the retry rule are now in `DESIGN.md`.
Where it was wrong: This is a draft, not a migration. Postgres has not checked these columns.
What I changed myself: I have not edited the draft yet. I still need to accept it before task 1.3.
What I can explain line by line: Why `geo` may be null, why a filled `company_website` stores nothing, and why the same idempotency key does not insert twice.

Date: 2026-10-28
Phase: 1, task 1.1 widget model code
What I asked for: Code the widget model from the design. No HTTP server.
Where help was useful: Zod checks in `src/logic/widget.js`, the Postgres constraints in `migrations/001_widgets.sql`, and `npm test`.
Where it was wrong: Nothing in the request path yet. A passing unit test is not a stored row until Postgres is running.
What I changed myself: I asked for this to be coded before the rest of the design page is finished.
What I can explain line by line: Why signup requires an email field, why `company_website` is rejected without calling it a honeypot, and why `tenant_id` cannot change.

Date: 2026-10-28
Phase: 1, task 1.1 widget model
What I asked for: Fill the widget fields, types, and nullability in `DESIGN.md`. No application code.
Where help was useful: The `widgets` table, the `fields` object, and the two `display_options` keys.
Where it was wrong: It is a draft, not a migration. Nothing has been checked against Postgres.
What I changed myself: Not yet. I still need to accept or edit the draft before task 1.2 counts as started.
What I can explain line by line: Why `public_id` is separate from `id`, why `description` is nullable, why `signup` requires an email field, and why the honeypot is not a widget column.

Date: 2026-10-27
Phase: skeleton, before Phase 1
What I asked AI to do: Turn the capstone brief into a local repo skeleton and an ordered task list. No application code.
Where it helped: Mapped Section 6, the Section 8 gates, the six probes, and the shared requirements into `README.md`, `DESIGN.md`, `EVIDENCE.md`, `capstone.yaml`, `.env.example`, and `AGENTS.md`.
Where it was wrong: Nothing in the running system yet, because there is no running system. Treat every route and schema note as a worksheet, not as implemented behavior.
What I changed myself: Stack choice is Node.js and Express. The remote is attached by me, not by the agent. `AGENTS.md` stays uncommitted.
What I can explain line by line: The file list, why the honeypot is mandatory (Probe 6), and why geo and email failures must not fail a valid submission.
