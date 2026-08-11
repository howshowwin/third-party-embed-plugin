const DEFAULTS = Object.freeze({
  manifestUrl: "/third-party-providers.json",
  cookieName: "msi_thirdPartyCookieControl",
  cookieMaxAgeDays: 180,
  cookieSecure: "auto",
  locale: "zh-TW",
});

const scriptLoads = new Map();

function utf8Size(value) {
  return new TextEncoder().encode(value).length;
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

    return Object.freeze({
      ...raw,
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

    for (const [key, value] of Object.entries(attributes)) {
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

export class MSIThirdPartyEmbedControl extends EventTarget {
  constructor(options = {}) {
    super();
    this.options = { ...DEFAULTS, ...options };
    this.manifest = null;
    this.providers = new Map();
    this.adapters = new Map();
    this.instances = new Map();
    this.allowed = new Set();
    this.settingsDialog = null;
    this.instanceSequence = 0;
    this.initialization = null;
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

  async init() {
    if (this.initialization) return this.initialization;

    this.initialization = this._initialize();
    return this.initialization;
  }

  async _initialize() {
    const response = await fetch(this.options.manifestUrl, {
      cache: "no-cache",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Unable to load provider manifest (${response.status}).`);
    }

    this.manifest = normalizeManifest(await response.json(), location.origin);
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
      refresh: () => this._syncInstance(instance),
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
      this.allowed.add(providerId);
      this._writeAllowedProviders();
    }

    await this._syncProvider(providerId);
    this._emitConsentChange(providerId, "granted");
  }

  async revoke(providerId) {
    await this.init();
    this._requireProvider(providerId);
    this.allowed.delete(providerId);
    this._writeAllowedProviders();

    const providerInstances = [...this.instances.values()].filter(
      (instance) => instance.provider.id === providerId,
    );
    await Promise.all(providerInstances.map((instance) => this._deactivate(instance)));
    providerInstances.forEach((instance) => this._renderPlaceholder(instance));

    this._emitConsentChange(providerId, "revoked");
  }

  async revokeAll() {
    await this.init();
    const ids = [...this.allowed];
    for (const providerId of ids) {
      await this.revoke(providerId);
    }
  }

  async remove(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    await this._deactivate(instance);
    instance.target.replaceChildren();
    instance.target.classList.remove("msi-third-party-host");
    delete instance.target.dataset.providerId;
    this.instances.delete(instanceId);
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
      this._appendPrivacyFooter(instance);
    } catch (error) {
      if (error?.name === "AbortError") return;
      instance.status = "error";
      this._renderError(instance, error);
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
    iframe.title = configuration.title ?? `${provider.serviceName} 外部內容`;
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

    const scripts = configuration.scripts ?? [];
    if (!Array.isArray(scripts)) {
      throw new Error("Snippet scripts must be an array.");
    }

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
            `Snippet html cannot contain <${forbidden.localName}>. Use scripts[] or the iframe embed type instead.`,
          );
        }

        const allowedResourceOrigins = new Set([
          location.origin,
          ...provider.allowedOrigins,
        ]);

        for (const element of template.content.querySelectorAll("*")) {
          for (const attribute of [...element.attributes]) {
            const name = attribute.name.toLowerCase();
            if (name.startsWith("on")) {
              throw new Error(`Inline event attribute is not allowed: ${name}`);
            }
            if (name === "style" && /url\s*\(/i.test(attribute.value)) {
              throw new Error("CSS url() is not allowed in snippet html.");
            }
          }

          for (const attributeName of ["src", "poster"]) {
            const value = element.getAttribute(attributeName);
            if (!value) continue;
            const resource = new URL(value, location.href);
            if (
              !["data:", "blob:"].includes(resource.protocol) &&
              !allowedResourceOrigins.has(resource.origin)
            ) {
              throw new Error(
                `Snippet resource origin is not approved for ${provider.serviceName}: ${resource.origin}`,
              );
            }
          }
        }

        container.append(template.content.cloneNode(true));
        return container;
      },

      load: async (context) => {
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
    shell.setAttribute("aria-label", `${instance.provider.serviceName} 第三方內容`);

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
      makeElement("span", "", `正在安全載入 ${instance.provider.serviceName}…`),
    );
    content.append(loading);
  }

  _renderPlaceholder(instance) {
    const { provider } = instance;
    instance.status = "blocked";
    const { shell, content } = this._createShell(instance);
    shell.dataset.state = "blocked";

    const panel = makeElement("div", "msi-third-party-placeholder");
    const eyebrow = makeElement("p", "msi-third-party-placeholder__eyebrow", "PRIVACY CONTROL");
    const title = makeElement("h3", "msi-third-party-placeholder__title", "第三方內容目前已停用");
    const description = makeElement("p", "msi-third-party-placeholder__description");
    description.append(
      "此內容由 ",
      makeElement("strong", "", `${provider.serviceName}（${provider.companyName}）`),
      " 提供。若您選擇載入，您的瀏覽器將與該服務建立連線；該服務可能接收您的 IP 位址、裝置及瀏覽器資訊，並可能在您的裝置上儲存或讀取 Cookie。",
    );

    const scope = makeElement(
      "p",
      "msi-third-party-placeholder__scope",
      `此選擇將套用於本網站所有由 ${provider.serviceName} 提供的嵌入內容，您可以隨時撤回。`,
    );

    const actions = makeElement("div", "msi-third-party-placeholder__actions");
    const accept = makeElement(
      "button",
      "msi-button msi-button--primary",
      `同意並載入 ${provider.serviceName}`,
    );
    accept.type = "button";
    accept.addEventListener("click", () => this.grant(provider.id));

    const keepDisabled = makeElement(
      "button",
      "msi-button msi-button--secondary",
      "維持停用",
    );
    keepDisabled.type = "button";
    keepDisabled.addEventListener("click", () => {
      panel.classList.add("is-declined");
      scope.textContent = `${provider.serviceName} 內容維持停用。您仍可稍後選擇載入。`;
      keepDisabled.disabled = true;
    });

    actions.append(accept, keepDisabled);

    if (provider.privacyPolicyUrl) {
      const privacy = makeElement(
        "a",
        "msi-third-party-placeholder__privacy-link",
        `查看 ${provider.serviceName} 隱私權政策`,
      );
      privacy.href = provider.privacyPolicyUrl;
      privacy.target = "_blank";
      privacy.rel = "noopener noreferrer";
      actions.append(privacy);
    }

    panel.append(eyebrow, title, description, scope, actions);
    content.append(panel);
  }

  _appendPrivacyFooter(instance) {
    const shell = instance.target.querySelector(".msi-third-party-embed");
    if (!shell) return;
    shell.dataset.state = "active";

    const footer = makeElement("div", "msi-third-party-embed__privacy");
    footer.append(
      makeElement("span", "", `內容由 ${instance.provider.serviceName} 提供`),
    );

    if (instance.provider.privacyPolicyUrl) {
      const privacy = makeElement("a", "", "隱私權政策");
      privacy.href = instance.provider.privacyPolicyUrl;
      privacy.target = "_blank";
      privacy.rel = "noopener noreferrer";
      footer.append(privacy);
    }

    const revoke = makeElement(
      "button",
      "",
      `撤回同意並停用 ${instance.provider.serviceName}`,
    );
    revoke.type = "button";
    revoke.addEventListener("click", () => this.revoke(instance.provider.id));
    footer.append(revoke);
    shell.append(footer);
  }

  _renderError(instance, error) {
    const { content } = this._createShell(instance);
    const panel = makeElement("div", "msi-third-party-error");
    panel.setAttribute("role", "alert");
    panel.append(
      makeElement("strong", "", `${instance.provider.serviceName} 無法載入`),
      makeElement(
        "span",
        "",
        error instanceof Error ? error.message : "發生未知錯誤。",
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
      document.body.append(this.settingsDialog);
      this.settingsDialog.addEventListener("close", () => {
        document.body.classList.remove("msi-third-party-settings-open");
      });
    }

    this._renderSettings();
    document.body.classList.add("msi-third-party-settings-open");
    this.settingsDialog.showModal();
  }

  _renderSettings() {
    const dialog = this.settingsDialog;
    dialog.replaceChildren();

    const header = makeElement("header", "msi-third-party-settings__header");
    const heading = makeElement("div", "");
    heading.append(
      makeElement("p", "msi-third-party-settings__eyebrow", "PRIVACY SETTINGS"),
      makeElement("h2", "", "第三方內容設定"),
    );
    const close = makeElement("button", "msi-third-party-settings__close", "關閉");
    close.type = "button";
    close.addEventListener("click", () => dialog.close());
    header.append(heading, close);

    const intro = makeElement(
      "p",
      "msi-third-party-settings__intro",
      "您可以分別允許或停用各項第三方服務。停用後，頁面上的相關內容會立即卸載。",
    );

    const list = makeElement("div", "msi-third-party-settings__list");
    for (const provider of this.manifest.providers) {
      if (provider.consentRequired === false) continue;

      const row = makeElement("article", "msi-third-party-settings__provider");
      const copy = makeElement("div", "");
      copy.append(
        makeElement("h3", "", provider.serviceName),
        makeElement("p", "", provider.purpose.label),
      );

      if (provider.privacyPolicyUrl) {
        const link = makeElement("a", "", "隱私權政策");
        link.href = provider.privacyPolicyUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        copy.append(link);
      }

      const allowed = this.hasConsent(provider.id);
      const toggle = makeElement(
        "button",
        `msi-consent-toggle ${allowed ? "is-allowed" : ""}`,
        allowed ? "已允許，點此停用" : "未允許，點此啟用",
      );
      toggle.type = "button";
      toggle.setAttribute("aria-pressed", String(allowed));
      toggle.addEventListener("click", async () => {
        toggle.disabled = true;
        if (allowed) await this.revoke(provider.id);
        else await this.grant(provider.id);
        this._renderSettings();
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
      .split("; ")
      .find((entry) => entry.startsWith(prefix));

    return decodeConsentCookie(
      cookie?.slice(prefix.length),
      this.manifest.consentVersion,
      this.providers.keys(),
    );
  }

  _writeAllowedProviders() {
    const value = encodeConsentCookie(
      this.manifest.consentVersion,
      this.getAllowedProviderIds(),
    );
    const size = utf8Size(`${this.options.cookieName}=${value}`);
    if (size > 3500) {
      throw new Error(`Consent cookie is too large (${size} bytes).`);
    }

    const maxAge = Math.max(1, Number(this.options.cookieMaxAgeDays)) * 86400;
    const secure =
      this.options.cookieSecure === true ||
      (this.options.cookieSecure === "auto" && location.protocol === "https:");

    document.cookie = [
      `${this.options.cookieName}=${value}`,
      `Max-Age=${maxAge}`,
      "Path=/",
      "SameSite=Lax",
      secure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");
  }

  _emitConsentChange(providerId, action) {
    const detail = {
      providerId,
      action,
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
      this.options.onConsentChange(detail);
    }
  }

  _emitError(error, instance) {
    const detail = { error, instanceId: instance?.id, providerId: instance?.provider.id };
    this.dispatchEvent(new CustomEvent("error", { detail }));
  }
}

export default MSIThirdPartyEmbedControl;
