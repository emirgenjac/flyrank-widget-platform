import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicId,
  parseCreateWidget,
  parseWidgetPatch,
  PUBLIC_ID_PATTERN,
  toWidgetInsert,
} from "./widget.js";

const emailField = {
  name: "email",
  label: "Email",
  input_type: "email",
  required: true,
};

function issueText(result) {
  return result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("\n");
}

test("signup stores defaults and a null description", () => {
  const result = parseCreateWidget({
    type: "signup",
    title: " Join the list ",
    button_text: " Subscribe ",
    fields: [emailField],
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    type: "signup",
    title: "Join the list",
    description: null,
    fields: [emailField],
    button_text: "Subscribe",
    display_options: { placement: "inline", theme: "light" },
  });
});

test("popover without fields defaults to the corner", () => {
  const result = parseCreateWidget({
    type: "popover",
    title: "Get the guide",
    button_text: "Send it",
    display_options: { theme: "dark" },
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.display_options, {
    placement: "bottom-right",
    theme: "dark",
  });
  assert.deepEqual(result.data.fields, []);
});

test("signup without an email field is rejected", () => {
  const result = parseCreateWidget({
    type: "signup",
    title: "Join",
    button_text: "Go",
    fields: [{ name: "phone", label: "Phone", input_type: "tel", required: false }],
  });
  assert.equal(result.success, false);
  assert.match(issueText(result), /email field/);
});

test("a reserved field name is rejected without naming the rule", () => {
  const result = parseCreateWidget({
    type: "cta",
    title: "Call",
    button_text: "Go",
    fields: [{ name: "company_website", label: "Site", input_type: "text", required: false }],
  });
  assert.equal(result.success, false);
  const text = issueText(result);
  assert.match(text, /reserved/);
  assert.doesNotMatch(text, /honeypot/i);
  assert.doesNotMatch(text, /spam/i);
});

test("duplicate field names are rejected", () => {
  const result = parseCreateWidget({
    type: "cta",
    title: "Call",
    button_text: "Go",
    fields: [
      { name: "note", label: "Note", input_type: "text", required: false },
      { name: "note", label: "Again", input_type: "text", required: true },
    ],
  });
  assert.equal(result.success, false);
  assert.match(issueText(result), /unique/);
});

test("more than eight fields is rejected", () => {
  const fields = Array.from({ length: 9 }, (_, index) => ({
    name: `field_${index}`,
    label: "Field",
    input_type: "text",
    required: false,
  }));
  const result = parseCreateWidget({
    type: "cta",
    title: "Call",
    button_text: "Go",
    fields,
  });
  assert.equal(result.success, false);
});

test("owner cannot send ids on create", () => {
  const result = parseCreateWidget({
    type: "cta",
    title: "Call",
    button_text: "Go",
    id: "nope",
    public_id: "abcdefghij12",
    tenant_id: "nope",
  });
  assert.equal(result.success, false);
  assert.match(issueText(result), /Unrecognized key/);
});

test("a patch can change theme and clear description", () => {
  const created = parseCreateWidget({
    type: "signup",
    title: "Join",
    description: "Weekly notes",
    button_text: "Subscribe",
    fields: [emailField],
  });
  const patched = parseWidgetPatch(created.data, {
    description: null,
    display_options: { theme: "dark" },
  });
  assert.equal(patched.success, true);
  assert.equal(patched.data.description, null);
  assert.deepEqual(patched.data.display_options, {
    placement: "inline",
    theme: "dark",
  });
});

test("changing a widget to signup still requires an email field", () => {
  const created = parseCreateWidget({
    type: "cta",
    title: "Call",
    button_text: "Go",
  });
  const patched = parseWidgetPatch(created.data, { type: "signup" });
  assert.equal(patched.success, false);
  assert.match(issueText(patched), /email field/);
});

test("a patch cannot change tenant or public id", () => {
  const created = parseCreateWidget({
    type: "cta",
    title: "Call",
    button_text: "Go",
  });
  const patched = parseWidgetPatch(created.data, { tenant_id: "other", public_id: "abcdefghij12" });
  assert.equal(patched.success, false);
});

test("public ids are 12 url-safe characters", () => {
  for (let index = 0; index < 20; index += 1) {
    assert.match(createPublicId(), PUBLIC_ID_PATTERN);
  }
});

test("insert rows keep the normalized widget and generated ids", () => {
  const created = parseCreateWidget({
    type: "signup",
    title: "Join",
    button_text: "Subscribe",
    fields: [emailField],
  });
  const row = toWidgetInsert({
    tenantId: "11111111-1111-4111-8111-111111111111",
    publicId: createPublicId(),
    widget: created.data,
  });
  assert.match(row.id, /^[0-9a-f-]{36}$/);
  assert.match(row.public_id, PUBLIC_ID_PATTERN);
  assert.equal(row.tenant_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(row.type, "signup");
  assert.equal(row.description, null);
});
