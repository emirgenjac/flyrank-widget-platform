import {
  dashboardCountsSql,
  dashboardGeoSql,
  dashboardSubmissionsSql,
  dashboardWidgetsSql,
} from "./ownerQueries.js";

function count(value) {
  return Number(value);
}

function timestamp(value) {
  return value instanceof Date ? value.toISOString() : value;
}

export function createDashboardRepository(db) {
  return {
    async listSubmissions(tenantId) {
      const query = dashboardSubmissionsSql(tenantId);
      const result = await db.query(query.text, query.values);
      return result.rows.map((row) => ({
        id: row.id,
        widget_id: row.widget_id,
        tenant_id: row.tenant_id,
        payload: row.payload,
        geo: row.geo,
        created_at: timestamp(row.created_at),
      }));
    },
    async stats(tenantId) {
      const counts = dashboardCountsSql(tenantId);
      const widgets = dashboardWidgetsSql(tenantId);
      const geo = dashboardGeoSql(tenantId);
      const [countRows, widgetRows, geoRows] = await Promise.all([
        db.query(counts.text, counts.values),
        db.query(widgets.text, widgets.values),
        db.query(geo.text, geo.values),
      ]);
      return {
        counts_over_time: countRows.rows.map((row) => ({
          date: row.date,
          count: count(row.count),
        })),
        widgets: widgetRows.rows.map((row) => ({
          widget_id: row.widget_id,
          public_id: row.public_id,
          count: count(row.count),
        })),
        geo: geoRows.rows.map((row) => ({
          country_code: row.country_code ?? null,
          count: count(row.count),
        })),
      };
    },
  };
}
