(function () {
  var script = document.currentScript;
  if (!script) {
    return;
  }
  var widgetId = script.getAttribute("data-widget-id");
  if (!widgetId) {
    return;
  }
  var api = new URL(script.src);
  var root = document.createElement("div");
  root.setAttribute("data-widget", widgetId);
  script.insertAdjacentElement("afterend", root);

  fetch(api.origin + "/widgets/" + encodeURIComponent(widgetId) + "/config")
    .then(function (response) {
      if (!response.ok) {
        throw new Error("config unavailable");
      }
      return response.json();
    })
    .then(function (config) {
      render(root, config, widgetId);
    })
    .catch(function () {
      root.textContent = "This form is unavailable.";
    });

  function render(root, config, widgetId) {
    var form = document.createElement("form");
    var title = document.createElement("p");
    title.textContent = config.title || "";
    form.appendChild(title);
    if (config.description) {
      var description = document.createElement("p");
      description.textContent = config.description;
      form.appendChild(description);
    }
    var fields = Array.isArray(config.fields) ? config.fields : [];
    fields.forEach(function (field) {
      if (!field || typeof field.name !== "string" || field.name === "company_website") {
        return;
      }
      var label = document.createElement("label");
      label.textContent = field.label || field.name;
      var input = document.createElement("input");
      input.name = field.name;
      input.type = field.input_type === "email" || field.input_type === "tel" ? field.input_type : "text";
      if (field.required) {
        input.required = true;
      }
      label.appendChild(input);
      form.appendChild(label);
    });
    var honeypot = document.createElement("input");
    honeypot.name = "company_website";
    honeypot.type = "text";
    honeypot.value = "";
    honeypot.tabIndex = -1;
    honeypot.autocomplete = "off";
    honeypot.setAttribute("aria-hidden", "true");
    honeypot.style.position = "absolute";
    honeypot.style.left = "-9999px";
    form.appendChild(honeypot);
    var button = document.createElement("button");
    button.type = "submit";
    button.textContent = config.button_text || "Submit";
    form.appendChild(button);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      send(form, config, widgetId, button, honeypot);
    });
    root.replaceChildren(form);
  }

  function send(form, config, widgetId, button, honeypot) {
    var fields = {};
    form.querySelectorAll("input").forEach(function (input) {
      if (input.name && input.name !== "company_website") {
        fields[input.name] = input.value;
      }
    });
    button.disabled = true;
    fetch(config.submit_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        public_id: widgetId,
        idempotency_key: crypto.randomUUID(),
        fields: fields,
        company_website: honeypot.value,
      }),
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("submit failed");
      }
      form.textContent = "Thanks.";
    }).catch(function () {
      button.disabled = false;
    });
  }
})();
