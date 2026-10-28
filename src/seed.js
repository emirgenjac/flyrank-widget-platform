import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createPool } from "./data/db.js";
import { migrate } from "./data/migrate.js";
import { findSubmissionByIdempotencyKey, insertSubmission } from "./data/submissions.js";
import { findUserByEmail, registerOwner } from "./data/users.js";
import { findWidgetByPublicId, insertWidget } from "./data/widgets.js";
import { hashPassword } from "./logic/auth.js";
import { parseCreateWidget, toWidgetInsert } from "./logic/widget.js";

const DEFAULT_DATABASE_URL = "postgres://widget:widget@127.0.0.1:5435/widget_platform";
const DEFAULT_PASSWORD = "local-demo-pass";

export const DEMO_TENANTS = [
  {
    name: "Northwind",
    email: "owner-a@example.com",
    publicId: "demoAwidget1",
    widget: {
      type: "signup",
      title: "Join the list",
      description: "Weekly notes",
      button_text: "Subscribe",
      fields: [{ name: "email", label: "Email", input_type: "email", required: true }],
    },
    submission: {
      idempotencyKey: "33333333-3333-4333-8333-333333333301",
      payload: { email: "ada@example.com" },
      clientIp: "203.0.113.10",
      geo: { country_code: "US", country: "United States", city: "Ashburn" },
      geoProvider: "ip-api.com",
    },
  },
  {
    name: "Brightpath",
    email: "owner-b@example.com",
    publicId: "demoBwidget1",
    widget: {
      type: "cta",
      title: "Get the guide",
      button_text: "Send",
    },
  },
];

export function seedPassword(env = process.env) {
  return env.SEED_PASSWORD || DEFAULT_PASSWORD;
}

export async function seedDatabase(pool, { password = seedPassword() } = {}) {
  await migrate(pool);
  const passwordHash = await hashPassword(password);
  const seeded = [];
  for (const demo of DEMO_TENANTS) {
    let user = await findUserByEmail(pool, demo.email);
    if (!user) {
      user = await registerOwner(pool, {
        name: demo.name,
        email: demo.email,
        passwordHash,
      });
    }
    let widget = await findWidgetByPublicId(pool, demo.publicId);
    if (widget && widget.tenant_id !== user.tenant_id) {
      throw new Error(`Public id ${demo.publicId} belongs to another tenant.`);
    }
    if (!widget) {
      const parsed = parseCreateWidget(demo.widget);
      if (!parsed.success) {
        throw new Error(`Demo widget ${demo.publicId} is invalid.`);
      }
      widget = await insertWidget(pool, toWidgetInsert({
        tenantId: user.tenant_id,
        publicId: demo.publicId,
        widget: parsed.data,
      }));
    }
    let submissionId = null;
    if (demo.submission) {
      const existing = await findSubmissionByIdempotencyKey(pool, demo.submission.idempotencyKey);
      if (existing) {
        submissionId = existing.id;
      } else {
        const stored = await insertSubmission(pool, {
          id: randomUUID(),
          widget_id: widget.id,
          tenant_id: user.tenant_id,
          payload: demo.submission.payload,
          client_ip: demo.submission.clientIp,
          geo: demo.submission.geo,
          geo_provider: demo.submission.geoProvider,
          honeypot_result: "pass",
          idempotency_key: demo.submission.idempotencyKey,
        });
        submissionId = stored.id;
      }
    }
    seeded.push({
      email: demo.email,
      tenantId: user.tenant_id,
      publicId: widget.public_id,
      submissionId,
    });
  }
  return seeded;
}

function safeMessage(error, password) {
  const message = String(error?.message || "seed failed");
  if (message.includes(password) || message.includes("postgres://")) {
    return "seed failed";
  }
  return `seed failed: ${message}`;
}

async function main() {
  const password = seedPassword();
  const pool = createPool(process.env.DATABASE_URL || DEFAULT_DATABASE_URL);
  try {
    const seeded = await seedDatabase(pool, { password });
    for (const row of seeded) {
      console.log(`tenant ${row.tenantId} email ${row.email} widget ${row.publicId}`);
    }
    console.log("seed password:");
    console.log(password);
  } catch (error) {
    console.error(safeMessage(error, password));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
