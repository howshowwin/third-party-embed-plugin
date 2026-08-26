import {
  createTagListUrl,
  flattenFilterTags,
  MSIProductFeed,
  MSIProductFeedError,
  resolveMsiOrigin,
  toPlainText,
} from "./msi-product-feed.js";
import {
  PRODUCT_FEED_DEMO_DEFAULT_LOCALE,
  PRODUCT_FEED_DEMO_MESSAGES,
} from "./i18n.js";

const PRODUCT_CARD_TEMPLATE = `<div class="slider__Laptops-box">
  <div class="slider__Laptops-item">
    <img src="{img}" alt="{title}">
    <span class="product-label">{label}</span>
    <h4>{title}</h4>
    <p>{subname}</p>
    <a href="{link}" target="_blank"><span data-feed-i18n="product.learnMore">__LEARN_MORE__</span></a>
  </div>
</div>`;

const demoSection = document.querySelector("#live-demo");
const demoProxyUrl = globalThis.MSI_PRODUCT_FEED_DEMO_CONFIG?.proxyUrl
  ?? demoSection?.dataset.feedProxyUrl
  ?? "";
const form = document.querySelector("#product-feed-controls");
const status = document.querySelector("#product-feed-status");
const log = document.querySelector("#product-feed-log");
const tagSubmitButton = document.querySelector("#product-feed-tag-submit");
const tagOptions = document.querySelector("#product-feed-tag-options");
const tagArray = document.querySelector("#product-feed-tag-array");
const tagCount = document.querySelector("#product-feed-tag-count");
const selectAllButton = document.querySelector("#product-feed-select-all");
const clearTagsButton = document.querySelector("#product-feed-clear-tags");
const renderButton = document.querySelector("#product-feed-render");
const countryPreset = document.querySelector("#product-feed-country-preset");
const countryCustom = document.querySelector("#product-feed-country-custom");
const productLinePreset = document.querySelector("#product-feed-line-preset");
const productLineCustom = document.querySelector("#product-feed-line-custom");
const OTHER_PRESET_VALUE = "__other__";
let activeFeed = null;
let tagRequest = null;
let currentLocale = document.documentElement.dataset.siteLocale === "en"
  ? "en"
  : PRODUCT_FEED_DEMO_DEFAULT_LOCALE;

function translate(key, variables = {}) {
  const messages = PRODUCT_FEED_DEMO_MESSAGES[currentLocale]
    ?? PRODUCT_FEED_DEMO_MESSAGES[PRODUCT_FEED_DEMO_DEFAULT_LOCALE];
  const fallback = PRODUCT_FEED_DEMO_MESSAGES[PRODUCT_FEED_DEMO_DEFAULT_LOCALE];
  const template = messages[key] ?? fallback[key] ?? key;

  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, name) =>
    String(variables[name] ?? `{${name}}`)
  );
}

function setMessage(element, key, variables = {}) {
  if (!element) return;
  element.dataset.feedMessage = key;
  element.dataset.feedMessageVariables = JSON.stringify(variables);
  element.textContent = translate(key, variables);
}

function refreshMessage(element) {
  const key = element.dataset.feedMessage;
  if (!key) return;
  let variables = {};
  try {
    variables = JSON.parse(element.dataset.feedMessageVariables || "{}");
  } catch {
    variables = {};
  }
  element.textContent = translate(key, variables);
}

function translateDemo() {
  for (const element of demoSection?.querySelectorAll("[data-feed-i18n]") ?? []) {
    element.textContent = translate(element.dataset.feedI18n);
  }
  for (const element of demoSection?.querySelectorAll("[data-feed-i18n-aria-label]") ?? []) {
    element.setAttribute("aria-label", translate(element.dataset.feedI18nAriaLabel));
  }
  for (const element of demoSection?.querySelectorAll("[data-feed-i18n-placeholder]") ?? []) {
    element.setAttribute("placeholder", translate(element.dataset.feedI18nPlaceholder));
  }
  for (const element of demoSection?.querySelectorAll("[data-feed-message]") ?? []) {
    refreshMessage(element);
  }
  if (demoSection) demoSection.lang = currentLocale === "en" ? "en" : "zh-Hant";
  updateTagArray();
}

function appendLog(key, variables = {}, state = "") {
  if (!log) return;
  const item = document.createElement("li");
  setMessage(item, key, variables);
  if (state) item.dataset.state = state;
  log.append(item);
}

function setStatus(key, variables = {}, state = "") {
  setMessage(status, key, variables);
  if (status) status.dataset.state = state;
}

function selectedTagTitles() {
  if (!tagOptions) return [];
  return [...tagOptions.querySelectorAll('input[type="checkbox"]:checked')]
    .map((input) => input.value);
}

function updateTagArray() {
  const selected = selectedTagTitles();
  if (tagArray) tagArray.textContent = JSON.stringify(selected, null, 2);
  if (tagCount) tagCount.textContent = translate("array.selected", { count: selected.length });
  if (renderButton) renderButton.disabled = selected.length === 0;
}

function setTagButtonsEnabled(enabled) {
  if (selectAllButton) selectAllButton.disabled = !enabled;
  if (clearTagsButton) clearTagsButton.disabled = !enabled;
  if (!enabled && renderButton) renderButton.disabled = true;
}

function resetTagOptions(key = "category.reload", variables = {}) {
  tagRequest?.abort();
  tagRequest = null;
  tagOptions?.replaceChildren();
  if (tagOptions) {
    const empty = document.createElement("p");
    setMessage(empty, key, variables);
    tagOptions.append(empty);
  }
  setTagButtonsEnabled(false);
  updateTagArray();
}

function renderTagOptions(tags) {
  if (!tagOptions) return;
  const titles = [...new Set(tags.map((tag) => tag.title.trim()).filter(Boolean))]
    .sort((left, right) =>
      toPlainText(left).localeCompare(toPlainText(right), "en", { sensitivity: "base" })
    );

  tagOptions.replaceChildren();
  for (const [index, title] of titles.entries()) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");
    input.type = "checkbox";
    input.name = "selectedTagTitles";
    input.value = title;
    input.id = `product-feed-tag-${index}`;
    input.addEventListener("change", updateTagArray);
    text.textContent = toPlainText(title);
    label.title = title;
    label.append(input, text);
    tagOptions.append(label);
  }

  setTagButtonsEnabled(titles.length > 0);
  updateTagArray();
}

async function requestTagTitles(country, productLine, signal) {
  const url = demoProxyUrl
    ? new URL(demoProxyUrl, globalThis.location.origin)
    : new URL(createTagListUrl(
      resolveMsiOrigin(country, globalThis.location),
      productLine,
    ));

  if (demoProxyUrl) {
    url.searchParams.set("endpoint", "tags");
    url.searchParams.set("country", country);
    url.searchParams.set("product_line", productLine);
  }
  const response = await fetch(url, {
    signal,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new MSIProductFeedError("INVALID_RESPONSE", "Invalid MSI API JSON response.");
  }

  if (!response.ok) {
    throw new MSIProductFeedError(
      "HTTP_ERROR",
      payload?.status?.response || `MSI product API returned HTTP ${response.status}.`,
    );
  }

  if (Number(payload?.status?.code) !== 200) {
    throw new MSIProductFeedError(
      "API_ERROR",
      payload?.status?.response || "MSI product API returned an error.",
    );
  }

  const filterTagList = payload?.result?.filterTagList;
  if (!Array.isArray(filterTagList)) {
    throw new MSIProductFeedError(
      "INVALID_TAG_RESPONSE",
      "MSI tag API response is missing result.filterTagList.",
    );
  }

  const tags = flattenFilterTags(filterTagList);
  if (tags.length === 0) {
    throw new MSIProductFeedError(
      "NO_TAGS",
      "No category tags were found.",
      { country, productLine },
    );
  }

  return tags;
}

function getErrorDescriptor(error) {
  if (error instanceof MSIProductFeedError) {
    if (error.code === "INVALID_RESPONSE") {
      return { key: "error.invalidResponse", variables: {} };
    }
    if (error.code === "NO_TAGS") {
      return { key: "error.noTags", variables: error.details };
    }
    return {
      key: "error.api",
      variables: { code: error.code, message: error.message },
    };
  }

  return {
    key: "error.api",
    variables: {
      code: "ERROR",
      message: error?.message || translate("error.unknown"),
    },
  };
}

function setupPresetControl(select, input) {
  if (!select || !input) return;

  const sync = ({ focus = false } = {}) => {
    const isCustom = select.value === OTHER_PRESET_VALUE;
    input.hidden = !isCustom;
    input.required = isCustom;

    if (isCustom) {
      input.value = input.dataset.customValue ?? "";
      if (focus) input.focus();
    } else {
      input.value = select.value;
    }
  };

  input.addEventListener("input", () => {
    if (!input.hidden) input.dataset.customValue = input.value;
  });
  select.addEventListener("change", () => sync({ focus: true }));
  sync();
}

setupPresetControl(countryPreset, countryCustom);
setupPresetControl(productLinePreset, productLineCustom);

window.addEventListener("msi-site-locale-change", (event) => {
  const locale = event.detail?.locale;
  if (!PRODUCT_FEED_DEMO_MESSAGES[locale]) return;
  currentLocale = locale;
  translateDemo();
});

for (const button of document.querySelectorAll("[data-feed-copy]")) {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.feedCopy);
    if (!target) return;
    await navigator.clipboard.writeText(target.textContent ?? "");
    button.textContent = translate("copy.done");
    window.setTimeout(() => {
      button.textContent = translate(button.dataset.feedI18n);
    }, 1400);
  });
}

for (const field of form?.querySelectorAll("[data-feed-setting]") ?? []) {
  field.addEventListener("change", () => {
    resetTagOptions();
    setStatus("status.settingsChanged");
  });
}

selectAllButton?.addEventListener("click", () => {
  for (const input of tagOptions?.querySelectorAll('input[type="checkbox"]') ?? []) {
    input.checked = true;
  }
  updateTagArray();
});

clearTagsButton?.addEventListener("click", () => {
  for (const input of tagOptions?.querySelectorAll('input[type="checkbox"]') ?? []) {
    input.checked = false;
  }
  updateTagArray();
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(form);
  const country = String(values.get("country") ?? "uk").trim().toLowerCase();
  const productLine = String(values.get("productLine") ?? "nb").trim().toLowerCase();

  resetTagOptions("category.loading");
  const currentRequest = new AbortController();
  tagRequest = currentRequest;
  tagSubmitButton?.setAttribute("disabled", "");
  setStatus("status.loadingTags", {}, "loading");

  try {
    const tags = await requestTagTitles(country, productLine, currentRequest.signal);
    if (tagRequest !== currentRequest) return;
    renderTagOptions(tags);
    setStatus("status.loadedTags", { count: tagOptions?.childElementCount ?? 0 }, "ready");
  } catch (error) {
    if (currentRequest.signal.aborted) return;
    const descriptor = getErrorDescriptor(error);
    resetTagOptions(descriptor.key, descriptor.variables);
    setStatus(descriptor.key, descriptor.variables, "error");
  } finally {
    if (tagRequest === currentRequest) tagRequest = null;
    tagSubmitButton?.removeAttribute("disabled");
  }
});

renderButton?.addEventListener("click", async () => {
  const values = new FormData(form);
  const tagTitles = selectedTagTitles();
  if (tagTitles.length === 0) return;

  activeFeed?.destroy();
  log?.replaceChildren();
  renderButton.disabled = true;
  setStatus("status.loadingProducts", {}, "loading");
  appendLog("log.loadProducts", {}, "loading");

  activeFeed = new MSIProductFeed({
    productLine: String(values.get("productLine") ?? "nb").trim().toLowerCase(),
    country: String(values.get("country") ?? "uk").trim().toLowerCase(),
    tagTitles,
    sort: "default",
    pageSize: 99,
    target: "#product-feed-demo",
    html: PRODUCT_CARD_TEMPLATE.replace("__LEARN_MORE__", translate("product.learnMore")),
    ...(demoProxyUrl ? { proxyUrl: demoProxyUrl } : {}),
    before({ target, products }) {
      setStatus("status.replacing", {}, "loading");
      appendLog("log.before", { count: products.length });
      target.classList.remove("is-slider-ready");

      if (globalThis.jQuery && globalThis.jQuery(target).hasClass("slick-initialized")) {
        globalThis.jQuery(target).slick("unslick");
      }
    },
    after({ target, products, error, failedPhase }) {
      if (error) {
        appendLog("log.afterError", { phase: failedPhase }, "error");
        return;
      }

      target.classList.add("is-slider-ready");
      appendLog("log.afterReady", { count: products.length }, "ready");
    },
  });

  try {
    const result = await activeFeed.init();
    setStatus("status.complete", { count: result.products.length }, "ready");
    appendLog("log.matched", {
      count: result.matchedTags.length,
      ids: result.ids.join(", "),
    });
    appendLog("log.complete", {}, "ready");
  } catch (error) {
    const descriptor = getErrorDescriptor(error);
    const message = translate(descriptor.key, descriptor.variables);
    setStatus(descriptor.key, descriptor.variables, "error");
    appendLog("log.stopped", { message }, "error");
  } finally {
    renderButton.disabled = selectedTagTitles().length === 0;
  }
});

setStatus("status.initial");
translateDemo();
tagSubmitButton?.removeAttribute("disabled");
