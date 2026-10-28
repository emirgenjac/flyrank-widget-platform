import { PUBLIC_ID_PATTERN } from "../logic/widget.js";
import {
  findWidgetForOwnerSql,
  listWidgetsSql,
  requireTenantId,
} from "./ownerQueries.js";

const widgetColumns = "id, public_id, tenant_id, type, title, description, fields, button_text, display_options, created_at, updated_at";

export async function insertWidget(db, row) {
  const result = await db.query(
    `INSERT INTO widgets (
      id, public_id, tenant_id, type, title, description, fields, button_text, display_options
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb)
    RETURNING ${widgetColumns}`,
    [
      row.id,
      row.public_id,
      requireTenantId(row.tenant_id),
      row.type,
      row.title,
      row.description,
      JSON.stringify(row.fields),
      row.button_text,
      JSON.stringify(row.display_options),
    ],
  );
  return result.rows[0];
}

export async function listWidgets(db, tenantId) {
  const query = listWidgetsSql(tenantId);
  const result = await db.query(query.text, query.values);
  return result.rows;
}

export async function findWidgetByPublicId(db, publicId) {
  if (typeof publicId !== "string" || !PUBLIC_ID_PATTERN.test(publicId)) {
    return null;
  }
  const result = await db.query(
    `SELECT ${widgetColumns} FROM widgets WHERE public_id = $1`,
    [publicId],
  );
  return result.rows[0] ?? null;
}

export async function findWidget(db, tenantId, widgetId) {
  const query = findWidgetForOwnerSql(tenantId, widgetId);
  const result = await db.query(query.text, query.values);
  return result.rows[0] ?? null;
}

export async function updateWidget(db, tenantId, widgetId, widget) {
  const result = await db.query(
    `UPDATE widgets
     SET type = $3, title = $4, description = $5, fields = $6::jsonb, button_text = $7, display_options = $8::jsonb
     WHERE tenant_id = $1 AND id = $2
     RETURNING ${widgetColumns}`,
    [
      requireTenantId(tenantId),
      widgetId,
      widget.type,
      widget.title,
      widget.description,
      JSON.stringify(widget.fields),
      widget.button_text,
      JSON.stringify(widget.display_options),
    ],
  );
  return result.rows[0] ?? null;
}

export async function deleteWidget(db, tenantId, widgetId) {
  try {
    const result = await db.query(
      "DELETE FROM widgets WHERE tenant_id = $1 AND id = $2",
      [requireTenantId(tenantId), widgetId],
    );
    return result.rowCount > 0;
  } catch (error) {
    if (error?.code === "23503") {
      const conflict = new Error("widget has submissions");
      conflict.code = "WIDGET_IN_USE";
      throw conflict;
    }
    throw error;
  }
}

export function createWidgetRepository(db) {
  return {
    insert: (row) => insertWidget(db, row),
    list: (tenantId) => listWidgets(db, tenantId),
    find: (tenantId, widgetId) => findWidget(db, tenantId, widgetId),
    findByPublicId: (publicId) => findWidgetByPublicId(db, publicId),
    update: (tenantId, widgetId, widget) => updateWidget(db, tenantId, widgetId, widget),
    remove: (tenantId, widgetId) => deleteWidget(db, tenantId, widgetId),
  };
}
