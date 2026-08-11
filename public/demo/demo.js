import { MSIThirdPartyEmbedControl } from "/plugin/msi-third-party-embed.js";

const activityLog = document.querySelector("#activity-log");
const consentList = document.querySelector("#consent-list");
const cookieSize = document.querySelector("#cookie-size");
const manifestState = document.querySelector("#manifest-state");
const settingsButtons = document.querySelectorAll("[data-open-settings]");

function addLog(message, tone = "neutral") {
  const item = document.createElement("li");
  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  const text = document.createElement("span");
  text.textContent = message;
  item.dataset.tone = tone;
  item.append(time, text);
  activityLog.prepend(item);
}

const control = new MSIThirdPartyEmbedControl({
  manifestUrl: "/third-party-providers.json",
  cookieName: "msi_thirdPartyCookieControl",
  cookieMaxAgeDays: 180,
  onConsentChange(detail) {
    addLog(
      `${detail.providerId}：${detail.action === "granted" ? "已允許" : "已撤回"}`,
      detail.action === "granted" ? "success" : "warning",
    );
  },
});

control.registerAdapter("atlas-metrics", {
  providerIds: ["atlas-metrics-demo"],

  async load({ loadScript }) {
    await loadScript("/demo/mock-atlas-sdk.js");
    return window.AtlasMetricsDemo;
  },

  async mount({ container, options, loaded, signal }) {
    return loaded.mount(container, options, signal);
  },

  unmount({ mountResult }) {
    window.AtlasMetricsDemo?.unmount(mountResult);
  },
});

function renderConsentSummary() {
  const allowed = control.getAllowedProviderIds();
  consentList.replaceChildren();

  if (!allowed.length) {
    const empty = document.createElement("span");
    empty.className = "status-empty";
    empty.textContent = "尚未允許任何服務";
    consentList.append(empty);
  } else {
    allowed.forEach((providerId) => {
      const chip = document.createElement("span");
      chip.className = "status-chip";
      chip.textContent = providerId;
      consentList.append(chip);
    });
  }

  cookieSize.textContent = `${control.getConsentCookieSize()} bytes`;
}

control.addEventListener("consentchange", renderConsentSummary);
control.addEventListener("error", (event) => {
  addLog(event.detail.error?.message ?? "嵌入內容發生錯誤", "error");
});

async function boot() {
  try {
    await control.init();
    manifestState.textContent = `已載入 v${control.manifest.manifestVersion}`;
    manifestState.dataset.state = "ready";

    await Promise.all([
      control.create({
        id: "youtube-primary",
        type: "iframe",
        url: "https://www.youtube-nocookie.com/embed/jNQXAC9IVRw?rel=0",
        title: "YouTube 嵌入影片示範",
        target: "#youtube-primary",
        allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share",
      }),
      control.create({
        id: "youtube-secondary",
        type: "iframe",
        url: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?rel=0",
        title: "第二個 YouTube 嵌入影片示範",
        target: "#youtube-secondary",
        allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share",
      }),
      control.create({
        id: "atlas-widget",
        type: "custom",
        providerId: "atlas-metrics-demo",
        adapter: "atlas-metrics",
        target: "#atlas-widget",
        options: {
          metricLabel: "第三方 SDK 生命週期健康指數",
          values: [58, 64, 61, 75, 73, 84, 92],
        },
      }),
    ]);

    settingsButtons.forEach((button) => {
      button.addEventListener("click", () => control.openSettings());
    });

    document.querySelector("#revoke-all").addEventListener("click", async () => {
      await control.revokeAll();
      addLog("所有第三方內容同意均已撤回", "warning");
    });

    renderConsentSummary();
    addLog("插件初始化完成；第三方內容預設維持封鎖", "success");
  } catch (error) {
    manifestState.textContent = "載入失敗，已安全封鎖";
    manifestState.dataset.state = "error";
    addLog(error instanceof Error ? error.message : "初始化失敗", "error");
  }
}

boot();
