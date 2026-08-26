import styles from "./standalone-demo.css";

const LOGO_URL = "https://storage-asset.msi.com/global/picture/image/icons/logo.png";
const SCRIPT_TARGET = document.currentScript?.dataset?.target ?? "";
const COUNTRY_OPTIONS = [
  ["www", "Global"], ["mtc", "MTC"], ["africa", "Africa"], ["arg", "Argentina"],
  ["au", "Australia"], ["br", "Brazil"], ["bg", "Bulgaria"], ["kh", "Cambodia"],
  ["ca", "Canada"], ["ca-fr", "Canada (French)"], ["cl", "Chile"], ["cn", "China"],
  ["co", "Colombia"], ["cz", "Czech Republic"], ["eeu", "East Europe"],
  ["fr", "France"], ["de", "Germany"], ["gr", "Greece"], ["hk", "Hong Kong"],
  ["hu", "Hungary"], ["in", "India"], ["id", "Indonesia"], ["it", "Italy"],
  ["jp", "Japan"], ["kr", "Korea"], ["latam", "Latin America"], ["my", "Malaysia"],
  ["mx", "Mexico"], ["ar", "Middle East Arabic"], ["nl", "Netherlands"],
  ["pe", "Peru"], ["ph", "Philippines"], ["pl", "Poland"], ["ro", "Romania"],
  ["ru", "Russia"], ["sg", "Singapore"], ["es", "Spain"], ["se", "Sweden"],
  ["tw", "Taiwan"], ["th", "Thailand"], ["tr", "Türkiye"], ["ua", "Ukraine"],
  ["uk", "United Kingdom"], ["us", "United States"], ["vn", "Vietnam"],
];
const PRODUCT_LINES = ["nb", "hh", "desktop", "monitor", "pro-monitors", "vga", "mb"];

function optionsMarkup(options) {
  return options.map(([value, label]) =>
    `<option value="${value}">${label} (${value})</option>`
  ).join("");
}

function productLinesMarkup() {
  return PRODUCT_LINES.map((line) => `<option value="${line}">${line}</option>`).join("");
}

function markup() {
  return `<main class="msi-feed-demo-app">
    <header class="msi-feed-demo-header">
      <div>
        <img src="${LOGO_URL}" alt="MSI">
        <h1>MSI Product Feed Demo</h1>
        <p>Direct MSI Product API demo</p>
      </div>
      <div class="msi-feed-demo-languages" aria-label="Language">
        <button type="button" data-standalone-locale="zh-TW" aria-pressed="true">中文</button>
        <button type="button" data-standalone-locale="en" aria-pressed="false">EN</button>
      </div>
    </header>
    <section id="live-demo" class="feed-demo-section">
      <h2 data-feed-i18n="demo.title">互動 Demo</h2>
      <p data-feed-i18n="demo.lead">選擇國家與產品線，取得所有分類 Title，再載入所選產品。</p>
      <form class="feed-demo-controls feed-demo-controls--selector" id="product-feed-controls">
        <div class="feed-demo-field">
          <span id="product-feed-country-label" data-feed-i18n="country.label">國家</span>
          <select id="product-feed-country-preset" data-feed-setting aria-labelledby="product-feed-country-label">
            ${optionsMarkup(COUNTRY_OPTIONS)}
            <option value="__other__" data-feed-i18n="common.other">其他</option>
          </select>
          <input id="product-feed-country-custom" class="feed-custom-value" name="country" value="uk"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*" autocomplete="off" data-feed-setting
            data-feed-i18n-placeholder="country.otherPlaceholder" aria-labelledby="product-feed-country-label" hidden>
          <small data-feed-i18n="country.help">預設清單提供常用 MSI Local；選擇「其他」可自行輸入國碼</small>
        </div>
        <div class="feed-demo-field">
          <span id="product-feed-line-label" data-feed-i18n="productLine.label">產品線</span>
          <select id="product-feed-line-preset" data-feed-setting aria-labelledby="product-feed-line-label">
            ${productLinesMarkup()}
            <option value="__other__" data-feed-i18n="common.other">其他</option>
          </select>
          <input id="product-feed-line-custom" class="feed-custom-value" name="productLine" value="nb"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*" autocomplete="off" data-feed-setting
            data-feed-i18n-placeholder="productLine.otherPlaceholder" aria-labelledby="product-feed-line-label" hidden>
          <small data-feed-i18n="productLine.help">預設清單提供常用 Product Line；選擇「其他」可自行輸入</small>
        </div>
        <div class="feed-demo-controls__actions">
          <button type="submit" id="product-feed-tag-submit" data-feed-i18n="categories.fetch" disabled>取得分類 Title</button>
          <span id="product-feed-status" aria-live="polite">請先取得分類</span>
        </div>
      </form>
      <section class="feed-tag-builder" aria-labelledby="feed-tag-builder-title">
        <div class="feed-tag-preview">
          <div><span data-feed-i18n="array.label">TAG TITLES 陣列</span><strong id="product-feed-tag-count">已選擇 0 項</strong></div>
          <pre><code id="product-feed-tag-array">[]</code></pre>
          <button type="button" data-feed-copy="product-feed-tag-array" data-feed-i18n="array.copy">複製陣列</button>
        </div>
        <fieldset class="feed-tag-fieldset">
          <legend id="feed-tag-builder-title" data-feed-i18n="category.legend">分類 Title</legend>
          <div class="feed-tag-options" id="product-feed-tag-options"><p data-feed-i18n="category.initial">請先取得分類。</p></div>
        </fieldset>
        <div class="feed-tag-actions">
          <button type="button" id="product-feed-select-all" data-feed-i18n="actions.selectAll" disabled>全選</button>
          <button type="button" id="product-feed-clear-tags" data-feed-i18n="actions.clear" disabled>清除</button>
          <button type="button" id="product-feed-render" data-feed-i18n="actions.load" disabled>載入所選產品 Demo</button>
        </div>
      </section>
      <div class="feed-demo-runtime">
        <div><span data-feed-i18n="runtime.label">渲染目標</span><strong data-feed-i18n="runtime.description">API 成功後才替換下方內容</strong></div>
        <ol id="product-feed-log" aria-live="polite"><li data-feed-i18n="runtime.initial">目前為原始靜態內容</li></ol>
      </div>
      <div class="slider__Laptops is-slider-ready" id="product-feed-demo" aria-label="MSI Product Feed Demo 結果">
        <div class="slider__Laptops-box slider__Laptops-box--static"><div class="slider__Laptops-item">
          <div class="feed-static-art" aria-hidden="true" data-feed-i18n="static.badge">靜態內容</div>
          <span class="product-label" data-feed-i18n="static.current">目前頁面</span>
          <h4 data-feed-i18n="static.title">原本正在運作的靜態產品內容</h4>
          <p data-feed-i18n="static.description">資料載入失敗時，這個區塊不會被清除。</p>
          <a href="#live-demo"><span data-feed-i18n="static.waiting">等待 API</span></a>
        </div></div>
      </div>
    </section>
  </main>`;
}

function detectCountry() {
  const hostname = globalThis.location?.hostname?.toLowerCase() ?? "";
  if (!hostname.endsWith(".msi.com")) return "uk";
  return hostname.split(".")[0] || "www";
}

async function mount() {
  const target = SCRIPT_TARGET ? document.querySelector(SCRIPT_TARGET) : document.body;
  if (!target) return;

  if (!document.querySelector("style[data-msi-product-feed-demo]")) {
    const style = document.createElement("style");
    style.dataset.msiProductFeedDemo = "";
    style.textContent = styles;
    document.head.append(style);
  }

  target.insertAdjacentHTML("beforeend", markup());
  const country = detectCountry();
  const countryPreset = document.querySelector("#product-feed-country-preset");
  const countryCustom = document.querySelector("#product-feed-country-custom");
  if (countryPreset && countryCustom) {
    const presetExists = [...countryPreset.options].some((option) => option.value === country);
    countryPreset.value = presetExists ? country : "__other__";
    countryCustom.value = country;
    countryCustom.dataset.customValue = country;
  }

  document.documentElement.dataset.siteLocale = "zh-TW";
  globalThis.MSI_PRODUCT_FEED_DEMO_CONFIG = { proxyUrl: null };
  await import("./demo.js");

  for (const button of document.querySelectorAll("[data-standalone-locale]")) {
    button.addEventListener("click", () => {
      const locale = button.dataset.standaloneLocale;
      document.documentElement.dataset.siteLocale = locale;
      for (const item of document.querySelectorAll("[data-standalone-locale]")) {
        item.setAttribute("aria-pressed", String(item === button));
      }
      globalThis.dispatchEvent(new CustomEvent("msi-site-locale-change", {
        detail: { locale },
      }));
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
