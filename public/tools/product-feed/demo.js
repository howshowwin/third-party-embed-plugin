import {
  MSIProductFeed,
  MSIProductFeedError,
} from "./msi-product-feed.js";

const form = document.querySelector("#product-feed-controls");
const status = document.querySelector("#product-feed-status");
const log = document.querySelector("#product-feed-log");
const submitButton = form?.querySelector('button[type="submit"]');
let activeFeed = null;

function appendLog(message, state = "") {
  if (!log) return;
  const item = document.createElement("li");
  item.textContent = message;
  if (state) item.dataset.state = state;
  log.append(item);
}

function setStatus(message, state = "") {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

for (const button of document.querySelectorAll("[data-feed-copy]")) {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.feedCopy);
    if (!target) return;
    await navigator.clipboard.writeText(target.textContent ?? "");
    button.textContent = "已複製";
    window.setTimeout(() => {
      button.textContent = "複製";
    }, 1400);
  });
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(form);
  const tagTitles = String(values.get("tagTitles") ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  activeFeed?.destroy();
  log?.replaceChildren();
  submitButton?.setAttribute("disabled", "");
  setStatus("正在解析 Product Tag…", "loading");
  appendLog("呼叫 getProductTagList", "loading");

  activeFeed = new MSIProductFeed({
    productLine: String(values.get("productLine") ?? "nb"),
    country: String(values.get("country") ?? ""),
    tagTitles,
    sort: String(values.get("sort") ?? "default"),
    pageSize: 99,
    target: "#product-feed-demo",
    html: String(values.get("html") ?? ""),
    proxyUrl: "/api/tools/product-feed",
    before({ target, products }) {
      setStatus("正在替換原始產品…", "loading");
      appendLog(`before：解除舊 Slider 狀態，準備 ${products.length} 筆產品`);
      target.classList.remove("is-slider-ready");

      if (globalThis.jQuery && globalThis.jQuery(target).hasClass("slick-initialized")) {
        globalThis.jQuery(target).slick("unslick");
      }
    },
    after({ target, products, error, failedPhase }) {
      if (error) {
        appendLog(`after：${failedPhase} 失敗，保留頁面自行恢復的機會`, "error");
        return;
      }

      target.classList.add("is-slider-ready");
      appendLog(`after：新 Slider 已就緒，共 ${products.length} 筆產品`, "ready");
    },
  });

  try {
    const result = await activeFeed.init();
    setStatus(`完成：顯示 ${result.products.length} 筆產品`, "ready");
    appendLog(`精確比對 ${result.matchedTags.length} 個 Tag，IDs：${result.ids.join(", ")}`);
    appendLog("Product API 與 HTML 模板渲染完成", "ready");
  } catch (error) {
    const message = error instanceof MSIProductFeedError
      ? `${error.code}: ${error.message}`
      : error?.message || "未知錯誤";
    setStatus(message, "error");
    appendLog(`停止更新：${message}`, "error");
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});
