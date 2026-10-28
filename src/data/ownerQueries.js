import { z } from "zod";

const tenantIdSchema = z.uuid();
const widgetIdSchema = z.uuid();

const widgetColumns = "id, public_id, tenant_id, type, title, description, fields, button_text, display_options, created_at, updated_at";
const submissionColumns = "id, widget_id, tenant_id, payload, client_ip, geo, geo_provider, honeypot_result, idempotency_key, created_at";

export function requireTenantId(tenantId) {
  const parsed = tenantIdSchema.safeParse(tenantId);
  if (!parsed.success) {
    throw new TypeError("Owner query requires a tenant id.");
  }
  return parsed.data;
}

function requireWidgetId(widgetId) {
  const parsed = widgetIdSchema.safeParse(widgetId);
  if (!parsed.success) {
    throw new TypeError("Owner query requires a widget id.");
  }
  return parsed.data;
}

export function listWidgetsSql(tenantId) {
  return {
    text: `SELECT ${widgetColumns} FROM widgets WHERE tenant_id = $1 ORDER BY created_at DESC`,
    values: [requireTenantId(tenantId)],
  };
}

export function findWidgetForOwnerSql(tenantId, widgetId) {
  return {
    text: `SELECT ${widgetColumns} FROM widgets WHERE tenant_id = $1 AND id = $2`,
    values: [requireTenantId(tenantId), requireWidgetId(widgetId)],
  };
}

export function listSubmissionsSql(tenantId) {
  return {
    text: `SELECT ${submissionColumns} FROM submissions WHERE tenant_id = $1 ORDER BY created_at DESC`,
    values: [requireTenantId(tenantId)],
  };
}

export function listSubmissionsByWidgetSql(tenantId, widgetId) {
  return {
    text: `SELECT ${submissionColumns} FROM submissions WHERE tenant_id = $1 AND widget_id = $2 ORDER BY created_at DESC`,
    values: [requireTenantId(tenantId), requireWidgetId(widgetId)],
  };
}
