import {
  flattenFilterTags,
  MSIProductFeed,
  MSIProductFeedError,
  toPlainText,
} from "./msi-product-feed.js";

const PRODUCT_CARD_TEMPLATE = `<div class="slider__Laptops-box">
  <div class="slider__Laptops-item">
    <img src="{img}" alt="{title}">
    <span class="product-label">{label}</span>
    <h4>{title}</h4>
    <p>{subname}</p>
    <a href="{link}" target="_blank"><span>Learn More</span></a>
  </div>
</div>`;

const form = document.querySelector("#product-feed-controls");
const status = document.querySelector("#product-feed-status");
const log = document.querySelector("#product-feed-log");
const tagSubmitButton = document.querySelector("#product-feed-tag-submit");
const tagOptions = document.querySelector("#product-feed-tag-options");
const tagArray = document.querySelector("#product-feed-tag-array");
const tagCount = document.querySelector("#product-feed-tag-count");
const selectAllButton = document.querySelector("#product-feed-select-all");
const clearTagsButton = document.querySelector("#product-feed-clear-tags");
const renderButton = document.querySelector("#product-feed-render");
let activeFeed = null;
let tagRequest = null;

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

function selectedTagTitles() {
  if (!tagOptions) return [];
  return [...tagOptions.querySelectorAll('input[type="checkbox"]:checked')]
    .map((input) => input.value);
}

function updateTagArray() {
  const selected = selectedTagTitles();
  if (tagArray) tagArray.textContent = JSON.stringify(selected, null, 2);
  if (tagCount) tagCount.textContent = `已選擇 ${selected.length} 項`;
  if (renderButton) renderButton.disabled = selected.length === 0;
}

function setTagButtonsEnabled(enabled) {
  if (selectAllButton) selectAllButton.disabled = !enabled;
  if (clearTagsButton) clearTagsButton.disabled = !enabled;
  if (!enabled && renderButton) renderButton.disabled = true;
}

function resetTagOptions(message = "請重新取得分類 Title。") {
  tagRequest?.abort();
  tagRequest = null;
  tagOptions?.replaceChildren();
  if (tagOptions) {
    const empty = document.createElement("p");
    empty.textContent = message;
    tagOptions.append(empty);
  }
  setTagButtonsEnabled(false);
  updateTagArray();
}

function renderTagOptions(tags) {
  if (!tagOptions) return;
  const titles = [...new Set(tags.map((tag) => tag.title.trim()).filter(Boolean))]
    .sort((left, right) =>
      toPlainText(left).localeCompare(toPlainText(right), "en", { sensitivity: "base" })
    );

  tagOptions.replaceChildren();
  for (const [index, title] of titles.entries()) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");
    input.type = "checkbox";
    input.name = "selectedTagTitles";
    input.value = title;
    input.id = `product-feed-tag-${index}`;
    input.addEventListener("change", updateTagArray);
    text.textContent = toPlainText(title);
    label.title = title;
    label.append(input, text);
    tagOptions.append(label);
  }

  setTagButtonsEnabled(titles.length > 0);
  updateTagArray();
}

async function requestTagTitles(country, productLine, signal) {
  const url = new URL("/api/tools/product-feed", globalThis.location.origin);
  url.searchParams.set("endpoint", "tags");
  url.searchParams.set("country", country);
  url.searchParams.set("product_line", productLine);
  const response = await fetch(url, {
    signal,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new MSIProductFeedError(
      "INVALID_RESPONSE",
      "Product API Proxy 沒有回傳有效 JSON。",
    );
  }

  if (!response.ok) {
    throw new MSIProductFeedError(
      "HTTP_ERROR",
      payload?.status?.response || `MSI product API returned HTTP ${response.status}.`,
    );
  }

  if (Number(payload?.status?.code) !== 200) {
    throw new MSIProductFeedError(
      "API_ERROR",
      payload?.status?.response || "MSI product API returned an error.",
    );
  }

  const filterTagList = payload?.result?.filterTagList;
  if (!Array.isArray(filterTagList)) {
    throw new MSIProductFeedError(
      "INVALID_TAG_RESPONSE",
      "MSI tag API response is missing result.filterTagList.",
    );
  }

  const tags = flattenFilterTags(filterTagList);
  if (tags.length === 0) {
    throw new MSIProductFeedError(
      "NO_TAGS",
      `找不到 ${country}.msi.com 的 Product Line「${productLine}」或分類資料。`,
      { country, productLine },
    );
  }

  return tags;
}

function getErrorMessage(error) {
  return error instanceof MSIProductFeedError
    ? `${error.code}: ${error.message}`
    : error?.message || "未知錯誤";
}

for (const button of document.querySelectorAll("[data-feed-copy]")) {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.feedCopy);
    if (!target) return;
    await navigator.clipboard.writeText(target.textContent ?? "");
    const original = button.textContent;
    button.textContent = "已複製";
    window.setTimeout(() => {
      button.textContent = original;
    }, 1400);
  });
}

for (const field of form?.querySelectorAll('[name="country"], [name="productLine"]') ?? []) {
  field.addEventListener("change", () => {
    resetTagOptions();
    setStatus("設定已變更，請重新取得分類", "");
  });
}

selectAllButton?.addEventListener("click", () => {
  for (const input of tagOptions?.querySelectorAll('input[type="checkbox"]') ?? []) {
    input.checked = true;
  }
  updateTagArray();
});

clearTagsButton?.addEventListener("click", () => {
  for (const input of tagOptions?.querySelectorAll('input[type="checkbox"]') ?? []) {
    input.checked = false;
  }
  updateTagArray();
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(form);
  const country = String(values.get("country") ?? "uk").trim().toLowerCase();
  const productLine = String(values.get("productLine") ?? "nb").trim().toLowerCase();

  resetTagOptions("正在讀取 API…");
  const currentRequest = new AbortController();
  tagRequest = currentRequest;
  tagSubmitButton?.setAttribute("disabled", "");
  setStatus("正在取得分類 Title…", "loading");

  try {
    const tags = await requestTagTitles(country, productLine, currentRequest.signal);
    if (tagRequest !== currentRequest) return;
    renderTagOptions(tags);
    setStatus(`已取得 ${tagOptions?.childElementCount ?? 0} 個分類 Title`, "ready");
  } catch (error) {
    if (currentRequest.signal.aborted) return;
    const message = getErrorMessage(error);
    resetTagOptions(`無法取得分類：${message}`);
    setStatus(message, "error");
  } finally {
    if (tagRequest === currentRequest) tagRequest = null;
    tagSubmitButton?.removeAttribute("disabled");
  }
});

renderButton?.addEventListener("click", async () => {
  const values = new FormData(form);
  const tagTitles = selectedTagTitles();
  if (tagTitles.length === 0) return;

  activeFeed?.destroy();
  log?.replaceChildren();
  renderButton.disabled = true;
  setStatus("正在載入所選產品…", "loading");
  appendLog("以勾選的 tagTitles 呼叫 Product API", "loading");

  activeFeed = new MSIProductFeed({
    productLine: String(values.get("productLine") ?? "nb").trim().toLowerCase(),
    country: String(values.get("country") ?? "uk").trim().toLowerCase(),
    tagTitles,
    sort: "default",
    pageSize: 99,
    target: "#product-feed-demo",
    html: PRODUCT_CARD_TEMPLATE,
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
    const message = getErrorMessage(error);
    setStatus(message, "error");
    appendLog(`停止更新：${message}`, "error");
  } finally {
    renderButton.disabled = selectedTagTitles().length === 0;
  }
});

tagSubmitButton?.removeAttribute("disabled");
