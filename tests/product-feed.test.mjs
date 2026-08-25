import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductUrl,
  createProductListUrl,
  createTagListUrl,
  flattenFilterTags,
  MSIProductFeed,
  MSIProductFeedError,
  normalizeProduct,
  renderProductTemplate,
  resolveMsiOrigin,
  resolveTagSelection,
  validateProductTemplate,
} from "../public/tools/product-feed/msi-product-feed.js";
import {
  PRODUCT_FEED_DEMO_DEFAULT_LOCALE,
  PRODUCT_FEED_DEMO_MESSAGES,
} from "../public/tools/product-feed/i18n.js";

const filterTagList = [
  {
    type: 14,
    tag: [
      { id: 9392, title: "Titan Series" },
      { id: 9393, title: "Stealth / Creator Series" },
    ],
  },
  {
    type_id: 18,
    tag: {
      level2: [
        {
          type: 144,
          tag: [{ id: 125270, title: "Raider Series" }],
        },
      ],
    },
  },
];

test("keeps Product Feed demo locale keys and placeholders aligned", () => {
  assert.equal(PRODUCT_FEED_DEMO_DEFAULT_LOCALE, "zh-TW");

  const chinese = PRODUCT_FEED_DEMO_MESSAGES["zh-TW"];
  const english = PRODUCT_FEED_DEMO_MESSAGES.en;
  const chineseKeys = Object.keys(chinese).sort();
  const englishKeys = Object.keys(english).sort();

  assert.deepEqual(englishKeys, chineseKeys);

  const placeholders = (message) =>
    [...message.matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
      .map((match) => match[1])
      .sort();

  for (const key of chineseKeys) {
    assert.deepEqual(
      placeholders(english[key]),
      placeholders(chinese[key]),
      `Translation placeholders differ for ${key}`,
    );
  }
});

function createApiFetcher(requests = []) {
  return async (url) => {
    requests.push(url);
    const endpoint = new URL(url).searchParams.get("endpoint");

    return {
      ok: true,
      status: 200,
      async json() {
        if (endpoint === "tags" || url.includes("getProductTagList")) {
          return {
            status: { code: 200, response: "ok" },
            result: { filterTagList },
          };
        }

        return {
          status: { code: 200, response: "ok" },
          result: {
            count: 1,
            getProductList: [
              {
                id: 1,
                title: "Titan 18 <sup>&reg;</sup><br>HX",
                subname: "RTX&trade; 50 Series",
                link: "Titan-18-HX",
                picture: "https://storage-asset.msi.com/product.webp",
                release: "2026-01-01 00:00:00",
                product_line: "Laptop",
                label: "NEW",
              },
            ],
          },
        };
      },
    };
  };
}

function createFakeDocument(target) {
  return {
    baseURI: "https://uk.msi.com/",
    querySelector(selector) {
      return selector === "#products" ? target : null;
    },
    createElement(name) {
      assert.equal(name, "template");
      const content = {
        html: "",
        querySelectorAll() {
          return [];
        },
      };
      return {
        content,
        set innerHTML(value) {
          content.html = value;
        },
      };
    },
  };
}

test("resolves configured and current MSI country origins", () => {
  assert.equal(resolveMsiOrigin("uk", "https://tw.msi.com/page"), "https://uk.msi.com");
  assert.equal(resolveMsiOrigin("mtc", "https://tw.msi.com/page"), "https://www.msi.com");
  assert.equal(resolveMsiOrigin("", "https://mtc.msi.com/page"), "https://www.msi.com");
  assert.equal(resolveMsiOrigin(undefined, "https://tw.msi.com/page"), "https://tw.msi.com");
  assert.throws(() => resolveMsiOrigin("../uk", "https://tw.msi.com"), {
    code: "INVALID_COUNTRY",
  });
});

test("flattens direct and nested API tag collections", () => {
  const tags = flattenFilterTags(filterTagList);
  assert.deepEqual(tags.map(({ id, title }) => ({ id, title })), [
    { id: 9392, title: "Titan Series" },
    { id: 9393, title: "Stealth / Creator Series" },
    { id: 125270, title: "Raider Series" },
  ]);
});

test("matches tag titles exactly and fails closed by default", () => {
  const selection = resolveTagSelection(filterTagList, [
    "Titan Series",
    "Raider Series",
  ]);
  assert.deepEqual(selection.ids, [9392, 125270]);
  assert.throws(
    () => resolveTagSelection(filterTagList, ["titan series"]),
    (error) => error instanceof MSIProductFeedError && error.code === "TAG_NOT_FOUND",
  );
});

test("builds encoded tag and product API URLs", () => {
  const tags = new URL(createTagListUrl("https://uk.msi.com", "nb"));
  assert.equal(tags.pathname, "/api/v1/product/getProductTagList");
  assert.equal(tags.searchParams.get("product_line"), "nb");

  const products = new URL(createProductListUrl("https://uk.msi.com", {
    productLine: "nb",
    pageNumber: 1,
    pageSize: 99,
    sort: "date",
    ids: [9392, 125270],
  }));
  assert.deepEqual(products.searchParams.getAll("id[]"), ["9392", "125270"]);
  assert.equal(products.searchParams.get("sort"), "date");
});

test("normalizes API HTML and creates localized product links", () => {
  const normalized = normalizeProduct({
    id: 1,
    title: "Titan <sup>&reg;</sup><br>HX",
    subname: "RTX&trade; 50",
    link: "Titan-18-HX",
    picture: "https://storage-asset.msi.com/product.webp",
    product_line: "Laptop",
  }, "https://uk.msi.com");

  assert.equal(normalized.titleText, "Titan ® HX");
  assert.equal(normalized.subnameText, "RTX™ 50");
  assert.equal(normalized.url, "https://uk.msi.com/Laptop/Titan-18-HX");
  assert.equal(
    buildProductUrl({ product_line: "Graphics Card", link: "RTX-5090" }, "https://tw.msi.com"),
    "https://tw.msi.com/Graphics%20Card/RTX-5090",
  );
});

test("escapes product data inserted into HTML templates", () => {
  const product = {
    id: 7,
    titleText: '<img src=x onerror="alert(1)">',
    subnameText: "RTX & more",
    url: "https://uk.msi.com/Product?a=1&b=2",
    picture: "https://storage-asset.msi.com/product.webp",
    release: "2026-01-01",
    productLine: "Laptop",
    label: "NEW",
  };
  const html = renderProductTemplate(
    '<a href="{link}"><img src="{img}" alt="{title}"><span>{title}</span></a>',
    product,
    0,
  );

  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /\?a=1&amp;b=2/);
  assert.doesNotMatch(html, /<img src=x onerror/);
  assert.throws(() => validateProductTemplate("<p>{unknown}</p>"), {
    code: "UNKNOWN_PLACEHOLDER",
  });
});

test("runs before, replaces the target, and then runs after", async () => {
  const calls = [];
  const requests = [];
  const target = {
    content: "static",
    replaceChildren(fragment) {
      calls.push("render");
      this.content = fragment.html;
    },
  };
  const feed = new MSIProductFeed({
    productLine: "nb",
    country: "uk",
    tagTitles: ["Titan Series"],
    target: "#products",
    html: '<a href="{link}"><img src="{img}" alt="{title}"><h4>{title}</h4></a>',
    proxyUrl: "/api/tools/product-feed",
    location: "https://demo.example/",
    document: createFakeDocument(target),
    fetcher: createApiFetcher(requests),
    before() {
      calls.push("before");
      assert.equal(target.content, "static");
    },
    after({ error }) {
      calls.push("after");
      assert.equal(error, null);
    },
  });

  const result = await feed.init();
  assert.deepEqual(calls, ["before", "render", "after"]);
  assert.equal(result.products[0].titleText, "Titan 18 ® HX");
  assert.match(target.content, /Titan 18 ® HX/);
  assert.equal(new URL(requests[0]).searchParams.get("endpoint"), "tags");
  assert.equal(new URL(requests[1]).searchParams.get("endpoint"), "products");
  assert.equal(new URL(requests[1]).searchParams.get("country"), "uk");
});

test("keeps existing content when API loading fails", async () => {
  const target = {
    content: "static",
    replaceChildren() {
      this.content = "changed";
    },
  };
  let beforeCalled = false;
  const feed = new MSIProductFeed({
    productLine: "nb",
    country: "uk",
    tagTitles: ["Titan Series"],
    target: "#products",
    html: "<div>{title}</div>",
    location: "https://uk.msi.com/",
    document: createFakeDocument(target),
    before() {
      beforeCalled = true;
    },
    async fetcher() {
      return { ok: false, status: 503 };
    },
  });

  await assert.rejects(feed.init(), { code: "HTTP_ERROR" });
  assert.equal(beforeCalled, false);
  assert.equal(target.content, "static");
});

test("calls after with the before failure so sliders can recover", async () => {
  const target = {
    content: "static",
    replaceChildren() {
      this.content = "changed";
    },
  };
  let afterContext;
  const feed = new MSIProductFeed({
    productLine: "nb",
    country: "uk",
    tagTitles: ["Titan Series"],
    target: "#products",
    html: "<div>{title}</div>",
    location: "https://uk.msi.com/",
    document: createFakeDocument(target),
    fetcher: createApiFetcher(),
    before() {
      throw new Error("unslick failed");
    },
    after(context) {
      afterContext = context;
    },
  });

  await assert.rejects(feed.init(), /unslick failed/);
  assert.equal(afterContext.failedPhase, "before");
  assert.match(afterContext.error.message, /unslick failed/);
  assert.equal(target.content, "static");
});
