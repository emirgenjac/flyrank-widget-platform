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

export function dashboardSubmissionsSql(tenantId) {
  return {
    text: `SELECT id, widget_id, tenant_id, payload, geo, created_at
      FROM submissions
      WHERE tenant_id = $1
      ORDER BY created_at DESC`,
    values: [requireTenantId(tenantId)],
  };
}

export function dashboardCountsSql(tenantId) {
  return {
    text: `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, count(*)::int AS count
      FROM submissions
      WHERE tenant_id = $1
      GROUP BY 1
      ORDER BY 1 ASC`,
    values: [requireTenantId(tenantId)],
  };
}

export function dashboardWidgetsSql(tenantId) {
  return {
    text: `SELECT id AS widget_id, public_id,
        (SELECT count(*)::int FROM submissions WHERE tenant_id = $1 AND widget_id = widgets.id) AS count
      FROM widgets
      WHERE tenant_id = $1
      ORDER BY count DESC, public_id ASC`,
    values: [requireTenantId(tenantId)],
  };
}

export function dashboardGeoSql(tenantId) {
  return {
    text: `SELECT geo->>'country_code' AS country_code, count(*)::int AS count
      FROM submissions
      WHERE tenant_id = $1
      GROUP BY 1
      ORDER BY count DESC, country_code ASC NULLS LAST`,
    values: [requireTenantId(tenantId)],
  };
}
