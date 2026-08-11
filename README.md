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

## 專案內容

- `public/plugin/msi-third-party-embed.js`：可獨立使用的 ESM 插件。
- `public/plugin/msi-third-party-embed.css`：插件 UI 樣式。
- `public/third-party-providers.json`：線上 provider manifest 範例。
- `public/demo/demo.js`：一般 iframe 與特殊 SDK 的完整整合示範。
- `public/demo/mock-atlas-sdk.js`：支援非同步 API 與 unmount 的模擬 SDK。
- `app/page.tsx`：互動式 Demo 頁面。

## 啟動

```bash
npm install
npm run dev
```

瀏覽 `http://localhost:3000`。

## Provider manifest

```json
{
  "schemaVersion": 1,
  "consentVersion": "2026-08-v1",
  "manifestVersion": "2026-08-11.1",
  "providers": [
    {
      "id": "youtube",
      "serviceName": "YouTube",
      "companyName": "Google Ireland Limited",
      "allowedFrameOrigins": [
        "https://www.youtube-nocookie.com"
      ],
      "purpose": {
        "id": "embedded-video",
        "label": "播放由 YouTube 提供的外部影音內容"
      },
      "privacyPolicyUrl": "https://policies.google.com/privacy",
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
<link rel="stylesheet" href="/plugin/msi-third-party-embed.css">

<script type="module">
  import { MSIThirdPartyEmbedControl } from "/plugin/msi-third-party-embed.js";

  const control = new MSIThirdPartyEmbedControl({
    manifestUrl: "/third-party-providers.json",
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

Cookie 採用精簡格式，只保存 consent version 與允許的 providerId：

```json
{
  "v": "2026-08-v1",
  "a": ["youtube", "atlas-metrics-demo"]
}
```

## 一般 iframe

HTML 只提供 inert target：

```html
<div id="video-slot"></div>
```

設計師建立設定物件：

```js
await control.create({
  id: "product-video",
  type: "iframe",
  url: "https://www.youtube-nocookie.com/embed/VIDEO_ID",
  title: "產品介紹影片",
  target: "#video-slot",
  allow: "encrypted-media; picture-in-picture"
});
```

若沒有指定 `providerId`，插件會解析 URL 並以完整 `origin` 對照 `allowedFrameOrigins`。不允許 substring 網域比對。

## 特殊 DIV＋JavaScript SDK

特殊嵌入必須由開發者註冊 adapter。一般內容編輯者不能直接傳入任意 script 或 HTML。

```js
control.registerAdapter("metrics-widget", {
  async load({ loadScript }) {
    await loadScript("https://widgets.example.com/sdk.js", {
      integrity: "sha384-...",
      crossorigin: "anonymous"
    });

    return window.MetricsSDK;
  },

  async mount({ container, options, loaded, signal }) {
    // signal 會在撤回同意時 abort，可傳給後續 fetch/API。
    return loaded.mount(container, {
      ...options,
      signal
    });
  },

  async unmount({ mountResult }) {
    await mountResult.destroy();
  }
});
```

設計師只需要選擇已註冊的 provider 與 adapter：

```js
await control.create({
  id: "product-metrics",
  type: "custom",
  providerId: "metrics-provider",
  adapter: "metrics-widget",
  target: "#metric-slot",
  options: {
    metricId: "product-health"
  }
});
```

Adapter 生命週期：

1. 未同意：只顯示第一方 placeholder。
2. 同意：呼叫一次 `load()` 載入核准 origin 的 SDK。
3. SDK 完成：呼叫每個實例的 `mount()`。
4. `mount()` 可回傳 cleanup function、含 `unmount()` 的物件，或由 adapter 提供 `unmount()`。
5. 撤回：abort `signal`、呼叫 cleanup、移除容器並還原 placeholder。

第三方 script 一旦執行，瀏覽器無法真正「反執行」程式碼。因此 adapter 必須使用供應商提供的 destroy/unmount API，停止計時器、事件監聽與 API 工作。對於沒有清理能力的 SDK，正式環境應考慮撤回後重新整理頁面。

## 同意與撤回 API

```js
await control.grant("youtube");
await control.revoke("youtube");
await control.revokeAll();

control.hasConsent("youtube");
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
- 不允許設計師傳入任意 adapter code、script URL 或 raw HTML。
- Placeholder 圖片、字型與其他資源同樣不得在同意前連線到第三方。
- 撤回入口同時存在於每個已載入元件下方與全站設定中心。
- 設定 cookie 不兼作分析、廣告或跨站識別。
- Consent cookie 超過 3500 bytes 前改用後端 receipt 或其他第一方偏好儲存。
- 保存當時的 manifest、UI 文案與版本，以支援 consent 稽核。
- 對無法完整 unmount 的第三方 SDK 建立撤回後重新整理策略。

這是一份技術參考實作，不取代 DPO 或目標市場法務的最終合規審查。
