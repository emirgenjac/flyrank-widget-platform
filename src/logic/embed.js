import { PUBLIC_ID_PATTERN, RESERVED_FIELD_NAME } from "./widget.js";

export const SCRIPT_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const CONFIG_CACHE_CONTROL = "public, max-age=60";

const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;

function apiOrigin(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new TypeError("Embed base URL must be an http or https origin.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("Embed base URL must be an http or https origin.");
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new TypeError("Embed base URL must be an origin without a path.");
  }
  return url.origin;
}

function requireVersion(assetVersion) {
  if (!VERSION_PATTERN.test(assetVersion)) {
    throw new TypeError("Widget asset version must be a cache-bust token such as v1.");
  }
  return assetVersion;
}

function requirePublicId(publicId) {
  if (!PUBLIC_ID_PATTERN.test(publicId)) {
    throw new TypeError("Embed requires the widget public id.");
  }
  return publicId;
}

export function scriptUrl(baseUrl, assetVersion) {
  const origin = apiOrigin(baseUrl);
  const version = requireVersion(assetVersion);
  return `${origin}/widget.${version}.js`;
}

export function configUrl(baseUrl, publicId) {
  return `${apiOrigin(baseUrl)}/widgets/${requirePublicId(publicId)}/config`;
}

export function submissionUrl(baseUrl) {
  return `${apiOrigin(baseUrl)}/submissions`;
}

export function embedSnippet(baseUrl, assetVersion, publicId) {
  const src = scriptUrl(baseUrl, assetVersion);
  const id = requirePublicId(publicId);
  return `<script src="${src}" data-widget-id="${id}"></script>`;
}

export function buildWidgetConfig(widget, baseUrl) {
  const publicId = requirePublicId(widget?.public_id);
  return {
    id: publicId,
    type: widget.type,
    title: widget.title,
    description: widget.description ?? null,
    fields: widget.fields.map((field) => ({
      name: field.name,
      label: field.label,
      input_type: field.input_type,
      required: field.required,
    })),
    button_text: widget.button_text,
    display_options: {
      placement: widget.display_options.placement,
      theme: widget.display_options.theme,
    },
    submit_url: submissionUrl(baseUrl),
  };
}

export function renderForm(config) {
  return {
    title: config.title,
    description: config.description,
    placement: config.display_options.placement,
    theme: config.display_options.theme,
    fields: config.fields.map((field) => ({ ...field })),
    honeypot: { name: RESERVED_FIELD_NAME, value: "" },
    button_text: config.button_text,
  };
}

export function buildSubmissionBody(publicId, idempotencyKey, values) {
  return {
    public_id: requirePublicId(publicId),
    idempotency_key: idempotencyKey,
    fields: { ...values },
    company_website: "",
  };
}
