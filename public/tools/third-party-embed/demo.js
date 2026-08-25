import { MSIThirdPartyEmbedControl } from "https://storage-asset.msi.com/event/msi-third-party-embed/plugin/msi-third-party-embed.min.js";

const activityLog = document.querySelector("#activity-log");
const consentList = document.querySelector("#consent-list");
const cookieSize = document.querySelector("#cookie-size");
const manifestState = document.querySelector("#manifest-state");
const settingsButtons = document.querySelectorAll("[data-open-settings]");
const copyButtons = document.querySelectorAll("[data-copy-target]");

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
  locale: "auto",
  manifestUrl: "/third-party-providers.json",
  translationsUrl: "/plugin/translations.json",
  cookieName: "msi_thirdPartyCookieControl",
  cookieMaxAgeDays: 180,
  onConsentChange(detail) {
    addLog(
      `${detail.providerId}：${detail.action === "granted" ? "已允許" : "已撤回"}${detail.willReload ? "；頁面即將重新整理" : ""}`,
      detail.action === "granted" ? "success" : "warning",
    );
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
        id: "youku-player",
        type: "iframe",
        providerId: "youku-video",
        url: "https://player.youku.com/embed/XMzg0MTE2NjAxNg==",
        title: "YOUKU 嵌入影片示範",
        target: "#demo-0",
        allow: "autoplay; encrypted-media; fullscreen; picture-in-picture",
      }),
      control.create({
        id: "sideqik-promotion",
        type: "snippet",
        providerId: "sideqik-promotions",
        target: "#demo-1",
        html: `
          <div class="sideqik-promotion" data-token="de9Cjo6b"
            data-promotion-url="https://sdqk.me/p/the-desk-my-stage-aug-2026_hq-de9Cjo6b"></div>
        `,
      }),
      control.create({
        id: "gleam-giveaway",
        type: "snippet",
        providerId: "gleam-competitions",
        target: "#demo-2",
        html: `
          <div class="giveaway__embed-placeholder">
            <a class="e-widget generic-loader"
              href="https://gleam.io/GcEwF/excellence-refined-giveaway"
              rel="nofollow">
              Excellence Refined Giveaway
            </a>
          </div>
        `,
      }),
      control.create({
        id: "instagram-post",
        type: "snippet",
        providerId: "instagram-embeds",
        target: "#demo-3",
        html: `
          <blockquote class="instagram-media"
            data-instgrm-permalink="https://www.instagram.com/p/Db3Eif_ASSQ/"
            data-instgrm-version="14">
          </blockquote>
        `,
      }),
      control.create({
        id: "facebook-post",
        type: "snippet",
        providerId: "facebook-embeds",
        target: "#demo-4",
        html: `
          <div class="fb-post"
            data-href="https://www.facebook.com/story.php?story_fbid=1016192431171299&amp;id=100083416537348"
            data-width="500"
            data-show-text="true">
          </div>
        `,
      }),
    ]);

    settingsButtons.forEach((button) => {
      button.addEventListener("click", () => control.openSettings());
    });

    copyButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const target = document.getElementById(button.dataset.copyTarget);
        if (!target) return;
        try {
          await navigator.clipboard.writeText(target.textContent ?? "");
          button.textContent = "已複製";
          button.dataset.copied = "true";
          window.setTimeout(() => {
            button.textContent = "複製";
            delete button.dataset.copied;
          }, 1600);
        } catch {
          addLog("無法存取剪貼簿，請手動選取程式碼", "warning");
        }
      });
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
