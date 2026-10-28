import { z } from "zod";

const idempotencyKeySchema = z.uuid();

const submissionColumns = "id, widget_id, tenant_id, payload, client_ip, idempotency_key";

export async function findSubmissionByIdempotencyKey(db, idempotencyKey) {
  const parsed = idempotencyKeySchema.safeParse(idempotencyKey);
  if (!parsed.success) {
    return null;
  }
  const result = await db.query(
    `SELECT ${submissionColumns} FROM submissions WHERE idempotency_key = $1`,
    [parsed.data],
  );
  return result.rows[0] ?? null;
}

export async function insertSubmission(db, row) {
  const result = await db.query(
    `INSERT INTO submissions (
      id, widget_id, tenant_id, payload, client_ip, geo, geo_provider, honeypot_result, idempotency_key
    ) VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9)
    RETURNING ${submissionColumns}`,
    [
      row.id,
      row.widget_id,
      row.tenant_id,
      JSON.stringify(row.payload),
      row.client_ip,
      row.geo == null ? null : JSON.stringify(row.geo),
      row.geo_provider,
      row.honeypot_result,
      row.idempotency_key,
    ],
  );
  return result.rows[0];
}

export function createSubmissionRepository(db) {
  return {
    findByIdempotencyKey: (idempotencyKey) => findSubmissionByIdempotencyKey(db, idempotencyKey),
    insert: (row) => insertSubmission(db, row),
  };
}
