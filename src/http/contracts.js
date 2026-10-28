import {
  buildSubmissionBody,
  buildWidgetConfig,
  CONFIG_CACHE_CONTROL,
  embedSnippet,
  SCRIPT_CACHE_CONTROL,
} from "../logic/embed.js";

const origin = "http://localhost:3000";
const publicId = "abcDEF123456";
const widgetId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const submissionId = "44444444-4444-4444-8444-444444444444";
const idempotencyKey = "33333333-3333-4333-8333-333333333333";

const unauthorized = { error: "unauthorized" };
const notFound = { error: "not found" };

const widgetFields = [
  { name: "email", label: "Email", input_type: "email", required: true },
];

const widgetWrite = {
  type: "signup",
  title: "Join the list",
  button_text: "Subscribe",
  fields: widgetFields,
};

const storedWidget = {
  id: widgetId,
  public_id: publicId,
  tenant_id: tenantId,
  ...widgetWrite,
  description: null,
  display_options: { placement: "inline", theme: "light" },
};

const config = buildWidgetConfig(storedWidget, origin);
const snippet = embedSnippet(origin, "v1", publicId);
const submissionBody = buildSubmissionBody(publicId, idempotencyKey, {
  email: "ada@example.com",
});

const cors = {
  "Access-Control-Allow-Origin": "https://customer.example",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

const userId = "55555555-5555-4555-8555-555555555555";

export const contracts = [
  {
    id: "auth.register",
    group: "public",
    method: "POST",
    path: "/auth/register",
    auth: "none",
    tenant: "created",
    statuses: [201, 400, 409],
    request: { name: "Acme", email: "ada@example.com", password: "correct-horse" },
    responses: {
      201: {
        token: "<token>",
        user: { id: userId, tenant_id: tenantId, email: "ada@example.com" },
      },
      400: { error: "invalid account" },
      409: { error: "email taken" },
    },
  },
  {
    id: "auth.login",
    group: "public",
    method: "POST",
    path: "/auth/login",
    auth: "none",
    tenant: "none",
    statuses: [200, 400, 401],
    request: { email: "ada@example.com", password: "correct-horse" },
    responses: {
      200: {
        token: "<token>",
        user: { id: userId, tenant_id: tenantId, email: "ada@example.com" },
      },
      400: { error: "invalid account" },
      401: unauthorized,
    },
  },
  {
    id: "widgets.create",
    group: "owner",
    method: "POST",
    path: "/widgets",
    auth: "bearer",
    tenant: "token",
    statuses: [201, 400, 401],
    request: widgetWrite,
    responses: {
      201: { ...storedWidget, embed: snippet },
      400: { error: "invalid widget" },
      401: unauthorized,
    },
  },
  {
    id: "widgets.list",
    group: "owner",
    method: "GET",
    path: "/widgets",
    auth: "bearer",
    tenant: "token",
    statuses: [200, 401],
    request: null,
    responses: {
      200: { widgets: [storedWidget] },
      401: unauthorized,
    },
  },
  {
    id: "widgets.read",
    group: "owner",
    method: "GET",
    path: "/widgets/:id",
    auth: "bearer",
    tenant: "token",
    statuses: [200, 401, 404],
    request: null,
    responses: {
      200: storedWidget,
      401: unauthorized,
      404: notFound,
    },
  },
  {
    id: "widgets.update",
    group: "owner",
    method: "PATCH",
    path: "/widgets/:id",
    auth: "bearer",
    tenant: "token",
    statuses: [200, 400, 401, 404],
    request: { title: "Join us" },
    responses: {
      200: { ...storedWidget, title: "Join us" },
      400: { error: "invalid widget" },
      401: unauthorized,
      404: notFound,
    },
  },
  {
    id: "widgets.delete",
    group: "owner",
    method: "DELETE",
    path: "/widgets/:id",
    auth: "bearer",
    tenant: "token",
    statuses: [204, 401, 404, 409],
    request: null,
    responses: {
      204: null,
      401: unauthorized,
      404: notFound,
      409: { error: "widget has submissions" },
    },
  },
  {
    id: "widgets.embed",
    group: "owner",
    method: "GET",
    path: "/widgets/:id/embed",
    auth: "bearer",
    tenant: "token",
    statuses: [200, 401, 404],
    request: null,
    responses: {
      200: { embed: snippet },
      401: unauthorized,
      404: notFound,
    },
  },
  {
    id: "delivery.script",
    group: "public",
    method: "GET",
    path: "/widget.:version.js",
    auth: "none",
    tenant: "none",
    statuses: [200, 404],
    headers: {
      "Cache-Control": SCRIPT_CACHE_CONTROL,
      "Content-Type": "application/javascript; charset=utf-8",
    },
    request: null,
    responses: {
      200: "/* widget bundle */",
      404: notFound,
    },
  },
  {
    id: "delivery.config",
    group: "public",
    method: "GET",
    path: "/widgets/:publicId/config",
    auth: "none",
    tenant: "none",
    statuses: [200, 404],
    headers: {
      "Cache-Control": CONFIG_CACHE_CONTROL,
      "Access-Control-Allow-Origin": cors["Access-Control-Allow-Origin"],
      Vary: "Origin",
    },
    request: null,
    responses: {
      200: config,
      404: notFound,
    },
  },
  {
    id: "submissions.preflight",
    group: "public",
    method: "OPTIONS",
    path: "/submissions",
    auth: "none",
    tenant: "none",
    statuses: [204],
    headers: cors,
    request: null,
    responses: {
      204: null,
    },
  },
  {
    id: "submissions.create",
    group: "public",
    method: "POST",
    path: "/submissions",
    auth: "none",
    tenant: "none",
    statuses: [200, 201, 400, 404, 409, 413, 429],
    headers: {
      "Access-Control-Allow-Origin": cors["Access-Control-Allow-Origin"],
      Vary: "Origin",
    },
    request: submissionBody,
    responses: {
      201: { ok: true, id: submissionId },
      200: { ok: true },
      400: { error: "invalid submission" },
      404: notFound,
      409: { error: "idempotency conflict" },
      413: { error: "payload too large" },
      429: { error: "too many requests" },
    },
  },
  {
    id: "dashboard.submissions",
    group: "dashboard",
    method: "GET",
    path: "/dashboard/submissions",
    auth: "bearer",
    tenant: "token",
    statuses: [200, 401],
    request: null,
    responses: {
      200: {
        submissions: [
          {
            id: submissionId,
            widget_id: widgetId,
            tenant_id: tenantId,
            payload: { email: "ada@example.com" },
            geo: null,
            created_at: "2026-10-28T12:00:00.000Z",
          },
        ],
      },
      401: unauthorized,
    },
  },
  {
    id: "dashboard.stats",
    group: "dashboard",
    method: "GET",
    path: "/dashboard/stats",
    auth: "bearer",
    tenant: "token",
    statuses: [200, 401],
    request: null,
    responses: {
      200: {
        counts_over_time: [{ date: "2026-10-28", count: 1 }],
        widgets: [{ widget_id: widgetId, public_id: publicId, count: 1 }],
        geo: [{ country_code: null, count: 1 }],
      },
      401: unauthorized,
    },
  },
];

export function contractById(id) {
  const contract = contracts.find((item) => item.id === id);
  if (!contract) {
    throw new TypeError(`Unknown contract: ${id}`);
  }
  return contract;
}
