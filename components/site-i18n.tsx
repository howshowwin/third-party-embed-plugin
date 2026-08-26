"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  SITE_DEFAULT_LOCALE,
  SITE_ENGLISH_TEXT,
  SITE_LOCALE_STORAGE_KEY,
  SITE_PAGE_TITLES,
  type SiteLocale,
} from "../lib/site-i18n";

type I18nContextValue = {
  locale: SiteLocale;
  setLocale: (locale: SiteLocale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "PRE", "CODE", "TEXTAREA"]);

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function translatedText(original: string, locale: SiteLocale) {
  if (locale === "zh-TW") return original;
  const normalized = normalizeText(original);
  const translation = SITE_ENGLISH_TEXT[normalized];
  if (!translation) return original;
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translation}${trailing}`;
}

function shouldSkip(node: Node) {
  const parent = node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement;
  if (!parent) return true;
  if (SKIPPED_TAGS.has(parent.tagName)) return true;
  return Boolean(parent.closest(
    "[data-site-i18n-ignore], [data-feed-i18n], [data-feed-i18n-aria-label], [data-feed-i18n-placeholder]",
  ));
}

export function SiteI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SiteLocale>(SITE_DEFAULT_LOCALE);
  const localeRef = useRef<SiteLocale>(SITE_DEFAULT_LOCALE);
  const originalText = useRef(new WeakMap<Text, string>());
  const renderedText = useRef(new WeakMap<Text, string>());
  const originalAttributes = useRef(new WeakMap<Element, Map<string, string>>());

  const applyTextNode = useCallback((node: Text, activeLocale: SiteLocale) => {
    if (shouldSkip(node)) return;
    if (!originalText.current.has(node)) originalText.current.set(node, node.data);
    const next = translatedText(originalText.current.get(node) ?? node.data, activeLocale);
    if (node.data !== next) node.data = next;
    renderedText.current.set(node, next);
  }, []);

  const applyElement = useCallback((element: Element, activeLocale: SiteLocale) => {
    if (shouldSkip(element)) return;
    const attributes = ["aria-label", "placeholder", "title"];
    let originals = originalAttributes.current.get(element);
    if (!originals) {
      originals = new Map();
      originalAttributes.current.set(element, originals);
    }
    for (const attribute of attributes) {
      const current = element.getAttribute(attribute);
      if (current !== null && !originals.has(attribute)) originals.set(attribute, current);
      const original = originals.get(attribute);
      if (original !== undefined) element.setAttribute(attribute, translatedText(original, activeLocale));
    }
  }, []);

  const applySubtree = useCallback((root: Node, activeLocale: SiteLocale) => {
    if (root.nodeType === Node.TEXT_NODE) {
      applyTextNode(root as Text, activeLocale);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    applyElement(root as Element, activeLocale);
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    );
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) applyTextNode(node as Text, activeLocale);
      else applyElement(node as Element, activeLocale);
      node = walker.nextNode();
    }
  }, [applyElement, applyTextNode]);

  useEffect(() => {
    const initial = document.documentElement.dataset.siteLocale === "en" ? "en" : "zh-TW";
    const timer = window.setTimeout(() => {
      localeRef.current = initial;
      setLocaleState(initial);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    localeRef.current = locale;
    document.documentElement.dataset.siteLocale = locale;
    document.documentElement.lang = locale === "en" ? "en" : "zh-Hant";
    const title = SITE_PAGE_TITLES[window.location.pathname]?.[locale];
    if (title) document.title = title;
    applySubtree(document.body, locale);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const node = mutation.target as Text;
          if (node.data !== renderedText.current.get(node)) {
            originalText.current.set(node, node.data);
          }
          applyTextNode(node, localeRef.current);
          continue;
        }
        for (const node of mutation.addedNodes) applySubtree(node, localeRef.current);
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [applySubtree, applyTextNode, locale]);

  const setLocale = useCallback((nextLocale: SiteLocale) => {
    if (nextLocale === localeRef.current) return;
    localeRef.current = nextLocale;
    document.documentElement.dataset.siteLocale = nextLocale;
    document.documentElement.lang = nextLocale === "en" ? "en" : "zh-Hant";
    try {
      window.localStorage.setItem(SITE_LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Language selection still works for this page when storage is unavailable.
    }
    setLocaleState(nextLocale);
    window.dispatchEvent(new CustomEvent("msi-site-locale-change", {
      detail: { locale: nextLocale },
    }));
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function SiteLanguageSwitcher({ className = "" }: { className?: string }) {
  const context = useContext(I18nContext);
  if (!context) return null;

  return (
    <div
      className={`site-language-switcher ${className}`.trim()}
      role="group"
      aria-label={context.locale === "en" ? "Site language" : "網站語言"}
      data-site-i18n-ignore
    >
      <button
        type="button"
        aria-pressed={context.locale === "zh-TW"}
        onClick={() => context.setLocale("zh-TW")}
      >
        中文
      </button>
      <button
        type="button"
        aria-pressed={context.locale === "en"}
        onClick={() => context.setLocale("en")}
      >
        EN
      </button>
    </div>
  );
}
