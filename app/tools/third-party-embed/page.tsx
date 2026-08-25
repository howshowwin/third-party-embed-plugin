import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { MSI_LOGO_URL } from "../../../lib/brand";

export const metadata: Metadata = {
  title: "Third-party Embed Control｜MSI Web Tools",
  description:
    "第三方 iframe、HTML、CSS 與 JavaScript 同意控制工具的整合手冊與 Demo。",
  openGraph: {
    title: "MSI Privacy Embed Control 使用手冊",
    description:
      "第三方 iframe、HTML、CSS 與 JavaScript 同意控制工具的整合手冊與 Demo。",
    images: ["/og-guide.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "MSI Privacy Embed Control 使用手冊",
    description:
      "第三方 iframe、HTML、CSS 與 JavaScript 同意控制工具的整合手冊與 Demo。",
    images: ["/og-guide.png"],
  },
};

const mainProgramCode = `<link rel="stylesheet"
  href="https://storage-asset.msi.com/event/msi-third-party-embed/plugin/msi-third-party-embed.min.css">

<script type="module">
  import { MSIThirdPartyEmbedControl } from
    "https://storage-asset.msi.com/event/msi-third-party-embed/plugin/msi-third-party-embed.min.js";

  const control = new MSIThirdPartyEmbedControl();
  await control.init();

  // 將各服務章節的 control.create(...) 接在這裡
</script>`;

const youkuEmbed = `await control.create({
  type: "iframe",
  providerId: "youku-video",
  target: "#demo-0",
  url: "https://player.youku.com/embed/YOUR_YOUKU_VID?client_id=YOUR_CLIENT_ID",
  title: "YOUKU 影片",
  allow: "autoplay; encrypted-media; fullscreen; picture-in-picture"
});`;

const sideqikEmbed = `await control.create({
  type: "snippet",
  providerId: "sideqik-promotions",
  target: "#demo-1",
  html: \`
    <div class="sideqik-promotion" data-token="de9Cjo6b"
      data-promotion-url="https://sdqk.me/p/the-desk-my-stage-aug-2026_hq-de9Cjo6b"></div>
  \`
});`;

const gleamEmbed = `await control.create({
  type: "snippet",
  providerId: "gleam-competitions",
  target: "#demo-2",
  html: \`
    <div class="giveaway__embed-placeholder">
      <a class="e-widget generic-loader"
        href="https://gleam.io/GcEwF/excellence-refined-giveaway"
        rel="nofollow">
        Excellence Refined Giveaway
      </a>
    </div>
  \`
});`;

const instagramEmbed = `await control.create({
  type: "snippet",
  providerId: "instagram-embeds",
  target: "#demo-3",
  html: \`
    <blockquote class="instagram-media"
      data-instgrm-permalink="https://www.instagram.com/p/Db3Eif_ASSQ/"
      data-instgrm-version="14">
    </blockquote>
  \`
});`;

const facebookEmbed = `await control.create({
  type: "snippet",
  providerId: "facebook-embeds",
  target: "#demo-4",
  html: \`
    <div class="fb-post"
      data-href="https://www.facebook.com/story.php?story_fbid=1016192431171299&amp;id=100083416537348"
      data-width="500"
      data-show-text="true">
    </div>
  \`
});`;

const genericSnippet = `await control.create({
  type: "snippet",
  providerId: "approved-provider-id",
  target: "#demo-5",

  html: '<div class="vendor-widget" data-id="{{contentId}}"></div>',
  css: '.vendor-widget { min-height: 320px; }',
  js: [
    ({ global, root, options, signal }) => {
      // 只有同意後才會執行；可在這裡初始化 queue 或呼叫 API
    },
    { src: "https://vendor.example/sdk.js" }
  ],
  options: { contentId: "content-123" }
});`;

function CodeBlock({
  id,
  code,
  language = "JavaScript",
}: {
  id: string;
  code: string;
  language?: string;
}) {
  return (
    <div className="feed-code">
      <div className="feed-code__bar">
        <span>{language}</span>
        <button type="button" data-copy-target={id}>複製</button>
      </div>
      <pre id={id}><code>{code}</code></pre>
    </div>
  );
}

export default function ThirdPartyEmbedGuide() {
  return (
    <main className="feed-doc embed-doc" id="top">
      <header className="feed-doc__header">
        <Link className="feed-doc__brand" href="/" aria-label="回到所有工具">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MSI_LOGO_URL} alt="MSI" width={155} height={65} />
          <span>
            <strong>MSI Web Tools</strong>
            <small>Privacy Embed</small>
          </span>
        </Link>
        <nav aria-label="頁面導覽">
          <a href="#quick-start">快速開始</a>
          <a href="#youku">服務範例</a>
          <a href="#runtime">執行狀態</a>
        </nav>
        <div className="embed-header-actions">
          <Link className="feed-doc__all-tools" href="/">所有工具</Link>
          <button type="button" data-open-settings>管理同意</button>
        </div>
      </header>

      <section className="feed-hero embed-hero">
        <div>
          <p>PRIVACY &amp; COMPLIANCE · v0.1</p>
          <h1>Third-party<br />Embed Control</h1>
          <span>
            在訪客同意前阻止第三方 iframe 與 JavaScript SDK 建立連線，
            並以核准的 Provider manifest 統一管理載入、同步同意與撤回生命週期。
          </span>
        </div>
        <dl>
          <div><dt>5</dt><dd>服務範例</dd></div>
          <div><dt>2</dt><dd>嵌入模式</dd></div>
          <div><dt>1</dt><dd>同意 Cookie</dd></div>
        </dl>
      </section>

      <div className="feed-doc__layout embed-doc__layout">
        <aside className="feed-toc embed-toc" aria-label="本頁章節">
          <p>ON THIS PAGE</p>
          <a href="#overview">工具概覽</a>
          <a href="#quick-start">快速開始</a>
          <a href="#provider-manifest">Provider 白名單</a>
          <a href="#youku">YOUKU 影片</a>
          <a href="#sideqik">Sideqik 活動</a>
          <a href="#gleam">Gleam 抽獎</a>
          <a href="#instagram">Instagram 貼文</a>
          <a href="#facebook">Facebook 貼文</a>
          <a href="#generic-snippet">HTML / CSS / JS</a>
          <a href="#revoke">撤回與生命週期</a>
          <a href="#api-reference">參數參考</a>
          <a href="#runtime">執行狀態</a>
        </aside>

        <article className="feed-doc__content embed-doc__content">
          <section id="overview">
            <div className="feed-section-title">
              <span>01</span>
              <div><p>OVERVIEW</p><h2>工具概覽</h2></div>
            </div>
            <p className="feed-lead">
              提供網站建置與內容維護人員整合第三方 iframe、HTML、CSS 與 JavaScript 的標準方式。
              插件只允許後端與 Provider manifest 已核准的服務，且取得訪客同意前不會連線第三方來源。
            </p>
            <h3 className="embed-program-title">引入主程式</h3>
            <p>每個使用第三方嵌入工具的頁面先加入以下程式碼，再接續各服務章節的嵌入設定。</p>
            <CodeBlock id="code-main-program" code={mainProgramCode} language="HTML" />
            <div className="doc-callout doc-callout--important">
              <strong>使用前提</strong>
              <p>新服務必須先完成內部申請。未列入 Provider JSON 白名單的網域，前端插件不會載入。</p>
            </div>
          </section>

          <section className="doc-section" id="quick-start">
            <div className="section-index">02</div>
            <div className="section-body">
              <div className="section-title">
                <p>GETTING STARTED</p>
                <h2>快速開始</h2>
              </div>
              <ol className="step-list">
                <li>
                  <span>1</span>
                  <div>
                    <strong>確認服務已核准</strong>
                    <p>
                      先確認服務是否已列入 Provider 白名單。若沒有，請聯絡
                      <b className="approval-contact">Ran#2084</b>，告知需要加入白名單；核准後再取得 Provider ID。
                    </p>
                  </div>
                </li>
                <li><span>2</span><div><strong>在頁面建立容器</strong><p>準備一個有唯一 ID 的 DIV，例如 <code>&lt;div id=&quot;demo-0&quot;&gt;&lt;/div&gt;</code>。</p></div></li>
                <li><span>3</span><div><strong>建立嵌入物件</strong><p>依服務章節複製設定。插件會自動顯示同意區塊、同步同一 Provider，並處理撤回。</p></div></li>
              </ol>
              <div className="doc-callout">
                <strong>不需要自行處理 Cookie</strong>
                <p><code>msi_thirdPartyCookieControl</code> 由插件統一管理，內容只保存已允許的 Provider ID 與 consent version。</p>
              </div>
              <div className="doc-callout">
                <strong>介面翻譯集中管理</strong>
                <p><code>https://storage-asset.msi.com/event/msi-third-party-embed/plugin/translations.json</code> 管理所有插件元件文字。預設使用 <code>locale: &quot;auto&quot;</code>，從目前網域的第一段子網域判斷，例如 <code>jp.msi.com</code> 使用日文、<code>tw.msi.com</code> 使用繁中；<code>www</code>、<code>mtc</code> 或無法比對時使用英文。</p>
              </div>
            </div>
          </section>

          <section className="doc-section" id="provider-manifest">
            <div className="section-index">03</div>
            <div className="section-body">
              <div className="section-title">
                <p>APPROVAL WORKFLOW</p>
                <h2>Provider 白名單</h2>
              </div>
              <p className="section-lead">
                Provider JSON 是前端唯一可信清單。編輯者可以填入影片 ID、活動 token
                等內容參數，但不能自行新增供應商網域。
              </p>
              <div className="approval-flow" aria-label="第三方服務核准流程">
                <div><span>01</span><strong>提出申請</strong><small>服務、公司、用途、隱私政策</small></div>
                <i>→</i>
                <div><span>02</span><strong>安全核准</strong><small>後端 CSP 與來源網域</small></div>
                <i>→</i>
                <div><span>03</span><strong>更新 JSON</strong><small>Provider ID 與允許來源</small></div>
                <i>→</i>
                <div><span>04</span><strong>提供範例</strong><small>使用人員複製設定物件</small></div>
              </div>
              <div className="field-table" role="table" aria-label="Provider JSON 欄位">
                <div className="field-row field-row--head" role="row"><span>欄位</span><span>用途</span><span>維護者</span></div>
                <div className="field-row" role="row"><code>id</code><span>Cookie 與程式使用的穩定識別碼</span><b>平台管理者</b></div>
                <div className="field-row" role="row"><code>allowedFrameOrigins</code><span>iframe 可載入的精確 origin</span><b>平台管理者</b></div>
                <div className="field-row" role="row"><code>allowedScriptOrigins</code><span>外部 JavaScript 可載入的精確 origin</span><b>平台管理者</b></div>
                <div className="field-row" role="row"><code>privacyPolicyUrl</code><span>同意介面顯示的供應商隱私政策</span><b>平台管理者</b></div>
              </div>
            </div>
          </section>

          <section className="doc-section provider-section" id="youku">
            <div className="section-index">04</div>
            <div className="section-body">
              <div className="provider-heading">
                <div>
                  <div className="provider-tags"><span>IFRAME</span><span>VIDEO</span></div>
                  <h2>YOUKU 影片</h2>
                  <p>適用於中國市場的優酷影片播放器。iframe 只會在訪客同意後建立。</p>
                </div>
                <div className="provider-origin"><small>允許來源</small><code>player.youku.com</code></div>
              </div>

              <h3>頁面嵌入</h3>
              <CodeBlock id="code-youku-embed" code={youkuEmbed} />

              <h3>同意介面預覽</h3>
              <div id="demo-0" className="embed-target manual-embed" />
            </div>
          </section>

          <section className="doc-section provider-section" id="sideqik">
            <div className="section-index">05</div>
            <div className="section-body">
              <div className="provider-heading">
                <div>
                  <div className="provider-tags"><span>HTML</span><span>CSS</span><span>JS SDK</span></div>
                  <h2>Sideqik Promotions</h2>
                  <p>適用於 Sideqik 活動頁與互動式 promotion。DIV 與 SDK 都在同意後才加入頁面。</p>
                </div>
                <div className="provider-origin"><small>允許來源</small><code>sdqk.me</code><code>*.cloudfront.net</code></div>
              </div>

              <h3>準備資料</h3>
              <ul className="check-list">
                <li>從 Sideqik 複製完整的 <code>sideqik-promotion</code> DIV</li>
                <li>確認 DIV 內含 <code>data-token</code> 與完整的 <code>data-promotion-url</code></li>
                <li>不需要另外複製 Sideqik 提供的 script</li>
              </ul>
              <h3>頁面嵌入</h3>
              <CodeBlock id="code-sideqik" code={sideqikEmbed} />
              <div className="doc-callout">
                <strong>Sideqik 共用程序已集中管理</strong>
                <p>Queue 初始化、共用 CSS、SDK 網址與載入順序已在主要控制程式註冊；每個活動只需要更換上面的 HTML。</p>
              </div>
              <h3>同意介面預覽</h3>
              <div id="demo-1" className="embed-target manual-embed" />
              <p className="preview-note">撤回 Sideqik 時，插件會先更新 Cookie 再重新整理頁面，避免已執行的 SDK 留在記憶體中。</p>
            </div>
          </section>

          <section className="doc-section provider-section" id="gleam">
            <div className="section-index">06</div>
            <div className="section-body">
              <div className="provider-heading">
                <div>
                  <div className="provider-tags"><span>HTML</span><span>JS SDK</span><span>GIVEAWAY</span></div>
                  <h2>Gleam Competitions</h2>
                  <p>適用於 Gleam 抽獎與互動式活動。活動連結保留在供應商提供的 HTML，SDK 由主要控制程式統一載入。</p>
                </div>
                <div className="provider-origin"><small>允許來源</small><code>gleam.io</code><code>widget.gleamjs.io</code></div>
              </div>

              <h3>準備資料</h3>
              <ul className="check-list">
                <li>從 Gleam 複製完整的活動 DIV 與連結</li>
                <li>確認連結包含 <code>e-widget generic-loader</code> class</li>
                <li>移除原始碼中的 <code>&lt;script&gt;</code>，不需要自行放入 SDK</li>
              </ul>
              <p className="source-note">
                官方文件：<a href="https://gleam.io/docs/competitions/installation/add-page" target="_blank" rel="noreferrer">Gleam Competition 嵌入說明</a>
                <span>·</span>
                <a href="https://gleam.io/privacy" target="_blank" rel="noreferrer">隱私政策</a>
              </p>

              <h3>頁面嵌入</h3>
              <CodeBlock id="code-gleam" code={gleamEmbed} />
              <div className="doc-callout">
                <strong>Gleam 共用程序已集中管理</strong>
                <p><code>widget.gleamjs.io/e.js</code>、共用 CSS 與載入順序已在主要控制程式註冊；每個活動只需要更換上面的 HTML。</p>
              </div>
              <h3>同意介面預覽</h3>
              <div id="demo-2" className="embed-target manual-embed" />
              <p className="preview-note">只有同意 Gleam Competitions 後，活動 HTML 與 Gleam SDK 才會加入頁面；撤回時會更新 Cookie 並重新整理。</p>
            </div>
          </section>

          <section className="doc-section provider-section" id="instagram">
            <div className="section-index">07</div>
            <div className="section-body">
              <div className="provider-heading">
                <div>
                  <div className="provider-tags"><span>HTML</span><span>IFRAME</span><span>SOCIAL</span></div>
                  <h2>Instagram 貼文</h2>
                  <p>適用於公開 Instagram 貼文與 Reels。頁面只提供 blockquote 與貼文網址，主要控制程式會在取得同意後轉換為 Instagram iframe。</p>
                </div>
                <div className="provider-origin"><small>允許來源</small><code>www.instagram.com</code><code>static.cdninstagram.com</code></div>
              </div>

              <h3>準備資料</h3>
              <ul className="check-list">
                <li>必須是可以公開瀏覽的 Instagram 貼文或 Reel</li>
                <li>使用不含 <code>igsh</code> 等追蹤參數的公開貼文 permalink</li>
                <li>不需要放入 Instagram 的 <code>embed.js</code> 或 iframe</li>
              </ul>
              <p className="source-note">
                官方文件：<a href="https://developers.facebook.com/docs/instagram-platform/instagram-embed/" target="_blank" rel="noreferrer">Instagram Embed</a>
                <span>·</span>
                <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer">Meta 隱私政策</a>
              </p>

              <h3>頁面嵌入</h3>
              <CodeBlock id="code-instagram" code={instagramEmbed} />
              <div className="doc-callout"><strong>Instagram iframe 已集中管理</strong><p>主要控制程式會驗證 permalink，並在取得同意後建立 <code>embed/captioned</code> iframe。高度會依嵌入寬度在 920–1200px 間自動調整，內容較長時可在嵌入區捲動。</p></div>
              <h3>同意介面預覽</h3>
              <div id="demo-3" className="embed-target manual-embed" />
              <p className="preview-note">備註：完整模式會顯示貼文說明、愛心、讚數、留言、分享與儲存入口；高度會隨版面寬度自動調整，內容較長時可在嵌入區捲動。實際互動由 Instagram 處理，使用者可能需要登入。分享網址已移除 <code>igsh</code> 追蹤參數，且只有同意後才會向 Instagram 建立連線。</p>
            </div>
          </section>

          <section className="doc-section provider-section" id="facebook">
            <div className="section-index">08</div>
            <div className="section-body">
              <div className="provider-heading">
                <div>
                  <div className="provider-tags"><span>HTML</span><span>JS SDK</span><span>SOCIAL</span></div>
                  <h2>Facebook 貼文</h2>
                  <p>適用於公開 Facebook 粉絲專頁貼文。頁面只提供 fb-post DIV 與貼文網址，Facebook SDK 由主要控制程式統一載入。</p>
                </div>
                <div className="provider-origin"><small>允許來源</small><code>www.facebook.com</code><code>connect.facebook.net</code><code>static.xx.fbcdn.net</code></div>
              </div>

              <h3>準備資料</h3>
              <ul className="check-list">
                <li>必須是可以公開瀏覽的 Facebook 貼文</li>
                <li>把分享網址轉成不含追蹤參數的完整貼文網址，再放入 <code>data-href</code></li>
                <li>不需要放入 Facebook SDK script 或 <code>fb-root</code></li>
              </ul>
              <p className="source-note">
                官方文件：<a href="https://developers.facebook.com/docs/plugins/embedded-posts/" target="_blank" rel="noreferrer">Facebook Embedded Posts</a>
                <span>·</span>
                <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer">Meta 隱私政策</a>
              </p>

              <h3>頁面嵌入</h3>
              <CodeBlock id="code-facebook" code={facebookEmbed} />
              <div className="doc-callout"><strong>Facebook 共用程序已集中管理</strong><p>Facebook SDK、Graph API <code>v25.0</code>、共用 CSS 與 <code>FB.XFBML.parse()</code> 已在主要控制程式註冊；每篇貼文只需要更換 <code>data-href</code>。</p></div>
              <h3>同意介面預覽</h3>
              <div id="demo-4" className="embed-target manual-embed" />
              <p className="preview-note">此處使用你提供的 MSI Gaming 公開貼文。只有同意後才會向 Facebook 建立連線。</p>
            </div>
          </section>

          <section className="doc-section" id="generic-snippet">
            <div className="section-index">09</div>
            <div className="section-body">
              <div className="section-title"><p>GENERIC INTEGRATION</p><h2>HTML / CSS / JS</h2></div>
              <p className="section-lead">供應商給的是一段 DIV、樣式與 JavaScript 時，直接拆到三個欄位。插件會依序放入 HTML、套用 CSS、最後執行 JS。</p>
              <CodeBlock id="code-generic-snippet" code={genericSnippet} />
              <div className="doc-callout doc-callout--warning">
                <strong>不要貼入 JavaScript 字串</strong>
                <p>Inline JavaScript 請包成函式；外部檔案使用 URL 或 <code>{`{ src, attributes }`}</code>。插件不使用 <code>eval()</code>。</p>
              </div>
              <div className="doc-callout">
                <strong>只接受經審核的程式碼</strong>
                <p><code>html</code>、<code>css</code> 與函式型 <code>js</code> 不是 sandbox，不得直接帶入 CMS、網址參數或表單內容。第三方 CSS selector 也要確認不會影響頁面其他區塊。</p>
              </div>
            </div>
          </section>

          <section className="doc-section" id="revoke">
            <div className="section-index">10</div>
            <div className="section-body">
              <div className="section-title"><p>CONSENT LIFECYCLE</p><h2>撤回與生命週期</h2></div>
              <div className="behavior-grid">
                <article><span>IFRAME</span><h3>立即註銷</h3><p>移除 iframe 與第三方連線，原位置重新顯示同意佔位區塊，不需要重新整理頁面。</p></article>
                <article><span>HTML + JS</span><h3>重新整理</h3><p>先從 Cookie 移除 Provider ID，再重新整理頁面，確保第三方 SDK、計時器與事件監聽完整停止。</p></article>
              </div>
              <div className="doc-callout"><strong>同一 Provider 同步處理</strong><p>同意或撤回會套用到目前頁面所有相同 Provider ID 的嵌入實例。</p></div>
            </div>
          </section>

          <section className="doc-section" id="api-reference">
            <div className="section-index">11</div>
            <div className="section-body">
              <div className="section-title"><p>REFERENCE</p><h2>參數參考</h2></div>
              <div className="field-table field-table--api" role="table" aria-label="create API 參數">
                <div className="field-row field-row--head" role="row"><span>參數</span><span>說明</span><span>必填</span></div>
                <div className="field-row" role="row"><code>type</code><span><code>iframe</code> 或 <code>snippet</code></span><b>是</b></div>
                <div className="field-row" role="row"><code>providerId</code><span>Provider JSON 內已核准的 ID</span><b>snippet 必填</b></div>
                <div className="field-row" role="row"><code>target</code><span>放置元件的 CSS selector 或元素</span><b>是</b></div>
                <div className="field-row" role="row"><code>url</code><span>完整 iframe URL，origin 必須核准</span><b>iframe 必填</b></div>
                <div className="field-row" role="row"><code>html / css / js</code><span>同意後依序處理的第三方內容</span><b>snippet 使用</b></div>
                <div className="field-row" role="row"><code>options</code><span>替換 HTML 變數或提供 inline JS 的資料</span><b>否</b></div>
                <div className="field-row" role="row"><code>locale / translationsUrl</code><span>插件介面語系與翻譯 JSON 路徑；locale 預設為 auto</span><b>否</b></div>
              </div>
            </div>
          </section>

          <section className="doc-section" id="runtime">
            <div className="section-index">12</div>
            <div className="section-body">
              <div className="section-title"><p>RUNTIME INSPECTOR</p><h2>目前執行狀態</h2></div>
              <div className="runtime-grid">
                <aside className="status-panel" aria-label="目前隱私控制狀態">
                  <div><span>Provider manifest</span><strong id="manifest-state">載入中…</strong></div>
                  <div><span>允許的 Provider ID</span><strong id="consent-list"><i className="status-empty">讀取中…</i></strong></div>
                  <div><span>Consent Cookie 大小</span><strong id="cookie-size">— bytes</strong></div>
                  <footer><button type="button" data-open-settings>管理設定</button><button type="button" id="revoke-all">全部撤回</button></footer>
                </aside>
                <div>
                  <h3>生命週期紀錄</h3>
                  <ol id="activity-log" className="activity-log" aria-live="polite" />
                </div>
              </div>
            </div>
          </section>

          <section className="doc-section final-checklist">
            <div className="section-index">✓</div>
            <div className="section-body">
              <div className="section-title"><p>BEFORE PUBLISHING</p><h2>上線前檢查</h2></div>
              <ul className="launch-checks">
                <li>後端 CSP / iframe 白名單已核准來源網域</li>
                <li>Provider JSON 包含公司名稱、用途與隱私政策</li>
                <li>初始 HTML 沒有第三方 iframe src 或 script</li>
                <li>拒絕同意時不會建立第三方連線</li>
                <li>頁面可從設定入口與元件下方撤回同意</li>
              </ul>
            </div>
          </section>
        </article>
      </div>

      <footer className="feed-doc__footer">
        <span>MSI Privacy Embed Control · Internal usage guide</span>
        <div>
          <Link href="/">所有工具</Link>
          <a href="#top">回到頁首 ↑</a>
        </div>
      </footer>

      <Script
        type="module"
        src="/tools/third-party-embed/demo.js"
        strategy="afterInteractive"
      />
    </main>
  );
}
