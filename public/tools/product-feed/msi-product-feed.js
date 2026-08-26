const COUNTRY_CODE_PATTERN = /^[a-z0-9-]+$/;
const PRODUCT_LINE_PATTERN = /^[a-z0-9-]+$/i;
const VALID_SORTS = new Set(["default", "date"]);
const TEMPLATE_PLACEHOLDERS = new Set([
  "id",
  "index",
  "number",
  "img",
  "title",
  "link",
  "subname",
  "label",
  "release",
  "productLine",
]);
const BLOCKED_TEMPLATE_ELEMENTS = new Set([
  "SCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "BASE",
]);
const URL_ATTRIBUTES = new Set(["href", "src", "action", "formaction"]);
const HTML_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  reg: "®",
  trade: "™",
};

export const MSI_PRODUCT_FEED_VERSION = "0.1.0";

export class MSIProductFeedError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "MSIProductFeedError";
    this.code = code;
    this.details = details;
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new MSIProductFeedError(
      "INVALID_CONFIG",
      `${label} must be a non-empty string.`,
      { field: label },
    );
  }

  return value.trim();
}

function normalizePositiveInteger(value, label, fallback) {
  const resolved = value ?? fallback;
  const number = Number(resolved);

  if (!Number.isInteger(number) || number < 1) {
    throw new MSIProductFeedError(
      "INVALID_CONFIG",
      `${label} must be a positive integer.`,
      { field: label, value: resolved },
    );
  }

  return number;
}

function getLocationParts(locationLike) {
  if (!locationLike) {
    return { hostname: "", origin: "" };
  }

  if (typeof locationLike === "string") {
    const url = new URL(locationLike);
    return { hostname: url.hostname, origin: url.origin };
  }

  return {
    hostname: String(locationLike.hostname ?? ""),
    origin: String(locationLike.origin ?? ""),
  };
}

export function normalizeCountryCode(country) {
  if (country == null || String(country).trim() === "") {
    return "";
  }

  const code = String(country).trim().toLowerCase();

  if (!COUNTRY_CODE_PATTERN.test(code)) {
    throw new MSIProductFeedError(
      "INVALID_COUNTRY",
      `Invalid MSI country code: ${country}`,
      { country },
    );
  }

  return code;
}

export function resolveMsiOrigin(country, locationLike = globalThis.location) {
  const code = normalizeCountryCode(country);

  if (code) {
    return `https://${code}.msi.com`;
  }

  const { origin } = getLocationParts(locationLike);

  if (!origin) {
    throw new MSIProductFeedError(
      "MISSING_ORIGIN",
      "Unable to resolve the current website origin.",
    );
  }

  return origin.replace(/\/$/, "");
}

function getProxyCountry(country, locationLike) {
  const configured = normalizeCountryCode(country);

  if (configured) {
    return configured;
  }

  const { hostname } = getLocationParts(locationLike);
  const hostnameCode = hostname.toLowerCase().split(".")[0] ?? "";

  return COUNTRY_CODE_PATTERN.test(hostnameCode) ? hostnameCode : "";
}

export function flattenFilterTags(filterTagList) {
  const tags = [];
  const seen = new Set();

  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    const id = Number(value.id);
    if (Number.isInteger(id) && id > 0 && typeof value.title === "string") {
      const key = `${id}:${value.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        tags.push({ ...value, id });
      }
    }

    if (Object.hasOwn(value, "tag")) {
      visit(value.tag);
    }
    if (Object.hasOwn(value, "level2")) {
      visit(value.level2);
    }
  }

  visit(filterTagList);
  return tags;
}

export function resolveTagSelection(
  filterTagList,
  requestedTitles,
  { strict = false } = {},
) {
  if (!Array.isArray(requestedTitles) || requestedTitles.length === 0) {
    throw new MSIProductFeedError(
      "INVALID_CONFIG",
      "tagTitles must contain at least one exact tag title.",
      { field: "tagTitles" },
    );
  }

  const titles = [...new Set(requestedTitles.map((title) =>
    assertString(title, "tagTitles"),
  ))];
  const tags = flattenFilterTags(filterTagList);
  const matchedTags = [];
  const missingTagTitles = [];

  for (const title of titles) {
    const matches = tags.filter((tag) => tag.title === title);
    if (matches.length === 0) {
      missingTagTitles.push(title);
    } else {
      matchedTags.push(...matches);
    }
  }

  if (strict && missingTagTitles.length > 0) {
    throw new MSIProductFeedError(
      "TAG_NOT_FOUND",
      `Unable to find exact product tags: ${missingTagTitles.join(", ")}`,
      { missingTagTitles },
    );
  }

  const ids = [...new Set(matchedTags.map((tag) => tag.id))];
  if (ids.length === 0) {
    throw new MSIProductFeedError(
      "NO_TAG_IDS",
      "No product tag IDs were resolved.",
      { missingTagTitles },
    );
  }

  return { ids, matchedTags, missingTagTitles };
}

export function decodeHtmlEntities(value) {
  return String(value ?? "").replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, token) => {
      if (token[0] === "#") {
        const hexadecimal = token[1]?.toLowerCase() === "x";
        const parsed = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
        return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : entity;
      }

      return HTML_ENTITIES[token.toLowerCase()] ?? entity;
    },
  );
}

export function toPlainText(value) {
  return decodeHtmlEntities(
    String(value ?? "")
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function encodePath(value) {
  return String(value)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join("/");
}

export function buildProductUrl(product, apiOrigin) {
  const link = String(product?.link ?? "").trim();
  if (!link) {
    return "";
  }

  if (/^https?:\/\//i.test(link)) {
    const absolute = new URL(link);
    return absolute.protocol === "https:" || absolute.protocol === "http:"
      ? absolute.href
      : "";
  }

  const productLine = toPlainText(product?.product_line ?? "Product") || "Product";
  return new URL(
    `/${encodePath(productLine)}/${encodePath(link)}`,
    `${apiOrigin}/`,
  ).href;
}

export function normalizeProduct(product, apiOrigin) {
  const raw = product && typeof product === "object" ? product : {};

  return {
    id: raw.id ?? "",
    title: String(raw.title ?? ""),
    titleText: toPlainText(raw.title),
    subname: String(raw.subname ?? ""),
    subnameText: toPlainText(raw.subname),
    link: String(raw.link ?? ""),
    url: buildProductUrl(raw, apiOrigin),
    picture: String(raw.picture ?? ""),
    release: String(raw.release ?? ""),
    productLine: toPlainText(raw.product_line),
    label: toPlainText(raw.label),
    raw,
  };
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getProductTemplateVariables(product, index) {
  return {
    id: product.id,
    index,
    number: index + 1,
    img: product.picture,
    title: product.titleText,
    link: product.url,
    subname: product.subnameText,
    label: product.label,
    release: product.release,
    productLine: product.productLine,
  };
}

export function validateProductTemplate(html) {
  const template = assertString(html, "html");
  const placeholders = [...template.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)]
    .map((match) => match[1]);
  const unknown = [...new Set(placeholders.filter((name) =>
    !TEMPLATE_PLACEHOLDERS.has(name),
  ))];

  if (unknown.length > 0) {
    throw new MSIProductFeedError(
      "UNKNOWN_PLACEHOLDER",
      `Unknown HTML template placeholders: ${unknown.join(", ")}`,
      { unknown },
    );
  }

  return template;
}

export function renderProductTemplate(html, product, index) {
  const template = validateProductTemplate(html);
  const variables = getProductTemplateVariables(product, index);

  return template.replace(
    /\{([A-Za-z][A-Za-z0-9]*)\}/g,
    (_, name) => escapeHtml(variables[name]),
  );
}

function validateTemplateDom(fragment, baseUrl) {
  const elements = fragment.querySelectorAll("*");

  for (const element of elements) {
    if (BLOCKED_TEMPLATE_ELEMENTS.has(element.tagName)) {
      throw new MSIProductFeedError(
        "UNSAFE_TEMPLATE",
        `${element.tagName.toLowerCase()} is not allowed in product templates.`,
      );
    }

    for (const attribute of element.getAttributeNames()) {
      const normalized = attribute.toLowerCase();
      const value = element.getAttribute(attribute) ?? "";

      if (normalized.startsWith("on") || normalized === "srcdoc") {
        throw new MSIProductFeedError(
          "UNSAFE_TEMPLATE",
          `${attribute} is not allowed in product templates.`,
        );
      }

      if (URL_ATTRIBUTES.has(normalized) && value) {
        const url = new URL(value, baseUrl);
        if (!new Set(["http:", "https:"]).has(url.protocol)) {
          throw new MSIProductFeedError(
            "UNSAFE_TEMPLATE_URL",
            `${attribute} must use an HTTP or HTTPS URL.`,
            { attribute, value },
          );
        }
      }
    }

    if (
      element.tagName === "A" &&
      element.getAttribute("target")?.toLowerCase() === "_blank"
    ) {
      const rel = new Set(
        (element.getAttribute("rel") ?? "").split(/\s+/).filter(Boolean),
      );
      rel.add("noopener");
      rel.add("noreferrer");
      element.setAttribute("rel", [...rel].join(" "));
    }
  }
}

export function createProductFragment(documentObject, html, products) {
  if (!documentObject?.createElement) {
    throw new MSIProductFeedError(
      "MISSING_DOCUMENT",
      "A browser document is required to render product HTML.",
    );
  }

  const rendered = products
    .map((product, index) => renderProductTemplate(html, product, index))
    .join("");
  const template = documentObject.createElement("template");
  template.innerHTML = rendered;
  validateTemplateDom(template.content, documentObject.baseURI ?? "https://www.msi.com/");

  return template.content;
}

function validateProductLine(productLine) {
  const normalized = assertString(productLine, "productLine").toLowerCase();

  if (!PRODUCT_LINE_PATTERN.test(normalized)) {
    throw new MSIProductFeedError(
      "INVALID_PRODUCT_LINE",
      `Invalid product line: ${productLine}`,
      { productLine },
    );
  }

  return normalized;
}

function validateSort(sort) {
  const normalized = String(sort ?? "default").toLowerCase();

  if (!VALID_SORTS.has(normalized)) {
    throw new MSIProductFeedError(
      "INVALID_SORT",
      `sort must be one of: ${[...VALID_SORTS].join(", ")}`,
      { sort },
    );
  }

  return normalized;
}

export function createTagListUrl(apiOrigin, productLine) {
  const url = new URL("/api/v1/product/getProductTagList", `${apiOrigin}/`);
  url.searchParams.set("product_line", validateProductLine(productLine));
  return url.href;
}

export function createProductListUrl(
  apiOrigin,
  { productLine, pageNumber = 1, pageSize = 99, sort = "default", ids },
) {
  const url = new URL("/api/v1/product/getProductList", `${apiOrigin}/`);
  url.searchParams.set("product_line", validateProductLine(productLine));
  url.searchParams.set("page_number", String(normalizePositiveInteger(pageNumber, "pageNumber", 1)));
  url.searchParams.set("page_size", String(normalizePositiveInteger(pageSize, "pageSize", 99)));
  url.searchParams.set("sort", validateSort(sort));

  for (const id of ids ?? []) {
    const normalized = Number(id);
    if (!Number.isInteger(normalized) || normalized < 1) {
      throw new MSIProductFeedError("INVALID_TAG_ID", `Invalid product tag ID: ${id}`);
    }
    url.searchParams.append("id[]", String(normalized));
  }

  return url.href;
}

function createProxyRequestUrl(proxyUrl, endpoint, params, options) {
  const { origin } = getLocationParts(options.location ?? globalThis.location);
  const base = origin || options.apiOrigin;
  const url = new URL(proxyUrl, `${base}/`);
  url.searchParams.set("endpoint", endpoint);

  const country = getProxyCountry(options.country, options.location ?? globalThis.location);
  if (country) {
    url.searchParams.set("country", country);
  }

  url.searchParams.set("product_line", params.productLine);

  if (endpoint === "products") {
    url.searchParams.set("page_number", String(params.pageNumber));
    url.searchParams.set("page_size", String(params.pageSize));
    url.searchParams.set("sort", params.sort);
    params.ids.forEach((id) => url.searchParams.append("id[]", String(id)));
  }

  return url.href;
}

function getRequestUrl(endpoint, params, options) {
  if (options.proxyUrl) {
    return createProxyRequestUrl(options.proxyUrl, endpoint, params, options);
  }

  return endpoint === "tags"
    ? createTagListUrl(options.apiOrigin, params.productLine)
    : createProductListUrl(options.apiOrigin, params);
}

async function fetchApiJson(fetcher, url, signal) {
  let response;
  try {
    response = await fetcher(url, {
      signal,
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
  } catch (error) {
    if (signal.aborted) {
      throw new MSIProductFeedError("ABORTED", "Product feed request was aborted.");
    }
    throw new MSIProductFeedError(
      "NETWORK_ERROR",
      `Unable to request MSI product data from ${url}`,
      { cause: error, url },
    );
  }

  if (!response?.ok) {
    throw new MSIProductFeedError(
      "HTTP_ERROR",
      `MSI product API returned HTTP ${response?.status ?? "unknown"}.`,
      { status: response?.status, url },
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new MSIProductFeedError(
      "INVALID_RESPONSE",
      "MSI product API did not return valid JSON.",
      { cause: error, url },
    );
  }

  if (Number(payload?.status?.code) !== 200) {
    throw new MSIProductFeedError(
      "API_ERROR",
      payload?.status?.response || "MSI product API returned an error.",
      { payload, url },
    );
  }

  return payload;
}

function resolveRenderTarget(target, documentObject) {
  const element = typeof target === "string"
    ? documentObject.querySelector(target)
    : target;

  if (!element || typeof element.replaceChildren !== "function") {
    throw new MSIProductFeedError(
      "TARGET_NOT_FOUND",
      `Unable to find the product render target: ${String(target)}`,
      { target },
    );
  }

  return element;
}

async function runRenderLifecycle(options, result) {
  const documentObject = options.document ?? globalThis.document;
  const target = resolveRenderTarget(options.target, documentObject);
  const fragment = createProductFragment(documentObject, options.html, result.products);
  const baseContext = {
    feed: options.feed,
    target,
    products: result.products,
    matchedTags: result.matchedTags,
    missingTagTitles: result.missingTagTitles,
    apiOrigin: result.apiOrigin,
    options,
  };
  let primaryError = null;
  let failedPhase = null;

  try {
    failedPhase = "before";
    if (options.before) {
      await options.before(baseContext);
    }

    failedPhase = "render";
    target.replaceChildren(fragment);
    failedPhase = null;
  } catch (error) {
    primaryError = error;
  }

  let afterError = null;
  try {
    if (options.after) {
      await options.after({
        ...baseContext,
        error: primaryError,
        failedPhase,
      });
    }
  } catch (error) {
    afterError = error;
  }

  if (primaryError && afterError) {
    throw new AggregateError(
      [primaryError, afterError],
      "Product rendering and the after hook both failed.",
    );
  }
  if (primaryError) {
    throw primaryError;
  }
  if (afterError) {
    throw afterError;
  }
}

export class MSIProductFeed {
  constructor(options = {}) {
    this.options = { ...options };
    this.state = "idle";
    this.result = null;
    this._controller = null;
  }

  _resolveOptions(overrides = {}) {
    const options = { ...this.options, ...overrides };
    options.productLine = validateProductLine(options.productLine);
    options.tagTitles = Array.isArray(options.tagTitles)
      ? [...options.tagTitles]
      : options.tagTitles;
    options.sort = validateSort(options.sort);
    options.pageNumber = normalizePositiveInteger(options.pageNumber, "pageNumber", 1);
    options.pageSize = normalizePositiveInteger(options.pageSize, "pageSize", 99);
    options.strictTags = options.strictTags === true;
    options.requestTimeoutMs = normalizePositiveInteger(
      options.requestTimeoutMs,
      "requestTimeoutMs",
      15000,
    );
    options.location = options.location ?? globalThis.location;
    options.apiOrigin = resolveMsiOrigin(options.country, options.location);
    options.fetcher = options.fetcher ?? globalThis.fetch;
    options.feed = this;

    if (!Array.isArray(options.tagTitles) || options.tagTitles.length === 0) {
      throw new MSIProductFeedError(
        "INVALID_CONFIG",
        "tagTitles must contain at least one exact tag title.",
        { field: "tagTitles" },
      );
    }
    options.tagTitles = options.tagTitles.map((title) =>
      assertString(title, "tagTitles")
    );

    if (typeof options.fetcher !== "function") {
      throw new MSIProductFeedError("MISSING_FETCH", "A fetch implementation is required.");
    }
    if (options.before != null && typeof options.before !== "function") {
      throw new MSIProductFeedError("INVALID_CONFIG", "before must be a function.");
    }
    if (options.after != null && typeof options.after !== "function") {
      throw new MSIProductFeedError("INVALID_CONFIG", "after must be a function.");
    }

    const hasRenderOption = options.target != null || options.html != null ||
      options.before != null || options.after != null;
    if (hasRenderOption) {
      if (
        typeof options.target !== "string" &&
        typeof options.target?.replaceChildren !== "function"
      ) {
        throw new MSIProductFeedError(
          "INVALID_CONFIG",
          "target must be a selector or DOM element.",
        );
      }
      if (typeof options.target === "string") {
        assertString(options.target, "target");
      }
      options.html = validateProductTemplate(options.html);
    }
    return options;
  }

  async init(overrides = {}) {
    this.abort();
    const options = this._resolveOptions(overrides);
    const controller = new AbortController();
    this._controller = controller;
    this.state = "loading-tags";

    const externalSignal = options.signal;
    const abortFromExternal = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) {
      abortFromExternal();
    } else {
      externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
    }
    const timeout = setTimeout(() => controller.abort("timeout"), options.requestTimeoutMs);

    try {
      const tagUrl = getRequestUrl("tags", {
        productLine: options.productLine,
      }, options);
      const tagPayload = await fetchApiJson(options.fetcher, tagUrl, controller.signal);
      const filterTagList = tagPayload?.result?.filterTagList;
      if (!Array.isArray(filterTagList)) {
        throw new MSIProductFeedError(
          "INVALID_TAG_RESPONSE",
          "MSI tag API response is missing result.filterTagList.",
        );
      }

      const selection = resolveTagSelection(filterTagList, options.tagTitles, {
        strict: options.strictTags,
      });
      this.state = "loading-products";

      const productParams = {
        productLine: options.productLine,
        pageNumber: options.pageNumber,
        pageSize: options.pageSize,
        sort: options.sort,
        ids: selection.ids,
      };
      const productUrl = getRequestUrl("products", productParams, options);
      const productPayload = await fetchApiJson(
        options.fetcher,
        productUrl,
        controller.signal,
      );
      const rawProducts = productPayload?.result?.getProductList;
      if (!Array.isArray(rawProducts)) {
        throw new MSIProductFeedError(
          "INVALID_PRODUCT_RESPONSE",
          "MSI product API response is missing result.getProductList.",
        );
      }

      const products = rawProducts.map((raw, index) => {
        const product = normalizeProduct(raw, options.apiOrigin);
        if (typeof options.buildProductUrl === "function") {
          product.url = String(options.buildProductUrl(product, {
            apiOrigin: options.apiOrigin,
            index,
            raw,
          }) ?? "");
        }
        return product;
      });
      const result = {
        apiOrigin: options.apiOrigin,
        count: Number(productPayload?.result?.count) || products.length,
        ids: selection.ids,
        matchedTags: selection.matchedTags,
        missingTagTitles: selection.missingTagTitles,
        products,
      };

      if (options.target != null) {
        this.state = "rendering";
        await runRenderLifecycle(options, result);
      }

      this.result = result;
      this.state = "ready";
      return result;
    } catch (error) {
      this.state = controller.signal.aborted ? "aborted" : "error";
      throw error;
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternal);
      if (this._controller === controller) {
        this._controller = null;
      }
    }
  }

  abort() {
    this._controller?.abort("replaced");
  }

  destroy() {
    this.abort();
    this.result = null;
    this.state = "destroyed";
  }
}
