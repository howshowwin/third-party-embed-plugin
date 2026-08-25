# MSI Privacy Embed Control

一個零依賴的瀏覽器 JavaScript 插件，用來在使用者同意前封鎖第三方 iframe 與 JavaScript SDK，並在同意或撤回時同步管理同一 provider 的所有嵌入實例。

## 安全前提

這個插件不是後端 allowlist 的替代品。正式環境應同時具備：

1. 後端只允許已核准的第三方來源。
2. 後端或 CMS 將嵌入內容輸出成不含 `iframe src` 的容器。
3. 第一方 HTTPS 路徑提供 provider manifest。
4. CSP `frame-src` 只允許核准 origin。
5. Manifest 載入或驗證失敗時維持封鎖。

不要先輸出帶有 `src` 的 iframe 再等待插件移除，因為瀏覽器可能已在插件執行前發出第三方請求。

## 文件中心架構

- `app/page.tsx`：工具文件首頁，從中央清單自動顯示所有 Tools。
- `lib/tools.ts`：工具文件中央清單；首頁名稱、說明、版本與路由都從這裡讀取。
- `app/tools/third-party-embed/page.tsx`：Third-party Embed Control 的完整使用手冊與 Demo 容器。
- `app/globals.css`：文件中心與各工具 Demo 網站樣式；由 Next.js 建置並由 Vercel 提供。
- `public/tools/third-party-embed/demo.js`：目前工具的 Demo 互動程式；只從 MSI Storage 匯入正式插件 JS。
- `public/og-guide.png`：Third-party Embed Control 文件使用的社群預覽圖片。
- `public/plugin/translations.json`：Demo 使用的本機翻譯檔。
- `public/third-party-providers.json`：Demo 使用的本機 Provider manifest。
- `public/plugin/msi-third-party-embed.js`：可獨立使用的 ESM 插件。
- `public/plugin/msi-third-party-embed.css`：插件 UI 樣式。

### 新增下一個 Tool

1. 在 `app/tools/<tool-slug>/page.tsx` 建立該工具的文件與 Demo 頁面。
2. 在 `lib/tools.ts` 的 `toolDocuments` 增加一筆資料。
3. 將該工具專用的瀏覽器程式與靜態資料放在 `public/tools/<tool-slug>/`，避免和其他 Tool 混用。

完成後首頁會自動出現新工具，不需要修改首頁元件。共用的頁面外框或元件可放在 `components/docs/`；只有該工具使用的元件則留在自己的路由資料夾內。

Demo 網站只有以下兩個正式插件檔案從 MSI Storage 載入：

- `https://storage-asset.msi.com/event/msi-third-party-embed/plugin/msi-third-party-embed.min.js`
- `https://storage-asset.msi.com/event/msi-third-party-embed/plugin/msi-third-party-embed.min.css`

## 啟動

```bash
npm install
copy .env.example .env.local
npm run dev
```

在 `.env.local` 將 `SITE_ACCESS_PASSWORD` 設為內部約定的密碼，再瀏覽 `http://localhost:3000`。

## 手冊存取保護

手冊使用伺服器端密碼閘門；未通過驗證時不會渲染正式頁面或提供 Demo JSON／JavaScript。驗證成功後只建立瀏覽器工作階段有效的 `HttpOnly` Cookie，關閉瀏覽器後需重新登入。

請勿將正式密碼寫入原始碼或提交至 GitHub。在 Vercel 專案的 **Settings → Environment Variables** 新增：

```text
SITE_ACCESS_PASSWORD=你的內部存取密碼
```

Production、Preview、Development 環境可依需要分別設定。變更環境變數後必須重新部署才會生效。

這是用於內部手冊的輕量防護，可以阻擋一般爬蟲與未授權瀏覽，但不取代公司 SSO、Vercel Deployment Protection、WAF 或完整帳號權限系統。

## 部署到 Vercel

這是標準 Next.js 專案，不需要再輸出 HTML 或 `demo-render.min.js`。

1. 將專案資料夾推送到 Git repository。
2. 在 Vercel 選擇 **Add New → Project** 並匯入 repository。
3. Framework Preset 選擇 **Next.js**；Build Command 與 Output Directory 使用 Vercel 預設值。
4. 在 Environment Variables 設定 `SITE_ACCESS_PASSWORD`。
5. 部署後，Vercel 會自動執行 `npm run build`。

如需讓 Open Graph 網址固定使用正式網域，可在 Vercel Environment Variables 設定：

```text
NEXT_PUBLIC_SITE_URL=https://your-demo-domain.example
```

未設定時會自動使用 Vercel 的正式 Production URL。

## 建置可上傳的正式插件檔案

執行：

```bash
npm run build:plugin
```

將產生：

- `dist/client/plugin/msi-third-party-embed.min.js`
- `dist/client/plugin/msi-third-party-embed.min.css`

這兩個 `.min` 檔可直接上傳至靜態資源伺服器。未壓縮的 JS 與 CSS 仍會保留在相同資料夾，供除錯使用。

## Provider manifest

```json
{
  "schemaVersion": 1,
  "consentVersion": "2026-08-v1",
  "manifestVersion": "2026-08-11.2",
  "providers": [
    {
      "id": "youku-video",
      "serviceName": "YOUKU Video",
      "companyName": "优酷信息技术（北京）有限公司",
      "allowedFrameOrigins": [
        "https://player.youku.com"
      ],
      "purpose": {
        "id": "embedded-video",
        "label": "播放由 YOUKU 提供的外部影音內容"
      },
      "privacyPolicyUrl": "https://terms.alicdn.com/legal-agreement/terms/privacy_policy_full/20231103155002859/20231103155002859.html",
      "consentRequired": true
    }
  ]
}
```

重要欄位：

- `id`：寫入 consent cookie 的簡短 providerId。
- `consentVersion`：同意政策有重大變更時更新；版本不符會安全地視為未同意。
- `manifestVersion`：供稽核與事件紀錄使用。
- `allowedFrameOrigins`：允許 iframe 使用的完整 origin。
- `allowedScriptOrigins`：特殊 adapter 可以載入 script 的完整 origin。
- `$self`：僅供第一方同 origin 資源使用。
- `purpose`：使用者同意的具體目的。

正式 manifest 建議由與後端 allowlist 相同的資料來源產生，避免兩份設定漂移。

## 初始化

```html
<link rel="stylesheet" href="https://storage-asset.msi.com/event/msi-third-party-embed/plugin/msi-third-party-embed.min.css">

<script type="module">
  import { MSIThirdPartyEmbedControl } from "https://storage-asset.msi.com/event/msi-third-party-embed/plugin/msi-third-party-embed.min.js";

  const control = new MSIThirdPartyEmbedControl({
    manifestUrl: "https://storage-asset.msi.com/event/msi-third-party-embed/third-party-providers.json",
    translationsUrl: "https://storage-asset.msi.com/event/msi-third-party-embed/plugin/translations.json",
    locale: "auto",
    cookieName: "msi_thirdPartyCookieControl",
    cookieMaxAgeDays: 180,
    onConsentChange(event) {
      // 可在此傳送最小化的後端稽核紀錄。
      console.log(event);
    }
  });

  await control.init();
</script>
```

`locale` 預設為 `auto`，會讀取目前 hostname 的第一段子網域：`jp.msi.com` 使用 `jp`、`tw.msi.com` 使用 `tw`。插件會先比對完整站點代碼（例如 `arg`、`ca-fr`、`latam`），再回退至前兩碼；`www`、`mtc`、localhost、未知代碼或無法解析時一律使用英文。也可手動指定標準語系碼或市場名稱覆寫自動判斷。

Cookie 採用精簡格式，只保存 consent version 與允許的 providerId：

```json
{
  "v": "2026-08-v1",
  "a": ["youku-video", "sideqik-promotions"]
}
```

同意介面會說明此第一方偏好 Cookie 的名稱與保存天數。沒有任何已允許 Provider 時會刪除 Cookie；預設保存 180 天，自訂期限最多限制為 400 天。

## 一般 iframe

HTML 只提供 inert target：

```html
<div id="video-slot"></div>
```

內容維護人員建立設定物件：

```js
await control.create({
  id: "youku-video-example",
  type: "iframe",
  providerId: "youku-video",
  url: "https://player.youku.com/embed/YOUR_YOUKU_VID?client_id=YOUR_CLIENT_ID",
  title: "YOUKU 影片",
  target: "#demo-0",
  allow: "autoplay; encrypted-media; fullscreen; picture-in-picture"
});
```

若沒有指定 `providerId`，插件會解析 URL 並以完整 `origin` 對照 `allowedFrameOrigins`。不允許 substring 網域比對。

## 特殊 DIV＋JavaScript SDK

最簡單的使用方式就是把供應商內容拆成 `html`、`css`、`js`：

```js
await control.create({
  type: "snippet",
  providerId: "metrics-provider",
  target: "#demo-6",

  html: `
    <div
      class="metrics-widget"
      data-metric-id="{{metricId}}">
    </div>
  `,

  css: `.metrics-widget { min-height: 420px; }`,

  js: [
    // 原本的 inline JS 用函式包住
    ({ global }) => {
      global.metricsQueue = global.metricsQueue || [];
    },

    // 原本的 <script src="...">
    "https://widgets.example.com/sdk.js"
  ],

  options: {
    metricId: "health"
  }
});
```

插件執行順序如下：

1. 未同意時不插入 `html`，也不載入 `scripts`。
2. 同意後插入 HTML，`{{metricId}}` 會以跳脫後的 `options.metricId` 代入。
3. 插入 `css`；其中的外部資源仍須來自核准 origin，且不接受 `@import`。
4. 依 `js` 陣列順序執行：函式代表 inline JS，URL 或 `{ src }` 代表外部 script。
5. 如有進階 `mount()`，再執行 mount。
6. 撤回 iframe provider：立即移除同 provider 的所有 iframe。
7. 撤回 snippet/custom provider：先更新 Cookie，再重新整理頁面；重整後 SDK 不會再次載入。

Sideqik、Gleam、Instagram 與 Facebook 的 SDK／掛載方式已內建在主套件。
每個頁面只需要放入服務提供的 HTML，不需自行載入第三方 `<script>`。

Sideqik：

```js
await control.create({
  type: "snippet",
  providerId: "sideqik-promotions",
  target: "#demo-1",
  html: `
    <div class="sideqik-promotion" data-token="de9Cjo6b"
      data-promotion-url="https://sdqk.me/p/…"></div>
  `
});
```

Gleam：

```js
await control.create({
  type: "snippet",
  providerId: "gleam-competitions",
  target: "#demo-2",
  html: `
    <div class="giveaway__embed-placeholder">
      <a class="e-widget generic-loader"
        href="https://gleam.io/GcEwF/excellence-refined-giveaway"
        rel="nofollow">Excellence Refined Giveaway</a>
    </div>
  `
});
```

Instagram 會在取得同意後把 permalink 轉成 `embed/captioned` iframe，顯示貼文說明與互動入口：

Facebook SDK 的 Graph API 版本集中定義為 `v25.0`，不要省略 `version` 參數，
否則 SDK 會回報 `invalid version specified`。

```js
await control.create({
  type: "snippet",
  providerId: "instagram-embeds",
  target: "#demo-3",
  html: `
    <blockquote class="instagram-media"
      data-instgrm-permalink="https://www.instagram.com/p/Db3Eif_ASSQ/"
      data-instgrm-version="14"></blockquote>
  `
});

await control.create({
  type: "snippet",
  providerId: "facebook-embeds",
  target: "#demo-4",
  html: `
    <div class="fb-post"
      data-href="https://www.facebook.com/story.php?story_fbid=1016192431171299&amp;id=100083416537348"
      data-width="500"
      data-show-text="true"></div>
  `
});
```

`html` 不能包含 `<script>`、`iframe`、`object`、`embed`、inline `onclick` 或 CSS `url()`；這些內容可能自行發出請求或執行程式。iframe 應使用 `type: "iframe"`，外部 JS 應使用 `scripts`。

`html`、`css` 與函式型 `js` 都屬於受信任的應用程式碼，不是 HTML sandbox。只允許由開發團隊審核後寫入版本庫；不得直接把 CMS、URL 參數、表單或其他未受信任輸入傳入。第三方 CSS 仍可能影響宿主頁面，正式整合前應檢查 selector 範圍，必要時使用 provider 專用 adapter 或隔離 iframe。

### 可重複使用的中央 Adapter

如果同一套供應商 snippet 會在很多頁面重複使用，可以由開發者先註冊 adapter，讓內容維護人員只需要提供 `options`。一般內容編輯者不應直接註冊任意 adapter code。

假設供應商原本提供：

```html
<div class="metrics-widget" data-metric-id="health"></div>
<script src="https://widgets.example.com/sdk.js"></script>
<script>
  MetricsSDK.mount(document.querySelector(".metrics-widget"));
</script>
```

若要轉成中央 adapter，仍依序拆成：

- 原始 DIV → `prepare()`
- 外部 `<script src>` → `load()`
- inline 初始化程式 → `mount()`
- 供應商 destroy API → `unmount()`

```js
control.registerAdapter("metrics-widget", {
  providerIds: ["metrics-provider"],

  prepare({ container, options }) {
    const widget = document.createElement("div");
    widget.className = "metrics-widget";
    widget.dataset.metricId = options.metricId;
    container.append(widget);
    return widget;
  },

  async load({ loadScript, prepared }) {
    // 此時供應商要求的 DIV 已經存在，才載入 SDK。
    await loadScript("https://widgets.example.com/sdk.js", {
      integrity: "sha384-...",
      crossorigin: "anonymous"
    });

    return window.MetricsSDK;
  },

  async mount({ prepared, options, loaded, signal }) {
    // signal 會在撤回同意時 abort，可傳給後續 fetch/API。
    return loaded.mount(prepared, {
      ...options,
      signal
    });
  },

  async unmount({ mountResult }) {
    await mountResult.destroy();
  }
});
```

內容維護人員只需要選擇已註冊的 provider 與 adapter：

```js
await control.create({
  id: "product-metrics",
  type: "custom",
  providerId: "metrics-provider",
  adapter: "metrics-widget",
  target: "#demo-6",
  options: {
    metricId: "product-health"
  }
});
```

進階 Adapter 生命週期：

1. 未同意：只顯示第一方 placeholder。
2. 同意：呼叫 `prepare()` 建立供應商要求的 inert DIV。
3. 呼叫 `load()` 載入核准 origin 的 SDK。
4. SDK 完成：呼叫每個實例的 `mount()` 與後續 API。
5. `mount()` 可回傳 cleanup function、含 `unmount()` 的物件，或由 adapter 提供 `unmount()`。
6. 預設撤回：更新 Cookie 後重新整理頁面。

`providerIds` 將 adapter 限制在指定的核准服務，避免內容設定把某個 SDK adapter 與錯誤的 provider 組合。

第三方 script 一旦執行，瀏覽器無法真正「反執行」程式碼。因此插件預設在撤回 snippet/custom provider 時重新整理頁面。只有明確設定 `reloadOnCustomRevoke: false` 時，才必須依賴 adapter 的 destroy/unmount API 完整停止計時器、事件監聽與 API 工作。

如果供應商 SDK 只會在 `<script>` 第一次執行時自動掃描 DIV，卻沒有 `mount()`、`scan()` 或 `refresh()` API，就無法可靠建立第二個動態實例。這種 SDK 必須由該 provider 的專用 adapter 特別處理，必要時限制每頁只能一個實例。

## 同意與撤回 API

```js
await control.grant("youku-video");
await control.revoke("youku-video");
await control.revokeAll();

control.hasConsent("youku-video");
control.getAllowedProviderIds();
control.getConsentCookieSize();
control.openSettings();
```

同意或撤回會同步處理頁面上所有相同 providerId 實例。

事件：

```js
control.addEventListener("consentchange", ({ detail }) => {
  console.log(detail.providerId);
  console.log(detail.action); // granted | revoked
  console.log(detail.consentVersion);
  console.log(detail.manifestVersion);
});

document.addEventListener("msi:third-party-consent-change", ({ detail }) => {
  console.log(detail);
});
```

## Production checklist

- Manifest 使用第一方 HTTPS URL，並限制 CORS。
- 後端與前端使用同一份核准 provider 資料。
- CSP `frame-src`、`script-src` 與核准來源一致。
- 不允許一般內容編輯者傳入任意 adapter code、script URL 或 raw HTML。
- 自訂 HTML / CSS / JS 必須經 code review；第三方 CSS selector 不得污染宿主頁面。
- Placeholder 圖片、字型與其他資源同樣不得在同意前連線到第三方。
- 撤回入口同時存在於每個已載入元件下方與全站設定中心。
- 設定 cookie 不兼作分析、廣告或跨站識別。
- Consent cookie 超過 3500 bytes 前改用後端 receipt 或其他第一方偏好儲存。
- 保存當時的 manifest、UI 文案與版本，以支援 consent 稽核。
- 對無法完整 unmount 的第三方 SDK 建立撤回後重新整理策略。

這是一份技術參考實作，不取代 DPO 或目標市場法務的最終合規審查。
