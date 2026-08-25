import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { MSI_LOGO_URL } from "../../../lib/brand";

export const metadata: Metadata = {
  title: "MSI Product Feed｜MSI Web Tools",
  description:
    "使用 MSI Product API 將既有靜態產品區塊安全替換成即時產品資料，並提供 before／after 生命週期。",
  openGraph: {
    title: "MSI Product Feed 使用手冊",
    description:
      "兩階段 Tag 與 Product API、HTML 模板渲染及 Slick 生命週期整合手冊。",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "MSI Product Feed 使用手冊",
    description:
      "兩階段 Tag 與 Product API、HTML 模板渲染及 Slick 生命週期整合手冊。",
    images: [],
  },
};

const importCode = `<script type="module">
  import { MSIProductFeed } from
    "/path/to/msi-product-feed.min.js";
</script>`;

const basicCode = `const feed = new MSIProductFeed({
  productLine: "nb",
  country: "uk", // 留空時使用目前網域；mtc 會轉為 www
  tagTitles: [
    "Titan Series",
    "Stealth / Creator Series",
    "Raider Series"
  ],
  sort: "default",
  target: ".slider__Laptops",
  html: \`
    <div class="slider__Laptops-box">
      <div class="slider__Laptops-item">
        <img src="{img}" alt="{title}">
        <h4>{title}</h4>
        <a href="{link}" target="_blank">
          <span>Learn More</span>
        </a>
      </div>
    </div>
  \`,
  before({ target }) {
    const $slider = $(target);
    if ($slider.hasClass("slick-initialized")) {
      $slider.slick("unslick");
    }
  },
  after({ target, error }) {
    if (error) return;
    $(target).slick({ slidesToShow: 4, arrows: true, dots: true });
  }
});

await feed.init();`;

const dataOnlyCode = `const result = await new MSIProductFeed({
  productLine: "monitor",
  tagTitles: ["MPG Series"],
  sort: "date"
}).init();

console.log(result.matchedTags);
console.log(result.products);`;

const countryCode = `country: "uk"  // https://uk.msi.com
country: "tw"  // https://tw.msi.com
country: "mtc" // https://www.msi.com
country: ""    // 目前網域；目前為 mtc 時改用 www`;

const demoCountries = [
  ["www", "Global"], ["africa", "Africa"], ["arg", "Argentina"],
  ["au", "Australia"], ["br", "Brazil"], ["bg", "Bulgaria"],
  ["kh", "Cambodia"], ["ca", "Canada"], ["ca-fr", "Canada (French)"],
  ["cl", "Chile"], ["cn", "China"], ["co", "Colombia"],
  ["cz", "Czech Republic"], ["eeu", "East Europe"], ["fr", "France"],
  ["de", "Germany"], ["gr", "Greece"], ["hk", "Hong Kong"],
  ["hu", "Hungary"], ["in", "India"], ["id", "Indonesia"],
  ["it", "Italy"], ["jp", "Japan"], ["kr", "Korea"],
  ["latam", "Latin America"], ["my", "Malaysia"], ["mx", "Mexico"],
  ["ar", "Middle East Arabic"], ["nl", "Netherlands"], ["pe", "Peru"],
  ["ph", "Philippines"], ["pl", "Poland"], ["ro", "Romania"],
  ["ru", "Russia"], ["sg", "Singapore"], ["es", "Spain"],
  ["se", "Sweden"], ["tw", "Taiwan"], ["th", "Thailand"],
  ["tr", "Türkiye"], ["ua", "Ukraine"], ["uk", "United Kingdom"],
  ["us", "United States"], ["vn", "Vietnam"],
] as const;

function CodeBlock({ id, code, language = "JavaScript" }: {
  id: string;
  code: string;
  language?: string;
}) {
  return (
    <div className="feed-code">
      <div className="feed-code__bar">
        <span>{language}</span>
        <button type="button" data-feed-copy={id}>複製</button>
      </div>
      <pre id={id}><code>{code}</code></pre>
    </div>
  );
}

export default function ProductFeedGuide() {
  return (
    <main className="feed-doc" id="top">
      <header className="feed-doc__header">
        <Link className="feed-doc__brand" href="/" aria-label="回到所有工具">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MSI_LOGO_URL} alt="MSI" width={155} height={65} />
          <span>
            <strong>MSI Web Tools</strong>
            <small>Product Feed</small>
          </span>
        </Link>
        <nav aria-label="頁面導覽">
          <a href="#quick-start">快速開始</a>
          <a href="#lifecycle">生命週期</a>
          <a href="#live-demo">Live Demo</a>
        </nav>
        <Link className="feed-doc__all-tools" href="/">所有工具</Link>
      </header>

      <section className="feed-hero">
        <div>
          <p>PRODUCT DATA AUTOMATION · v0.1</p>
          <h1>MSI Product Feed</h1>
          <span>
            先解析產品 Tag ID，再載入產品資料，最後以頁面提供的 HTML 模板替換既有靜態區塊。
            API 成功前不會中斷目前正在運作的 Slick 或產品內容。
          </span>
        </div>
        <dl>
          <div><dt>2</dt><dd>API 階段</dd></div>
          <div><dt>10</dt><dd>模板變數</dd></div>
          <div><dt>2</dt><dd>生命週期 Hook</dd></div>
        </dl>
      </section>

      <div className="feed-doc__layout">
        <aside className="feed-toc" aria-label="本頁章節">
          <p>ON THIS PAGE</p>
          <a href="#overview">運作方式</a>
          <a href="#quick-start">快速開始</a>
          <a href="#configuration">設定參數</a>
          <a href="#template">HTML 模板</a>
          <a href="#lifecycle">Before / After</a>
          <a href="#country">國碼與網域</a>
          <a href="#live-demo">Live API Demo</a>
        </aside>

        <article className="feed-doc__content">
          <section id="overview">
            <div className="feed-section-title"><span>01</span><div><p>OVERVIEW</p><h2>運作方式</h2></div></div>
            <p className="feed-lead">
              工具先呼叫 <code>getProductTagList</code>，遞迴整理單層及 <code>level2</code> Tag，使用完全相符的
              <code> title </code>取得 ID；再以所有 ID 呼叫 <code>getProductList</code>。兩支 API 都成功後才開始碰觸 DOM。
            </p>
            <ol className="feed-flow">
              <li><span>1</span><strong>Resolve Tags</strong><small>精確比對 title，取得並去除重複 ID</small></li>
              <li><span>2</span><strong>Load Products</strong><small>使用 product_line、sort 與 id[] 取得產品</small></li>
              <li><span>3</span><strong>Build Fragment</strong><small>安全替換模板變數，先在畫面外完成 HTML</small></li>
              <li><span>4</span><strong>Swap & Restore</strong><small>before → replaceChildren → after</small></li>
            </ol>
          </section>

          <section id="quick-start">
            <div className="feed-section-title"><span>02</span><div><p>GETTING STARTED</p><h2>快速開始</h2></div></div>
            <p>將建置後的 ESM 檔案放入網站，再建立一個 Feed 實例。</p>
            <CodeBlock id="feed-import" code={importCode} language="HTML" />
            <CodeBlock id="feed-basic" code={basicCode} />
            <div className="feed-note">
              <strong>API 失敗時維持原畫面</strong>
              <p>在 Tag 或 Product API 完成前不會執行 before，也不會清除目前的靜態內容。</p>
            </div>
          </section>

          <section id="configuration">
            <div className="feed-section-title"><span>03</span><div><p>CONFIGURATION</p><h2>設定參數</h2></div></div>
            <div className="feed-table" role="table" aria-label="Product Feed 設定參數">
              <div className="feed-table__row feed-table__head" role="row"><span>參數</span><span>說明</span><span>必填</span></div>
              <div className="feed-table__row" role="row"><code>productLine</code><span><code>nb</code>、<code>hh</code>、<code>desktop</code>、<code>monitor</code>、<code>pro-monitors</code>、<code>vga</code>、<code>mb</code> 或其他 Product Line</span><b>是</b></div>
              <div className="feed-table__row" role="row"><code>tagTitles</code><span>要在 filterTagList 中完全相符的標題陣列</span><b>是</b></div>
              <div className="feed-table__row" role="row"><code>country</code><span>API 與產品導連使用的國碼；未填使用目前網域</span><b>否</b></div>
              <div className="feed-table__row" role="row"><code>sort</code><span><code>default</code> 或 <code>date</code></span><b>否</b></div>
              <div className="feed-table__row" role="row"><code>target</code><span>要替換內容的 selector 或 DOM Element</span><b>渲染時</b></div>
              <div className="feed-table__row" role="row"><code>html</code><span>每一筆產品重複使用的 HTML 模板</span><b>渲染時</b></div>
              <div className="feed-table__row" role="row"><code>strictTags</code><span>預設 true；任一 Tag 找不到就停止，不顯示部分資料</span><b>否</b></div>
              <div className="feed-table__row" role="row"><code>pageSize</code><span>預設 99</span><b>否</b></div>
            </div>
            <p>若不設定 target 與 html，工具只會回傳整理後的資料：</p>
            <CodeBlock id="feed-data-only" code={dataOnlyCode} />
          </section>

          <section id="template">
            <div className="feed-section-title"><span>04</span><div><p>HTML TEMPLATE</p><h2>模板變數</h2></div></div>
            <p className="feed-lead">整段 HTML 代表一筆產品。API 值會先跳脫後再寫入文字與 Attribute，不會把產品名稱當成可執行 HTML。</p>
            <div className="feed-token-grid">
              <div><code>{`{img}`}</code><span>產品圖片 URL</span></div>
              <div><code>{`{title}`}</code><span>純文字產品名稱</span></div>
              <div><code>{`{link}`}</code><span>完整 Local 產品網址</span></div>
              <div><code>{`{subname}`}</code><span>純文字副標題</span></div>
              <div><code>{`{label}`}</code><span>HOT、NEW 等標籤</span></div>
              <div><code>{`{release}`}</code><span>發布日期</span></div>
              <div><code>{`{id}`}</code><span>產品 ID</span></div>
              <div><code>{`{index}`}</code><span>從 0 開始的索引</span></div>
              <div><code>{`{number}`}</code><span>從 1 開始的序號</span></div>
              <div><code>{`{productLine}`}</code><span>API 產品分類</span></div>
            </div>
            <div className="feed-note feed-note--security">
              <strong>模板安全限制</strong>
              <p>拒絕 script、iframe、object、embed、on* 事件與 javascript: URL；target=&quot;_blank&quot; 會自動加上 noopener noreferrer。</p>
            </div>
          </section>

          <section id="lifecycle">
            <div className="feed-section-title"><span>05</span><div><p>LIFECYCLE</p><h2>Before / After</h2></div></div>
            <div className="feed-lifecycle">
              <article><span>BEFORE</span><h3>解除既有元件</h3><p>產品資料與離線 Fragment 都準備完成後才執行，可在此呼叫 unslick。</p></article>
              <i aria-hidden="true">→</i>
              <article><span>RENDER</span><h3>一次替換內容</h3><p>使用 replaceChildren 將完成的 Fragment 放入 target。</p></article>
              <i aria-hidden="true">→</i>
              <article><span>AFTER</span><h3>重新初始化</h3><p>重新掛載 Slick。若 before 或 render 失敗，after 仍會收到 error。</p></article>
            </div>
          </section>

          <section id="country">
            <div className="feed-section-title"><span>06</span><div><p>LOCAL RESOLUTION</p><h2>國碼與網域</h2></div></div>
            <CodeBlock id="feed-country" code={countryCode} />
            <p className="feed-lead">正式 MSI 頁面建議留空以呼叫同網域 API。指定不同 Local 時瀏覽器可能受 CORS 限制，需由後端 Proxy 轉送；本頁 Vercel Demo 已使用受登入保護的 Proxy。</p>
          </section>

          <section id="live-demo" className="feed-demo-section">
            <div className="feed-demo-heading">
              <div className="feed-section-title"><span>07</span><div><p>LIVE API</p><h2 data-feed-i18n="demo.title">互動 Demo</h2></div></div>
              <div
                className="feed-locale-switch"
                role="group"
                aria-label="Demo 語言"
                data-feed-i18n-aria-label="language.label"
              >
                <button type="button" data-feed-locale="zh-TW" aria-pressed="true">中文</button>
                <button type="button" data-feed-locale="en" aria-pressed="false">English</button>
              </div>
            </div>
            <p className="feed-lead" data-feed-i18n="demo.lead">
              選擇國家與產品線，先取得 API 提供的所有分類 Title。勾選需要的分類後，
              上方會產生可複製的 <code>tagTitles</code> 陣列，再以相同選擇載入產品 Demo。
            </p>

            <form className="feed-demo-controls feed-demo-controls--selector" id="product-feed-controls">
              <label>
                <span data-feed-i18n="country.label">國家</span>
                <input
                  name="country"
                  defaultValue="uk"
                  list="product-feed-country-list"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  autoComplete="off"
                  required
                />
                <datalist id="product-feed-country-list">
                  {demoCountries.map(([code, label]) => (
                    <option value={code} key={code}>{label}</option>
                  ))}
                </datalist>
                <small data-feed-i18n="country.help">可自行輸入國碼；清單僅提供常用 MSI Local 建議</small>
              </label>
              <label>
                <span data-feed-i18n="productLine.label">產品線</span>
                <input
                  name="productLine"
                  defaultValue="nb"
                  list="product-feed-line-list"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  autoComplete="off"
                  required
                />
                <datalist id="product-feed-line-list">
                  {['nb', 'hh', 'desktop', 'monitor', 'pro-monitors', 'vga', 'mb'].map((line) => (
                    <option value={line} key={line} />
                  ))}
                </datalist>
                <small data-feed-i18n="productLine.help">可自行輸入 Product Line；清單只列常用項目</small>
              </label>
              <div className="feed-demo-controls__actions">
                <button type="submit" id="product-feed-tag-submit" data-feed-i18n="categories.fetch" disabled>取得分類 Title</button>
                <span id="product-feed-status" aria-live="polite">請先取得分類</span>
              </div>
            </form>

            <section className="feed-tag-builder" aria-labelledby="feed-tag-builder-title">
              <div className="feed-tag-preview">
                <div>
                  <span data-feed-i18n="array.label">TAG TITLES 陣列</span>
                  <strong id="product-feed-tag-count">已選擇 0 項</strong>
                </div>
                <pre><code id="product-feed-tag-array">[]</code></pre>
                <button type="button" data-feed-copy="product-feed-tag-array" data-feed-i18n="array.copy">複製陣列</button>
              </div>

              <fieldset className="feed-tag-fieldset">
                <legend id="feed-tag-builder-title" data-feed-i18n="category.legend">分類 Title</legend>
                <div className="feed-tag-options" id="product-feed-tag-options">
                  <p data-feed-i18n="category.initial">輸入國家與產品線，再按「取得分類 Title」。</p>
                </div>
              </fieldset>

              <div className="feed-tag-actions">
                <button type="button" id="product-feed-select-all" data-feed-i18n="actions.selectAll" disabled>全選</button>
                <button type="button" id="product-feed-clear-tags" data-feed-i18n="actions.clear" disabled>清除</button>
                <button type="button" id="product-feed-render" data-feed-i18n="actions.load" disabled>載入所選產品 Demo</button>
              </div>
            </section>

            <div className="feed-demo-runtime">
              <div>
                <span data-feed-i18n="runtime.label">渲染目標</span>
                <strong data-feed-i18n="runtime.description">API 成功後才替換下方內容</strong>
              </div>
              <ol id="product-feed-log" aria-live="polite">
                <li data-feed-i18n="runtime.initial">目前為原始靜態內容</li>
              </ol>
            </div>

            <div
              className="slider__Laptops is-slider-ready"
              id="product-feed-demo"
              aria-label="MSI Product Feed Demo 結果"
            >
              <div className="slider__Laptops-box slider__Laptops-box--static">
                <div className="slider__Laptops-item">
                  <div className="feed-static-art" aria-hidden="true" data-feed-i18n="static.badge">靜態內容</div>
                  <span className="product-label" data-feed-i18n="static.current">目前頁面</span>
                  <h4 data-feed-i18n="static.title">原本正在運作的靜態產品內容</h4>
                  <p data-feed-i18n="static.description">資料載入失敗時，這個區塊不會被清除或解除初始化。</p>
                  <a href="#live-demo"><span data-feed-i18n="static.waiting">等待 API</span></a>
                </div>
              </div>
            </div>
          </section>
        </article>
      </div>

      <footer className="feed-doc__footer">
        <span>MSI Product Feed · Internal usage guide</span>
        <div><Link href="/">所有工具</Link><a href="#top">回到頁首 ↑</a></div>
      </footer>

      <Script type="module" src="/tools/product-feed/demo.js" strategy="afterInteractive" />
    </main>
  );
}
