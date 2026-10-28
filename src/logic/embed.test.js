import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSubmissionBody,
  buildWidgetConfig,
  CONFIG_CACHE_CONTROL,
  configUrl,
  embedSnippet,
  renderForm,
  SCRIPT_CACHE_CONTROL,
  scriptUrl,
} from "./embed.js";
import { parseSubmission } from "./submission.js";
import { parseCreateWidget } from "./widget.js";

const baseUrl = "http://localhost:3000";
const publicId = "abcDEF123456";

function widget() {
  const created = parseCreateWidget({
    type: "signup",
    title: "Join the list",
    description: "Weekly notes",
    button_text: "Subscribe",
    fields: [
      { name: "email", label: "Email", input_type: "email", required: true },
    ],
  });
  return {
    ...created.data,
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    public_id: publicId,
  };
}

test("the snippet is one line and the script URL changes with the version", () => {
  const snippet = embedSnippet(baseUrl, "v1", publicId);
  assert.equal(snippet.includes("\n"), false);
  assert.equal(snippet, `<script src="${scriptUrl(baseUrl, "v1")}" data-widget-id="${publicId}"></script>`);
  assert.equal(scriptUrl(baseUrl, "v1"), "http://localhost:3000/widget.v1.js");
  assert.notEqual(scriptUrl(baseUrl, "v1"), scriptUrl(baseUrl, "v2"));
  assert.equal(scriptUrl("http://localhost:3000/", "v1"), scriptUrl(baseUrl, "v1"));
});

test("script cache is long and config cache is short", () => {
  assert.match(SCRIPT_CACHE_CONTROL, /max-age=31536000/);
  assert.match(SCRIPT_CACHE_CONTROL, /immutable/);
  assert.match(CONFIG_CACHE_CONTROL, /max-age=60/);
  assert.equal(CONFIG_CACHE_CONTROL.includes("31536000"), false);
});

test("config is a small public payload and the form can submit it", () => {
  const source = widget();
  const config = buildWidgetConfig(source, baseUrl);
  assert.equal(configUrl(baseUrl, publicId), "http://localhost:3000/widgets/abcDEF123456/config");
  assert.equal(config.id, publicId);
  assert.equal(config.submit_url, "http://localhost:3000/submissions");
  assert.deepEqual(config.fields, [
    { name: "email", label: "Email", input_type: "email", required: true },
  ]);
  const encoded = JSON.stringify(config);
  assert.equal(encoded.includes("tenant_id"), false);
  assert.equal(encoded.includes(source.id), false);
  assert.equal(encoded.includes(source.tenant_id), false);

  const form = renderForm(config);
  assert.equal(form.honeypot.name, "company_website");
  assert.equal(form.honeypot.value, "");
  assert.equal(form.button_text, "Subscribe");

  const body = buildSubmissionBody(publicId, "33333333-3333-4333-8333-333333333333", {
    email: "ada@example.com",
  });
  const stored = parseSubmission({
    body,
    widget: source,
    clientIp: "203.0.113.10",
  });
  assert.equal(stored.ok, true);
  assert.deepEqual(stored.value.payload, { email: "ada@example.com" });
});
