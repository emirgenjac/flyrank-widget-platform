import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";

export const WIDGET_TYPES = ["signup", "cta", "popover"];
export const FIELD_INPUT_TYPES = ["email", "text", "tel"];
export const PLACEMENTS = ["inline", "bottom-right", "center"];
export const THEMES = ["light", "dark"];
export const RESERVED_FIELD_NAME = "company_website";
export const MAX_FIELDS = 8;
export const PUBLIC_ID_LENGTH = 12;
export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9]{12}$/;

const PUBLIC_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const widgetFieldSchema = z.strictObject({
  name: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label: z.string().trim().min(1).max(80),
  input_type: z.enum(FIELD_INPUT_TYPES),
  required: z.boolean(),
});

const displayOptionsInputSchema = z.strictObject({
  placement: z.enum(PLACEMENTS).optional(),
  theme: z.enum(THEMES).optional(),
});

const storedDisplayOptionsSchema = z.strictObject({
  placement: z.enum(PLACEMENTS),
  theme: z.enum(THEMES),
});

const descriptionSchema = z.string().trim().min(1).max(500).nullable();

const createWidgetSchema = z.strictObject({
  type: z.enum(WIDGET_TYPES),
  title: z.string().trim().min(1).max(120),
  description: descriptionSchema.optional(),
  fields: z.array(widgetFieldSchema).max(MAX_FIELDS).optional(),
  button_text: z.string().trim().min(1).max(40),
  display_options: displayOptionsInputSchema.optional(),
}).superRefine((value, ctx) => {
  const fields = value.fields ?? [];
  const seen = new Set();
  fields.forEach((field, index) => {
    if (field.name === RESERVED_FIELD_NAME) {
      ctx.addIssue({
        code: "custom",
        path: ["fields", index, "name"],
        message: "This field name is reserved.",
      });
    }
    if (seen.has(field.name)) {
      ctx.addIssue({
        code: "custom",
        path: ["fields", index, "name"],
        message: "Field names must be unique in a widget.",
      });
    }
    seen.add(field.name);
  });
  if (value.type === "signup" && !fields.some((field) => field.input_type === "email")) {
    ctx.addIssue({
      code: "custom",
      path: ["fields"],
      message: "A signup widget needs an email field.",
    });
  }
}).transform((value) => ({
  type: value.type,
  title: value.title,
  description: value.description ?? null,
  fields: value.fields ?? [],
  button_text: value.button_text,
  display_options: {
    placement: value.display_options?.placement ?? (value.type === "popover" ? "bottom-right" : "inline"),
    theme: value.display_options?.theme ?? "light",
  },
}));

export const widgetPatchSchema = z.strictObject({
  type: z.enum(WIDGET_TYPES).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  description: descriptionSchema.optional(),
  fields: z.array(widgetFieldSchema).max(MAX_FIELDS).optional(),
  button_text: z.string().trim().min(1).max(40).optional(),
  display_options: displayOptionsInputSchema.optional(),
});

const storedWidgetSchema = z.strictObject({
  type: z.enum(WIDGET_TYPES),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500).nullable(),
  fields: z.array(widgetFieldSchema).max(MAX_FIELDS),
  button_text: z.string().min(1).max(40),
  display_options: storedDisplayOptionsSchema,
});

const tenantIdSchema = z.uuid();
const publicIdSchema = z.string().regex(PUBLIC_ID_PATTERN);

export function createPublicId() {
  let publicId = "";
  for (let index = 0; index < PUBLIC_ID_LENGTH; index += 1) {
    publicId += PUBLIC_ID_ALPHABET[randomInt(PUBLIC_ID_ALPHABET.length)];
  }
  return publicId;
}

export function parseCreateWidget(input) {
  return createWidgetSchema.safeParse(input);
}

export function parseWidgetPatch(existing, patch) {
  const parsedPatch = widgetPatchSchema.safeParse(patch);
  if (!parsedPatch.success) {
    return parsedPatch;
  }
  const data = parsedPatch.data;
  const merged = {
    type: data.type ?? existing.type,
    title: data.title ?? existing.title,
    description: Object.hasOwn(data, "description") ? data.description : existing.description,
    fields: data.fields ?? existing.fields,
    button_text: data.button_text ?? existing.button_text,
    display_options: data.display_options
      ? { ...existing.display_options, ...data.display_options }
      : existing.display_options,
  };
  return createWidgetSchema.safeParse(merged);
}

export function toWidgetInsert({ tenantId, publicId, widget }) {
  const tenant = tenantIdSchema.safeParse(tenantId);
  const parsedPublicId = publicIdSchema.safeParse(publicId);
  const body = storedWidgetSchema.safeParse(widget);
  if (!tenant.success || !parsedPublicId.success || !body.success) {
    throw new TypeError("Widget insert needs a tenant uuid, a public id, and a normalized widget.");
  }
  return {
    id: randomUUID(),
    tenant_id: tenant.data,
    public_id: parsedPublicId.data,
    type: body.data.type,
    title: body.data.title,
    description: body.data.description,
    fields: body.data.fields,
    button_text: body.data.button_text,
    display_options: body.data.display_options,
  };
}
