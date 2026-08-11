import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "MSI Privacy Embed Control — 完整示範",
  description:
    "以事前同意控制 iframe 與第三方 JavaScript SDK 的載入、同步與撤回生命週期。",
};

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="MSI Privacy Embed Control 首頁">
          <span className="brand-mark">M</span>
          <span>
            <strong>Privacy Embed Control</strong>
            <small>Developer demonstration</small>
          </span>
        </a>
        <button className="topbar-action" type="button" data-open-settings>
          第三方內容設定
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker">CONSENT-GATED EMBEDS</p>
          <h1>
            外部內容，<br />
            只在同意後啟動。
          </h1>
          <p className="hero-lead">
            一個零依賴 JavaScript 插件，統一管理標準 iframe 與需要
            DIV、SDK、API 呼叫的特殊第三方元件。
          </p>
          <div className="hero-actions">
            <a href="#live-demo" className="primary-link">
              開始互動示範
            </a>
            <a href="#integration" className="secondary-link">
              查看整合方式
            </a>
          </div>
        </div>

        <aside className="status-console" aria-label="目前隱私控制狀態">
          <div className="console-header">
            <span>CONTROL STATUS</span>
            <span className="live-indicator">LIVE</span>
          </div>
          <dl>
            <div>
              <dt>Provider manifest</dt>
              <dd id="manifest-state">載入中…</dd>
            </div>
            <div>
              <dt>允許的 providerId</dt>
              <dd id="consent-list">
                <span className="status-empty">讀取中…</span>
              </dd>
            </div>
            <div>
              <dt>Consent cookie 大小</dt>
              <dd id="cookie-size">— bytes</dd>
            </div>
          </dl>
          <div className="console-actions">
            <button type="button" data-open-settings>
              管理設定
            </button>
            <button type="button" id="revoke-all">
              全部撤回
            </button>
          </div>
        </aside>
      </section>

      <section className="principles" aria-label="核心保護措施">
        <article>
          <span>01</span>
          <h2>事前封鎖</h2>
          <p>HTML 初始狀態沒有第三方 iframe src，也不載入外部 SDK。</p>
        </article>
        <article>
          <span>02</span>
          <h2>Provider 同步</h2>
          <p>同意一次，同頁面所有相同 provider 的實例一起安全啟用。</p>
        </article>
        <article>
          <span>03</span>
          <h2>可逆生命週期</h2>
          <p>撤回後立即卸載 iframe、取消 API 工作並執行 adapter cleanup。</p>
        </article>
      </section>

      <section className="demo-section" id="live-demo">
        <div className="section-heading">
          <div>
            <p className="kicker">LIVE DEMONSTRATION</p>
            <h2>兩種載入模式，同一套同意控制</h2>
          </div>
          <p>
            請實際點擊同意與撤回。YouTube 共有兩個實例，用來驗證相同 provider
            會同步載入與卸載。
          </p>
        </div>

        <article className="demo-block">
          <div className="demo-label">
            <span>MODE 01</span>
            <div>
              <h3>標準 iframe</h3>
              <p>URL 解析 → manifest origin 驗證 → consent → 建立 iframe</p>
            </div>
          </div>
          <div id="youtube-primary" className="embed-target" />
          <details className="secondary-instance">
            <summary>展開第二個相同 provider 實例</summary>
            <div id="youtube-secondary" className="embed-target embed-target--secondary" />
          </details>
        </article>

        <article className="demo-block">
          <div className="demo-label">
            <span>MODE 02</span>
            <div>
              <h3>特殊 DIV＋JavaScript SDK</h3>
              <p>consent → load SDK once → mount → API → revoke/unmount</p>
            </div>
          </div>
          <div id="atlas-widget" className="embed-target" />
          <p className="demo-disclaimer">
            Atlas Metrics 是本機模擬服務，不會連線到真實第三方；用來展示 SDK
            非同步載入、API 呼叫、取消與清理流程。
          </p>
        </article>
      </section>

      <section className="integration" id="integration">
        <div className="section-heading section-heading--dark">
          <div>
            <p className="kicker">DESIGNER API</p>
            <h2>設計師只需要建立設定物件</h2>
          </div>
          <p>
            Provider 與 adapter 由開發／隱私管理者核准；內容編輯者只能選擇已核准項目及傳入內容參數。
          </p>
        </div>

        <div className="code-grid">
          <article>
            <div className="code-title">
              <span>一般 iframe</span>
              <code>type: iframe</code>
            </div>
            <pre><code>{`await control.create({
  type: "iframe",
  url: "https://www.youtube-nocookie.com/embed/…",
  title: "產品介紹影片",
  target: "#video-slot"
});`}</code></pre>
          </article>

          <article>
            <div className="code-title">
              <span>特殊 SDK 元件</span>
              <code>type: snippet</code>
            </div>
            <pre><code>{`await control.create({
  type: "snippet",
  providerId: "atlas-metrics-demo",
  target: "#metric-slot",
  html: '<div class="metric"></div>',
  scripts: ["https://vendor.example/sdk.js"],
  mount({ prepared, options, signal }) {
    return VendorSDK.mount(
      prepared.querySelector(".metric"),
      { ...options, signal }
    );
  },
  options: { metricId: "health" }
});`}</code></pre>
          </article>

          <article className="code-wide">
            <div className="code-title">
              <span>供應商提供 DIV＋script 時</span>
              <code>prepare → load → mount → unmount</code>
            </div>
            <pre><code>{`await control.create({
  type: "snippet",
  providerId: "vendor-provider",
  target: "#vendor-slot",

  // 供應商給的 DIV 可直接放這裡
  html: \
    '<div class="vendor-widget" ' +
    'data-id="{{contentId}}"></div>',

  // 把 <script src="..."> 改放到陣列
  scripts: ["https://vendor.example/sdk.js"],

  // 把原本 inline script 放進 mount
  mount({ prepared, options, signal }) {
    const div = prepared.querySelector(".vendor-widget");
    return window.VendorSDK.mount(div, { ...options, signal });
  },

  unmount({ mountResult }) {
    return mountResult?.destroy?.();
  },

  options: { contentId: "product-123" }
});`}</code></pre>
          </article>
        </div>
      </section>

      <section className="activity-section">
        <div>
          <p className="kicker">EVENT STREAM</p>
          <h2>生命週期紀錄</h2>
          <p>
            Demo 會顯示初始化、同意與撤回事件；正式環境可透過
            <code>onConsentChange</code> 傳送最小化稽核紀錄。
          </p>
        </div>
        <ol id="activity-log" className="activity-log" aria-live="polite" />
      </section>

      <section className="privacy-note" id="demo-privacy">
        <p className="kicker">DEMO PRIVACY NOTE</p>
        <h2>這個示範本身如何處理資料</h2>
        <p>
          預設不載入任何受控第三方內容。只有您按下同意後，才會建立對應 iframe
          或載入模擬 SDK。Cookie 僅保存已允許的 providerId 與 consent version；
          您可隨時透過頁首設定或每個元件下方的按鈕撤回。
        </p>
      </section>

      <footer className="site-footer">
        <span>MSI Privacy Embed Control / Reference implementation</span>
        <button type="button" data-open-settings>
          第三方內容設定
        </button>
      </footer>

      <Script type="module" src="/demo/demo.js" strategy="afterInteractive" />
    </main>
  );
}
