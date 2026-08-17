const DEFAULTS = Object.freeze({
  manifestUrl:
    "https://storage-asset.msi.com/event/msi-third-party-embed/third-party-providers.json",
  cookieName: "msi_thirdPartyCookieControl",
  cookieMaxAgeDays: 180,
  cookieSecure: "auto",
  reloadOnCustomRevoke: true,
  locale: "auto",
  translationsUrl:
    "https://storage-asset.msi.com/event/msi-third-party-embed/plugin/translations.json",
});

const scriptLoads = new Map();
const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const ALLOWED_SCRIPT_ATTRIBUTES = new Set([
  "crossorigin",
  "fetchpriority",
  "id",
  "integrity",
  "nomodule",
  "referrerpolicy",
  "type",
]);
const META_GRAPH_API_VERSION = "v25.0";
const META_SDK_LOCALES = Object.freeze({
  ar: "ar_AR",
  "bg-BG": "bg_BG",
  "cs-CZ": "cs_CZ",
  "de-DE": "de_DE",
  "el-GR": "el_GR",
  en: "en_US",
  es: "es_ES",
  "fr-FR": "fr_FR",
  "hu-HU": "hu_HU",
  "id-ID": "id_ID",
  "it-IT": "it_IT",
  "ja-JP": "ja_JP",
  "ko-KR": "ko_KR",
  "nl-NL": "nl_NL",
  "pl-PL": "pl_PL",
  "pt-BR": "pt_BR",
  "ro-RO": "ro_RO",
  "ru-RU": "ru_RU",
  "sv-SE": "sv_SE",
  "th-TH": "th_TH",
  "tr-TR": "tr_TR",
  "uk-UA": "uk_UA",
  "vi-VN": "vi_VN",
  "zh-CN": "zh_CN",
  "zh-TW": "zh_TW",
});

function utf8Size(value) {
  return new TextEncoder().encode(value).length;
}

export function normalizeTranslations(rawTranslations) {
  if (!rawTranslations || typeof rawTranslations !== "object") {
    throw new Error("The translations file must be an object.");
  }

  const defaultLocale = String(rawTranslations.defaultLocale ?? "en");
  const locales = rawTranslations.locales;
  if (!locales || typeof locales !== "object" || Array.isArray(locales)) {
    throw new Error("The translations file must include a locales object.");
  }
  if (!locales[defaultLocale] || typeof locales[defaultLocale] !== "object") {
    throw new Error(`The default translation locale is missing: ${defaultLocale}`);
  }

  const markets =
    rawTranslations.markets && typeof rawTranslations.markets === "object"
      ? rawTranslations.markets
      : {};
  const aliases =
    rawTranslations.aliases && typeof rawTranslations.aliases === "object"
      ? rawTranslations.aliases
      : {};
  const domainCodes =
    rawTranslations.domainCodes && typeof rawTranslations.domainCodes === "object"
      ? rawTranslations.domainCodes
      : {};

  for (const [market, locale] of Object.entries(markets)) {
    const resolvedLocale = aliases[locale] ?? locale;
    if (!locales[resolvedLocale]) {
      throw new Error(`Market ${market} references an unknown locale: ${locale}`);
    }
  }

  for (const [code, locale] of Object.entries(domainCodes)) {
    const resolvedLocale = aliases[locale] ?? locale;
    if (!locales[resolvedLocale]) {
      throw new Error(`Domain code ${code} references an unknown locale: ${locale}`);
    }
  }

  for (const [locale, messages] of Object.entries(locales)) {
    if (!messages || typeof messages !== "object" || Array.isArray(messages)) {
      throw new Error(`Locale ${locale} must be an object.`);
    }
    if (messages.$extends && !locales[messages.$extends]) {
      throw new Error(`Locale ${locale} extends an unknown locale: ${messages.$extends}`);
    }
    for (const [key, value] of Object.entries(messages)) {
      if (key !== "$extends" && typeof value !== "string") {
        throw new Error(`Translation ${locale}.${key} must be a string.`);
      }
    }
  }

  return Object.freeze({ defaultLocale, locales, markets, aliases, domainCodes });
}

export function detectLocaleFromHostname(hostname, translations) {
  const defaultLocale = translations?.defaultLocale ?? "en";
  const normalizedHostname = String(hostname ?? "").trim().toLowerCase();
  if (
    normalizedHostname !== "msi.com" &&
    !normalizedHostname.endsWith(".msi.com")
  ) {
    return defaultLocale;
  }
  const firstLabel = normalizedHostname.split(".")[0];

  if (!firstLabel || firstLabel === "www" || firstLabel === "mtc") {
    return defaultLocale;
  }

  const exactLocale = translations?.domainCodes?.[firstLabel];
  const twoCharacterLocale = translations?.domainCodes?.[firstLabel.slice(0, 2)];
  const candidate = exactLocale ?? twoCharacterLocale ?? defaultLocale;
  const resolved = translations?.aliases?.[candidate] ?? candidate;
  return translations?.locales?.[resolved] ? resolved : defaultLocale;
}

function interpolateTranslation(template, values = {}) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
    values[key] === undefined || values[key] === null ? match : String(values[key]),
  );
}

export function normalizeCookieMaxAgeDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("cookieMaxAgeDays must be a positive number.");
  }
  return Math.min(days, 400);
}

export function normalizeScriptAttributes(attributes = {}) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    throw new Error("Script attributes must be an object.");
  }

  return Object.entries(attributes).map(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    if (!ALLOWED_SCRIPT_ATTRIBUTES.has(normalizedKey)) {
      throw new Error(`Script attribute is not allowed: ${key}`);
    }
    return [normalizedKey, value];
  });
}

function isRtlLocale(locale) {
  return /^ar(?:-|$)/i.test(locale);
}

function normalizeOrigin(origin, baseOrigin) {
  if (origin === "$self") return baseOrigin;

  const parsed = new URL(origin);
  if (parsed.protocol !== "https:") {
    throw new Error(`Only HTTPS origins are allowed: ${origin}`);
  }

  return parsed.origin;
}

function normalizeOriginList(origins, baseOrigin, fieldName) {
  if (!Array.isArray(origins)) return [];

  return origins.map((origin) => {
    if (typeof origin !== "string" || !origin.trim()) {
      throw new Error(`${fieldName} must contain non-empty strings.`);
    }
    return normalizeOrigin(origin, baseOrigin);
  });
}

export function normalizeManifest(rawManifest, baseOrigin) {
  if (!rawManifest || typeof rawManifest !== "object") {
    throw new Error("The provider manifest must be an object.");
  }

  if (!Array.isArray(rawManifest.providers)) {
    throw new Error("The provider manifest must include a providers array.");
  }

  const seen = new Set();
  const providers = rawManifest.providers.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("Every provider must be an object.");
    }

    if (!/^[a-z0-9][a-z0-9-]*$/.test(raw.id ?? "")) {
      throw new Error(`Invalid provider id: ${String(raw.id)}`);
    }

    if (seen.has(raw.id)) {
      throw new Error(`Duplicate provider id: ${raw.id}`);
    }
    seen.add(raw.id);

    if (!raw.serviceName || !raw.companyName || !raw.purpose?.label) {
      throw new Error(
        `Provider ${raw.id} must include serviceName, companyName, and purpose.label.`,
      );
    }

    const allowedOrigins = normalizeOriginList(
      raw.allowedOrigins,
      baseOrigin,
      "allowedOrigins",
    );
    const frameOrigins = normalizeOriginList(
      raw.allowedFrameOrigins ?? raw.allowedOrigins,
      baseOrigin,
      "allowedFrameOrigins",
    );
    const scriptOrigins = normalizeOriginList(
      raw.allowedScriptOrigins ?? raw.allowedOrigins,
      baseOrigin,
      "allowedScriptOrigins",
    );
    let privacyPolicyUrl;
    if (raw.privacyPolicyUrl) {
      const privacyUrl = new URL(raw.privacyPolicyUrl, baseOrigin);
      if (privacyUrl.protocol !== "https:") {
        throw new Error(`Provider ${raw.id} privacyPolicyUrl must use HTTPS.`);
      }
      privacyPolicyUrl = privacyUrl.href;
    }

    return Object.freeze({
      ...raw,
      privacyPolicyUrl,
      allowedOrigins: Object.freeze(allowedOrigins),
      allowedFrameOrigins: Object.freeze(frameOrigins),
      allowedScriptOrigins: Object.freeze(scriptOrigins),
      consentRequired: raw.consentRequired !== false,
    });
  });

  return Object.freeze({
    schemaVersion: rawManifest.schemaVersion ?? 1,
    consentVersion: String(rawManifest.consentVersion ?? "1"),
    manifestVersion: String(rawManifest.manifestVersion ?? "unknown"),
    providers: Object.freeze(providers),
  });
}

export function resolveProviderByUrl(urlValue, providers, kind = "frame") {
  let url;
  try {
    url = new URL(urlValue, globalThis.location?.href ?? "https://invalid.local/");
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.origin !== globalThis.location?.origin) {
    return null;
  }

  const originField = kind === "script" ? "allowedScriptOrigins" : "allowedFrameOrigins";
  return providers.find((provider) => provider[originField].includes(url.origin)) ?? null;
}

export function encodeConsentCookie(consentVersion, allowedProviderIds) {
  const unique = [...new Set(allowedProviderIds)].sort();
  return encodeURIComponent(
    JSON.stringify({
      v: String(consentVersion),
      a: unique,
    }),
  );
}

export function decodeConsentCookie(encodedValue, consentVersion, validProviderIds) {
  if (!encodedValue) return new Set();

  try {
    const parsed = JSON.parse(decodeURIComponent(encodedValue));
    if (String(parsed.v) !== String(consentVersion) || !Array.isArray(parsed.a)) {
      return new Set();
    }

    const validIds = new Set(validProviderIds);
    return new Set(
      parsed.a.filter((id) => typeof id === "string" && validIds.has(id)),
    );
  } catch {
    return new Set();
  }
}

function elementFromTarget(target) {
  const element =
    typeof target === "string" ? document.querySelector(target) : target;

  if (!(element instanceof Element)) {
    throw new Error(`Embed target was not found: ${String(target)}`);
  }

  return element;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function loadExternalScript(src, attributes = {}) {
  if (scriptLoads.has(src)) return scriptLoads.get(src);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.msiThirdPartySdk = "";

    for (const [key, value] of normalizeScriptAttributes(attributes)) {
      if (value !== undefined && value !== null) {
        script.setAttribute(key, String(value));
      }
    }

    script.addEventListener("load", () => resolve(script), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error(`Unable to load third-party script: ${src}`)),
      { once: true },
    );
    document.head.append(script);
  });

  scriptLoads.set(src, promise);
  promise.catch(() => scriptLoads.delete(src));
  return promise;
}

function registerDefaultSnippetPresets(control) {
  control.registerSnippetPreset("sideqik-promotions", {
    css: `
      .sideqik-promotion {
        min-height: 420px;
        background: #ffffff;
      }
    `,
    js: [
      ({ global }) => {
        global.sideqik =
          global.sideqik ||
          function sideqikQueue() {
            global.sideqik.q = global.sideqik.q || [];
            global.sideqik.q.push(arguments);
          };
      },
      {
        src: "https://d1hrk5gt3yn7pi.cloudfront.net/api/sideqik-api-1.4.js#62178a3cc9c3400046f5ca24",
        attributes: {
          id: "sideqik-sdk",
        },
      },
    ],
  });

  control.registerSnippetPreset("gleam-competitions", {
    css: `
      .giveaway__embed-placeholder {
        min-height: 420px;
        background: #ffffff;
      }
    `,
    js: [
      {
        src: "https://widget.gleamjs.io/e.js",
      },
    ],
  });

  control.registerSnippetPreset("instagram-embeds", {
    css: `
      .instagram-media-frame {
        display: block;
        width: 100%;
        max-width: 540px;
        height: 1120px;
        border: 0;
        margin: 0 auto !important;
      }
    `,
    mount({ prepared, provider }) {
      const source = prepared.querySelector(".instagram-media");
      if (!source) {
        throw new Error("Instagram embed requires .instagram-media HTML.");
      }

      const permalink = new URL(source.dataset.instgrmPermalink);
      const isInstagramPost =
        permalink.origin === "https://www.instagram.com" &&
        /^\/(p|reel)\/[^/]+\/?$/.test(permalink.pathname);
      if (!isInstagramPost) {
        throw new Error("Instagram permalink must be a public post or Reel URL.");
      }

      const iframe = document.createElement("iframe");
      iframe.className = "instagram-media-frame";
      iframe.src = `${permalink.origin}${permalink.pathname.replace(/\/$/, "")}/embed/captioned/`;
      iframe.title = control.translate("iframe.defaultTitle", {
        serviceName: provider.serviceName,
      });
      iframe.loading = "lazy";
      iframe.allowFullscreen = true;
      iframe.setAttribute("scrolling", "yes");
      source.replaceWith(iframe);

      const updateHeight = () => {
        const width = iframe.getBoundingClientRect().width || 540;
        const height = Math.round(Math.min(1200, Math.max(920, width + 660)));
        iframe.style.height = `${height}px`;
      };
      const resizeObserver =
        typeof ResizeObserver === "function"
          ? new ResizeObserver(updateHeight)
          : null;
      resizeObserver?.observe(iframe);
      window.addEventListener("resize", updateHeight);
      updateHeight();

      return {
        unmount() {
          resizeObserver?.disconnect();
          window.removeEventListener("resize", updateHeight);
        },
      };
    },
  });

  control.registerSnippetPreset("facebook-embeds", {
    css: `
      .fb-post {
        min-height: 420px;
        text-align: center;
      }
    `,
    async beforeLoad({ loadScript }) {
      const sdkLocale = META_SDK_LOCALES[control.locale] ?? "en_US";
      await loadScript(
        `https://connect.facebook.net/${sdkLocale}/sdk.js#xfbml=1&version=${META_GRAPH_API_VERSION}&autoLogAppEvents=0`,
        {
          id: "facebook-jssdk",
          crossorigin: "anonymous",
        },
      );
    },
    mount({ prepared }) {
      window.FB?.XFBML?.parse(prepared);
      return prepared;
    },
  });
}

export class MSIThirdPartyEmbedControl extends EventTarget {
  constructor(options = {}) {
    super();
    this.options = { ...DEFAULTS, ...options };
    if (!COOKIE_NAME_PATTERN.test(this.options.cookieName)) {
      throw new Error("cookieName contains invalid characters.");
    }
    this.options.cookieMaxAgeDays = normalizeCookieMaxAgeDays(
      this.options.cookieMaxAgeDays,
    );
    this.manifest = null;
    this.translations = null;
    this.locale = this.options.locale;
    this.providers = new Map();
    this.adapters = new Map();
    this.snippetPresets = new Map();
    this.instances = new Map();
    this.allowed = new Set();
    this.settingsDialog = null;
    this.instanceSequence = 0;
    this.initialization = null;
    registerDefaultSnippetPresets(this);
  }

  registerAdapter(id, adapter) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      throw new Error(`Invalid adapter id: ${id}`);
    }

    if (!adapter || typeof adapter.mount !== "function") {
      throw new Error(`Adapter ${id} must provide a mount() function.`);
    }

    this.adapters.set(id, adapter);
    return this;
  }

  registerSnippetPreset(providerId, preset) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(providerId)) {
      throw new Error(`Invalid provider id: ${providerId}`);
    }

    if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
      throw new Error(`Snippet preset for ${providerId} must be an object.`);
    }

    this.snippetPresets.set(providerId, { ...preset });
    return this;
  }

  async init() {
    if (this.initialization) return this.initialization;

    this.initialization = this._initialize();
    return this.initialization;
  }

  async _initialize() {
    const requestOptions = {
      cache: "no-cache",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    };
    const [response, translationsResponse] = await Promise.all([
      fetch(this.options.manifestUrl, requestOptions),
      fetch(this.options.translationsUrl, requestOptions),
    ]);

    if (!response.ok) {
      throw new Error(`Unable to load provider manifest (${response.status}).`);
    }
    if (!translationsResponse.ok) {
      throw new Error(`Unable to load translations (${translationsResponse.status}).`);
    }

    const [rawManifest, rawTranslations] = await Promise.all([
      response.json(),
      translationsResponse.json(),
    ]);
    this.manifest = normalizeManifest(rawManifest, location.origin);
    this.translations = normalizeTranslations(rawTranslations);
    const requestedLocale = String(this.options.locale || "auto");
    if (requestedLocale.toLowerCase() === "auto") {
      this.locale = detectLocaleFromHostname(location.hostname, this.translations);
    } else {
      const marketLocale = this.translations.markets[requestedLocale] ?? requestedLocale;
      const aliasedLocale = this.translations.aliases[marketLocale] ?? marketLocale;
      const baseLocale = aliasedLocale.split("-")[0];
      this.locale = this.translations.locales[aliasedLocale]
        ? aliasedLocale
        : this.translations.locales[baseLocale]
          ? baseLocale
          : this.translations.defaultLocale;
    }
    this.providers = new Map(
      this.manifest.providers.map((provider) => [provider.id, provider]),
    );
    this.allowed = this._readAllowedProviders();

    this.dispatchEvent(
      new CustomEvent("ready", {
        detail: { manifest: this.manifest },
      }),
    );

    return this;
  }

  _t(key, values = {}, fallback = key) {
    const selected = this.translations?.locales?.[this.locale] ?? {};
    const parent = selected.$extends
      ? this.translations?.locales?.[selected.$extends] ?? {}
      : {};
    const defaults =
      this.translations?.locales?.[this.translations?.defaultLocale] ?? {};
    const template = selected[key] ?? parent[key] ?? defaults[key] ?? fallback;
    return interpolateTranslation(String(template), values);
  }

  translate(key, values = {}, fallback = key) {
    return this._t(key, values, fallback);
  }

  _getProviderPurpose(provider) {
    return this._t(
      `providers.${provider.id}.purpose`,
      { serviceName: provider.serviceName },
      provider.purpose.label,
    );
  }

  async create(configuration) {
    await this.init();

    if (!configuration || typeof configuration !== "object") {
      throw new Error("Embed configuration must be an object.");
    }

    const type = configuration.type ?? "iframe";
    if (type !== "iframe" && type !== "custom" && type !== "snippet") {
      throw new Error(`Unsupported embed type: ${type}`);
    }

    const target = elementFromTarget(configuration.target);
    const provider = this._resolveProvider(configuration, type);
    const id = configuration.id ?? `msi-embed-${++this.instanceSequence}`;

    if (this.instances.has(id)) {
      throw new Error(`Duplicate embed instance id: ${id}`);
    }
    const existingInstance = [...this.instances.values()].find(
      (registered) => registered.target === target,
    );
    if (existingInstance) {
      throw new Error(
        `The target is already used by embed instance: ${existingInstance.id}`,
      );
    }

    const instance = {
      id,
      type,
      target,
      provider,
      configuration,
      status: "registered",
      generation: 0,
      abortController: null,
      prepared: null,
      mountResult: null,
    };

    target.classList.add("msi-third-party-host");
    target.dataset.providerId = provider.id;
    this.instances.set(id, instance);
    await this._syncInstance(instance);

    return Object.freeze({
      id,
      providerId: provider.id,
      refresh: () => {
        if (this.instances.get(id) !== instance) {
          throw new Error(`Embed instance has been destroyed: ${id}`);
        }
        return this._syncInstance(instance);
      },
      destroy: () => this.remove(id),
    });
  }

  _resolveProvider(configuration, type) {
    if (configuration.providerId) {
      const provider = this.providers.get(configuration.providerId);
      if (!provider) {
        throw new Error(`Provider is not in the approved manifest: ${configuration.providerId}`);
      }
      return provider;
    }

    if (type !== "iframe" || !configuration.url) {
      throw new Error("Custom and snippet embeds require an approved providerId.");
    }

    const provider = resolveProviderByUrl(
      configuration.url,
      this.manifest.providers,
      "frame",
    );

    if (!provider) {
      throw new Error(`The iframe URL is not in the approved manifest: ${configuration.url}`);
    }
    return provider;
  }

  hasConsent(providerId) {
    const provider = this.providers.get(providerId);
    return provider?.consentRequired === false || this.allowed.has(providerId);
  }

  getAllowedProviderIds() {
    return [...this.allowed].sort();
  }

  getConsentCookieSize() {
    if (!this.manifest) return 0;
    const value = encodeConsentCookie(
      this.manifest.consentVersion,
      this.getAllowedProviderIds(),
    );
    return utf8Size(`${this.options.cookieName}=${value}`);
  }

  async grant(providerId) {
    await this.init();
    const provider = this._requireProvider(providerId);

    if (provider.consentRequired !== false) {
      const wasAllowed = this.allowed.has(providerId);
      this.allowed.add(providerId);
      try {
        this._writeAllowedProviders();
      } catch (error) {
        if (!wasAllowed) this.allowed.delete(providerId);
        throw error;
      }
    }

    await this._syncProvider(providerId);
    this._emitConsentChange(providerId, "granted");
  }

  async revoke(providerId) {
    await this.init();
    this._requireProvider(providerId);
    const wasAllowed = this.allowed.delete(providerId);
    try {
      this._writeAllowedProviders();
    } catch (error) {
      if (wasAllowed) this.allowed.add(providerId);
      throw error;
    }

    const providerInstances = [...this.instances.values()].filter(
      (instance) => instance.provider.id === providerId,
    );
    const willReload = this._providerNeedsReload(providerId);

    if (willReload) {
      this._emitConsentChange(providerId, "revoked", true);
      location.reload();
      return;
    }

    await Promise.all(providerInstances.map((instance) => this._deactivate(instance)));
    providerInstances.forEach((instance) => this._renderPlaceholder(instance));

    this._emitConsentChange(providerId, "revoked", false);
  }

  async revokeAll() {
    await this.init();
    const ids = [...this.allowed];
    if (!ids.length) return;

    const willReload = ids.some((providerId) =>
      this._providerNeedsReload(providerId),
    );

    this.allowed.clear();
    try {
      this._writeAllowedProviders();
    } catch (error) {
      ids.forEach((providerId) => this.allowed.add(providerId));
      throw error;
    }
    ids.forEach((providerId) =>
      this._emitConsentChange(providerId, "revoked", willReload),
    );

    if (willReload) {
      location.reload();
      return;
    }

    const affected = [...this.instances.values()].filter((instance) =>
      ids.includes(instance.provider.id),
    );
    await Promise.all(affected.map((instance) => this._deactivate(instance)));
    affected.forEach((instance) => this._renderPlaceholder(instance));
  }

  _providerNeedsReload(providerId) {
    if (!this.options.reloadOnCustomRevoke) return false;

    return [...this.instances.values()].some(
      (instance) =>
        instance.provider.id === providerId &&
        instance.type !== "iframe" &&
        ["loading", "active", "error"].includes(instance.status),
    );
  }

  async remove(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    this.instances.delete(instanceId);
    await this._deactivate(instance);
    instance.target.replaceChildren();
    instance.target.classList.remove("msi-third-party-host");
    delete instance.target.dataset.providerId;
    instance.status = "destroyed";
  }

  async _syncProvider(providerId) {
    const jobs = [...this.instances.values()]
      .filter((instance) => instance.provider.id === providerId)
      .map((instance) => this._syncInstance(instance));
    await Promise.all(jobs);
  }

  async _syncInstance(instance) {
    if (this.hasConsent(instance.provider.id)) {
      await this._activate(instance);
    } else {
      await this._deactivate(instance);
      this._renderPlaceholder(instance);
    }
  }

  async _activate(instance) {
    if (instance.status === "active" || instance.status === "loading") return;

    instance.status = "loading";
    instance.generation += 1;
    const generation = instance.generation;
    instance.abortController = new AbortController();

    this._renderLoading(instance);

    try {
      if (instance.type === "iframe") {
        await this._mountIframe(instance);
      } else {
        await this._mountCustom(instance);
      }

      if (
        generation !== instance.generation ||
        !this.hasConsent(instance.provider.id)
      ) {
        await this._cleanupMountResult(instance, false);
        return;
      }

      instance.status = "active";
      instance.target.querySelector(".msi-third-party-loading")?.remove();
      this._appendPrivacyFooter(instance);
    } catch (error) {
      if (error?.name === "AbortError") return;
      instance.status = "error";
      this._renderError(instance);
      this._emitError(error, instance);
    }
  }

  async _mountIframe(instance) {
    const { configuration, provider } = instance;
    if (!configuration.url) throw new Error("Iframe embeds require a url.");

    const resolvedProvider = resolveProviderByUrl(
      configuration.url,
      [provider],
      "frame",
    );
    if (!resolvedProvider) {
      throw new Error(`Iframe origin is not approved for ${provider.serviceName}.`);
    }

    const iframe = document.createElement("iframe");
    iframe.className = "msi-third-party-frame";
    iframe.title =
      configuration.title ??
      this._t("iframe.defaultTitle", { serviceName: provider.serviceName });
    iframe.loading = configuration.loading ?? "lazy";
    iframe.referrerPolicy = configuration.referrerPolicy ?? "no-referrer";
    iframe.allow = configuration.allow ?? "";
    iframe.allowFullscreen = configuration.allowFullscreen !== false;
    iframe.src = new URL(configuration.url, location.href).href;

    const content = this._getContentContainer(instance);
    content.replaceChildren(iframe);
    instance.mountResult = iframe;
  }

  async _mountCustom(instance) {
    const { configuration, provider } = instance;
    const adapter =
      instance.type === "snippet"
        ? this._createSnippetAdapter(configuration)
        : this.adapters.get(configuration.adapter);
    if (!adapter) {
      throw new Error(`Custom adapter is not registered: ${configuration.adapter}`);
    }
    if (
      Array.isArray(adapter.providerIds) &&
      !adapter.providerIds.includes(provider.id)
    ) {
      throw new Error(
        `Adapter ${configuration.adapter} is not approved for ${provider.serviceName}.`,
      );
    }

    const signal = instance.abortController.signal;
    const context = {
      container: this._getContentContainer(instance),
      options: configuration.options ?? {},
      provider,
      signal,
      isAllowed: () => this.hasConsent(provider.id),
      loadScript: async (src, attributes) => {
        const url = new URL(src, location.href);
        if (!provider.allowedScriptOrigins.includes(url.origin)) {
          throw new Error(`Script origin is not approved for ${provider.serviceName}: ${url.origin}`);
        }
        if (!this.hasConsent(provider.id)) {
          throw new DOMException("Consent was withdrawn.", "AbortError");
        }
        return loadExternalScript(url.href, attributes);
      },
    };

    instance.prepared =
      typeof adapter.prepare === "function"
        ? await adapter.prepare(context)
        : undefined;

    if (signal.aborted || !this.hasConsent(provider.id)) {
      throw new DOMException("Consent was withdrawn.", "AbortError");
    }

    const loaded =
      typeof adapter.load === "function"
        ? await adapter.load({ ...context, prepared: instance.prepared })
        : undefined;

    if (signal.aborted || !this.hasConsent(provider.id)) {
      throw new DOMException("Consent was withdrawn.", "AbortError");
    }

    instance.mountResult = await adapter.mount({
      ...context,
      prepared: instance.prepared,
      loaded,
    });
  }

  _createSnippetAdapter(configuration) {
    const preset = this.snippetPresets.get(configuration.providerId) ?? {};
    configuration = { ...preset, ...configuration };

    if (typeof configuration.html !== "string" || !configuration.html.trim()) {
      throw new Error("Snippet embeds require a non-empty html string.");
    }

    if (
      configuration.mount !== undefined &&
      typeof configuration.mount !== "function"
    ) {
      throw new Error("Snippet mount must be a function.");
    }

    if (
      configuration.unmount !== undefined &&
      typeof configuration.unmount !== "function"
    ) {
      throw new Error("Snippet unmount must be a function.");
    }

    if (
      configuration.beforeLoad !== undefined &&
      typeof configuration.beforeLoad !== "function"
    ) {
      throw new Error("Snippet beforeLoad must be a function.");
    }

    const scripts = configuration.scripts ?? [];
    if (!Array.isArray(scripts)) {
      throw new Error("Snippet scripts must be an array.");
    }

    if (
      configuration.css !== undefined &&
      typeof configuration.css !== "string"
    ) {
      throw new Error("Snippet css must be a string.");
    }

    const javascript =
      configuration.js === undefined
        ? []
        : Array.isArray(configuration.js)
          ? configuration.js
          : [configuration.js];

    return {
      providerIds: [configuration.providerId],

      prepare: ({ container, provider, options }) => {
        const html = configuration.html.replace(
          /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g,
          (_, key) => {
            const value = options[key];
            return value === undefined || value === null
              ? ""
              : String(value)
                  .replaceAll("&", "&amp;")
                  .replaceAll('"', "&quot;")
                  .replaceAll("'", "&#39;")
                  .replaceAll("<", "&lt;")
                  .replaceAll(">", "&gt;");
          },
        );

        const template = document.createElement("template");
        template.innerHTML = html.trim();

        const forbidden = template.content.querySelector(
          "script, iframe, object, embed, link, base, meta",
        );
        if (forbidden) {
          throw new Error(
            `Snippet html cannot contain <${forbidden.localName}>. Put external scripts in js, or use the iframe embed type instead.`,
          );
        }

        const allowedResourceOrigins = new Set([
          location.origin,
          ...provider.allowedOrigins,
        ]);

        const css = configuration.css?.trim();
        if (css) {
          if (/@import\b/i.test(css)) {
            throw new Error(
              "CSS @import is not allowed. Paste the stylesheet content into css instead.",
            );
          }

          for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
            const value = match[2]?.trim();
            if (!value) continue;
            const resource = new URL(value, location.href);
            if (
              !["data:", "blob:"].includes(resource.protocol) &&
              !allowedResourceOrigins.has(resource.origin)
            ) {
              throw new Error(
                `CSS resource origin is not approved for ${provider.serviceName}: ${resource.origin}`,
              );
            }
          }

          const style = document.createElement("style");
          style.dataset.msiSnippetStyle = provider.id;
          style.textContent = css;
          container.append(style);
        }

        for (const element of template.content.querySelectorAll("*")) {
          for (const attribute of [...element.attributes]) {
            const name = attribute.name.toLowerCase();
            if (name.startsWith("on")) {
              throw new Error(`Inline event attribute is not allowed: ${name}`);
            }
            if (name === "srcset") {
              throw new Error("srcset is not allowed in snippet html.");
            }
            if (name === "style" && /url\s*\(/i.test(attribute.value)) {
              throw new Error("CSS url() is not allowed in snippet html.");
            }
          }

          for (const attributeName of [
            "action",
            "cite",
            "formaction",
            "href",
            "poster",
            "src",
            "xlink:href",
          ]) {
            const value = element.getAttribute(attributeName);
            if (!value) continue;
            const resource = new URL(value, location.href);
            const isEmbeddedResource = ["poster", "src"].includes(attributeName);
            if (
              !(isEmbeddedResource && ["data:", "blob:"].includes(resource.protocol)) &&
              !allowedResourceOrigins.has(resource.origin)
            ) {
              throw new Error(
                `Snippet resource origin is not approved for ${provider.serviceName}: ${resource.origin}`,
              );
            }
          }

          if (
            (element.localName === "a" || element.localName === "area") &&
            element.getAttribute("target")?.toLowerCase() === "_blank"
          ) {
            const rel = new Set(
              (element.getAttribute("rel") ?? "")
                .split(/\s+/)
                .filter(Boolean)
                .map((value) => value.toLowerCase()),
            );
            rel.add("noopener");
            rel.add("noreferrer");
            element.setAttribute("rel", [...rel].join(" "));
          }
        }

        container.append(template.content.cloneNode(true));
        return container;
      },

      load: async (context) => {
        if (typeof configuration.beforeLoad === "function") {
          await configuration.beforeLoad(context);
        }

        if (context.signal.aborted || !context.isAllowed()) {
          throw new DOMException("Consent was withdrawn.", "AbortError");
        }

        const loadedScripts = [];
        for (const entry of scripts) {
          const descriptor = typeof entry === "string" ? { src: entry } : entry;
          if (!descriptor?.src) {
            throw new Error("Every snippet script requires a src.");
          }
          loadedScripts.push(
            await context.loadScript(descriptor.src, descriptor.attributes),
          );
        }

        for (const entry of javascript) {
          if (typeof entry === "function") {
            await entry({
              ...context,
              root: context.prepared,
              global: window,
            });
            continue;
          }

          const descriptor = typeof entry === "string" ? { src: entry } : entry;
          if (!descriptor?.src) {
            throw new Error(
              "Every js entry must be a function, script URL, or { src, attributes } object.",
            );
          }
          loadedScripts.push(
            await context.loadScript(descriptor.src, descriptor.attributes),
          );
        }
        return loadedScripts;
      },

      mount: (context) =>
        typeof configuration.mount === "function"
          ? configuration.mount(context)
          : context.prepared,

      unmount: configuration.unmount,
    };
  }

  _getContentContainer(instance) {
    return instance.target.querySelector("[data-msi-embed-content]");
  }

  async _deactivate(instance) {
    instance.generation += 1;
    instance.abortController?.abort();
    await this._cleanupMountResult(instance);
    instance.abortController = null;
    instance.status = "blocked";
  }

  async _cleanupMountResult(instance, clearTarget = true) {
    const mountResult = instance.mountResult;
    const prepared = instance.prepared;
    instance.mountResult = null;
    instance.prepared = null;

    if (instance.type === "custom" || instance.type === "snippet") {
      const adapter =
        instance.type === "snippet"
          ? this._createSnippetAdapter(instance.configuration)
          : this.adapters.get(instance.configuration.adapter);
      try {
        if (typeof mountResult === "function") {
          await mountResult();
        } else if (typeof mountResult?.unmount === "function") {
          await mountResult.unmount();
        } else if (
          typeof adapter?.unmount === "function" &&
          (mountResult || prepared)
        ) {
          await adapter.unmount({
            mountResult,
            prepared,
            provider: instance.provider,
            options: instance.configuration.options ?? {},
          });
        }
      } catch (error) {
        this._emitError(error, instance);
      }
    }

    if (clearTarget) instance.target.replaceChildren();
  }

  _createShell(instance) {
    const shell = makeElement("section", "msi-third-party-embed");
    shell.dataset.instanceId = instance.id;
    shell.dataset.state = instance.status;
    shell.lang = this.locale;
    shell.dir = isRtlLocale(this.locale) ? "rtl" : "ltr";
    shell.setAttribute(
      "aria-label",
      this._t("embed.ariaLabel", { serviceName: instance.provider.serviceName }),
    );

    const content = makeElement("div", "msi-third-party-embed__content");
    content.dataset.msiEmbedContent = "";
    shell.append(content);
    instance.target.replaceChildren(shell);
    return { shell, content };
  }

  _renderLoading(instance) {
    const { content } = this._createShell(instance);
    const loading = makeElement("div", "msi-third-party-loading");
    loading.setAttribute("role", "status");
    loading.setAttribute("aria-live", "polite");
    loading.append(
      makeElement("span", "msi-third-party-loading__dot"),
      makeElement(
        "span",
        "",
        this._t("embed.loading", { serviceName: instance.provider.serviceName }),
      ),
    );
    content.append(loading);
  }

  _renderPlaceholder(instance) {
    const { provider } = instance;
    instance.status = "blocked";
    const { shell, content } = this._createShell(instance);
    shell.dataset.state = "blocked";

    const panel = makeElement("div", "msi-third-party-placeholder");
    const eyebrow = makeElement(
      "p",
      "msi-third-party-placeholder__eyebrow",
      this._t("placeholder.eyebrow"),
    );
    const title = makeElement(
      "h3",
      "msi-third-party-placeholder__title",
      this._t("placeholder.title"),
    );
    const description = makeElement(
      "p",
      "msi-third-party-placeholder__description",
      this._t("placeholder.description", {
        serviceName: provider.serviceName,
        companyName: provider.companyName,
      }),
    );
    const purpose = makeElement(
      "p",
      "msi-third-party-placeholder__purpose",
      this._t("placeholder.purpose", {
        purpose: this._getProviderPurpose(provider),
      }),
    );
    const actions = makeElement("div", "msi-third-party-placeholder__actions");
    const accept = makeElement(
      "button",
      "msi-button msi-button--primary",
      this._t("placeholder.accept", { serviceName: provider.serviceName }),
    );
    accept.type = "button";
    accept.addEventListener("click", async () => {
      accept.disabled = true;
      try {
        await this.grant(provider.id);
      } catch (error) {
        accept.disabled = false;
        this._emitError(error, instance);
      }
    });

    actions.append(accept);

    if (provider.privacyPolicyUrl) {
      const privacy = makeElement(
        "a",
        "msi-third-party-placeholder__privacy-link",
        this._t("placeholder.privacy", { serviceName: provider.serviceName }),
      );
      privacy.href = provider.privacyPolicyUrl;
      privacy.target = "_blank";
      privacy.rel = "noopener noreferrer";
      actions.append(privacy);
    }

    panel.append(
      eyebrow,
      title,
      description,
      purpose,
      actions,
    );
    content.append(panel);
  }

  _appendPrivacyFooter(instance) {
    const shell = instance.target.querySelector(".msi-third-party-embed");
    if (!shell) return;
    shell.dataset.state = "active";

    const footer = makeElement("div", "msi-third-party-embed__privacy");
    footer.append(
      makeElement(
        "span",
        "",
        this._t("footer.provider", { serviceName: instance.provider.serviceName }),
      ),
    );

    if (instance.provider.privacyPolicyUrl) {
      const privacy = makeElement("a", "", this._t("common.privacyPolicy"));
      privacy.href = instance.provider.privacyPolicyUrl;
      privacy.target = "_blank";
      privacy.rel = "noopener noreferrer";
      footer.append(privacy);
    }

    const revokeActionLabel =
      instance.type === "iframe"
        ? this._t("footer.revokeIframeAria", {
            serviceName: instance.provider.serviceName,
          })
        : this._t("footer.revokeReloadAria");
    const revoke = makeElement("button", "", this._t("footer.revoke"));
    revoke.type = "button";
    revoke.title = revokeActionLabel;
    revoke.setAttribute("aria-label", revokeActionLabel);
    revoke.addEventListener("click", async () => {
      revoke.disabled = true;
      try {
        await this.revoke(instance.provider.id);
      } catch (error) {
        revoke.disabled = false;
        this._emitError(error, instance);
      }
    });
    footer.append(revoke);
    shell.append(footer);
  }

  _renderError(instance) {
    const { content } = this._createShell(instance);
    const panel = makeElement("div", "msi-third-party-error");
    panel.setAttribute("role", "alert");
    panel.append(
      makeElement(
        "strong",
        "",
        this._t("error.title", { serviceName: instance.provider.serviceName }),
      ),
      makeElement(
        "span",
        "",
        this._t("error.description"),
      ),
    );
    content.append(panel);
    this._appendPrivacyFooter(instance);
  }

  openSettings() {
    if (!this.manifest) {
      return this.init().then(() => this.openSettings());
    }

    if (!this.settingsDialog) {
      this.settingsDialog = document.createElement("dialog");
      this.settingsDialog.className = "msi-third-party-settings";
      this.settingsDialog.lang = this.locale;
      this.settingsDialog.dir = isRtlLocale(this.locale) ? "rtl" : "ltr";
      document.body.append(this.settingsDialog);
      this.settingsDialog.addEventListener("close", () => {
        document.body.classList.remove("msi-third-party-settings-open");
      });
    }

    this._renderSettings();
    document.body.classList.add("msi-third-party-settings-open");
    if (!this.settingsDialog.open) this.settingsDialog.showModal();
  }

  _renderSettings() {
    const dialog = this.settingsDialog;
    dialog.replaceChildren();

    const header = makeElement("header", "msi-third-party-settings__header");
    const heading = makeElement("div", "");
    heading.append(
      makeElement(
        "p",
        "msi-third-party-settings__eyebrow",
        this._t("settings.eyebrow"),
      ),
      makeElement("h2", "", this._t("settings.title")),
    );
    const title = heading.querySelector("h2");
    title.id = "msi-third-party-settings-title";
    dialog.setAttribute("aria-labelledby", title.id);
    const close = makeElement(
      "button",
      "msi-third-party-settings__close",
      this._t("settings.close"),
    );
    close.type = "button";
    close.addEventListener("click", () => dialog.close());
    header.append(heading, close);

    const intro = makeElement(
      "p",
      "msi-third-party-settings__intro",
      this._t("settings.intro"),
    );

    const list = makeElement("div", "msi-third-party-settings__list");
    for (const provider of this.manifest.providers) {
      if (provider.consentRequired === false) continue;

      const row = makeElement("article", "msi-third-party-settings__provider");
      const copy = makeElement("div", "");
      copy.append(
        makeElement("h3", "", provider.serviceName),
        makeElement(
          "p",
          "",
          this._t(`providers.${provider.id}.purpose`, {}, provider.purpose.label),
        ),
      );

      if (provider.privacyPolicyUrl) {
        const link = makeElement("a", "", this._t("common.privacyPolicy"));
        link.href = provider.privacyPolicyUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        copy.append(link);
      }

      const allowed = this.hasConsent(provider.id);
      const willReload = this._providerNeedsReload(provider.id);
      const toggle = makeElement(
        "button",
        `msi-consent-toggle ${allowed ? "is-allowed" : ""}`,
        allowed
          ? willReload
            ? this._t("settings.allowedReload")
            : this._t("settings.allowedDisable")
          : this._t("settings.notAllowed"),
      );
      toggle.type = "button";
      toggle.setAttribute("aria-pressed", String(allowed));
      toggle.setAttribute(
        "aria-label",
        `${provider.serviceName}: ${toggle.textContent}`,
      );
      toggle.addEventListener("click", async () => {
        toggle.disabled = true;
        try {
          if (allowed) await this.revoke(provider.id);
          else await this.grant(provider.id);
          this._renderSettings();
        } catch (error) {
          toggle.disabled = false;
          this._emitError(error);
        }
      });

      row.append(copy, toggle);
      list.append(row);
    }

    dialog.append(header, intro, list);
  }

  _requireProvider(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);
    return provider;
  }

  _readAllowedProviders() {
    const prefix = `${this.options.cookieName}=`;
    const cookie = document.cookie
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(prefix));

    return decodeConsentCookie(
      cookie?.slice(prefix.length),
      this.manifest.consentVersion,
      this.providers.keys(),
    );
  }

  _writeAllowedProviders() {
    const secure =
      this.options.cookieSecure === true ||
      (this.options.cookieSecure === "auto" && location.protocol === "https:");
    const cookieAttributes = [
      "Path=/",
      "SameSite=Lax",
      secure ? "Secure" : "",
    ].filter(Boolean);

    if (!this.allowed.size) {
      document.cookie = [
        `${this.options.cookieName}=`,
        "Max-Age=0",
        ...cookieAttributes,
      ].join("; ");
      return;
    }

    const value = encodeConsentCookie(
      this.manifest.consentVersion,
      this.getAllowedProviderIds(),
    );
    const size = utf8Size(`${this.options.cookieName}=${value}`);
    if (size > 3500) {
      throw new Error(`Consent cookie is too large (${size} bytes).`);
    }

    const maxAge = Math.round(this.options.cookieMaxAgeDays * 86400);

    document.cookie = [
      `${this.options.cookieName}=${value}`,
      `Max-Age=${maxAge}`,
      ...cookieAttributes,
    ].join("; ");
  }

  _emitConsentChange(providerId, action, willReload = false) {
    const detail = {
      providerId,
      action,
      willReload,
      allowedProviderIds: this.getAllowedProviderIds(),
      consentVersion: this.manifest.consentVersion,
      manifestVersion: this.manifest.manifestVersion,
      occurredAt: new Date().toISOString(),
    };

    this.dispatchEvent(new CustomEvent("consentchange", { detail }));
    document.dispatchEvent(
      new CustomEvent("msi:third-party-consent-change", { detail }),
    );

    if (typeof this.options.onConsentChange === "function") {
      try {
        this.options.onConsentChange(detail);
      } catch (error) {
        this._emitError(error);
      }
    }
  }

  _emitError(error, instance) {
    const detail = { error, instanceId: instance?.id, providerId: instance?.provider.id };
    this.dispatchEvent(new CustomEvent("error", { detail }));
  }
}

export default MSIThirdPartyEmbedControl;
