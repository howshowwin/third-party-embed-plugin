(function installMockAtlasSdk(global) {
  if (global.AtlasMetricsDemo) return;

  const activeWidgets = new Set();

  function wait(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, milliseconds);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("The request was cancelled.", "AbortError"));
        },
        { once: true },
      );
    });
  }

  global.AtlasMetricsDemo = {
    async mount(container, options, signal) {
      const root = document.createElement("article");
      root.className = "atlas-widget";
      root.innerHTML = `
        <div class="atlas-widget__topline">
          <span>ATLAS / LIVE API</span>
          <span class="atlas-widget__signal">connecting</span>
        </div>
        <div class="atlas-widget__value">—</div>
        <div class="atlas-widget__label"></div>
        <div class="atlas-widget__chart" aria-label="模擬最近七日資料圖表"></div>
        <p class="atlas-widget__note">SDK 已載入，正在等待模擬 API 回應。</p>
      `;

      root.querySelector(".atlas-widget__label").textContent =
        options.metricLabel ?? "服務健康指數";
      container.replaceChildren(root);

      const widget = { root, interval: null, disposed: false };
      activeWidgets.add(widget);

      await wait(850, signal);
      if (widget.disposed || signal?.aborted) {
        throw new DOMException("The request was cancelled.", "AbortError");
      }

      const values = options.values ?? [68, 74, 72, 81, 78, 86, 92];
      const chart = root.querySelector(".atlas-widget__chart");
      const max = Math.max(...values);

      values.forEach((value, index) => {
        const bar = document.createElement("span");
        bar.style.height = `${Math.max(10, (value / max) * 100)}%`;
        bar.style.animationDelay = `${index * 60}ms`;
        bar.setAttribute("aria-hidden", "true");
        chart.append(bar);
      });

      root.querySelector(".atlas-widget__value").textContent = String(
        values.at(-1),
      );
      root.querySelector(".atlas-widget__signal").textContent = "connected";
      root.querySelector(".atlas-widget__note").textContent =
        "模擬 API 已成功回傳；撤回同意時，計時器與元件會一併卸載。";

      widget.interval = setInterval(() => {
        if (widget.disposed) return;
        const valueNode = root.querySelector(".atlas-widget__value");
        const next = 88 + Math.floor(Math.random() * 8);
        valueNode.textContent = String(next);
      }, 3500);

      return widget;
    },

    unmount(widget) {
      if (!widget || widget.disposed) return;
      widget.disposed = true;
      clearInterval(widget.interval);
      widget.root.remove();
      activeWidgets.delete(widget);
    },

    activeCount() {
      return activeWidgets.size;
    },
  };
})(window);
