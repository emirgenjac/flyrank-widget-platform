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

Date: 2026-10-27
Phase: skeleton, before Phase 1
What I asked AI to do: Turn the capstone brief into a local repo skeleton and an ordered task list. No application code.
Where it helped: Mapped Section 6, the Section 8 gates, the six probes, and the shared requirements into `README.md`, `DESIGN.md`, `EVIDENCE.md`, `capstone.yaml`, `.env.example`, and `AGENTS.md`.
Where it was wrong: Nothing in the running system yet, because there is no running system. Treat every route and schema note as a worksheet, not as implemented behavior.
What I changed myself: Stack choice is Node.js and Express. The remote is attached by me, not by the agent. `AGENTS.md` stays uncommitted.
What I can explain line by line: The file list, why the honeypot is mandatory (Probe 6), and why geo and email failures must not fail a valid submission.
