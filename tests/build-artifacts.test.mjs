import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const paths = {
  sourceJs: new URL("../public/plugin/msi-third-party-embed.js", import.meta.url),
  sourceCss: new URL("../public/plugin/msi-third-party-embed.css", import.meta.url),
  minJs: new URL(
    "../dist/client/plugin/msi-third-party-embed.min.js",
    import.meta.url,
  ),
  minCss: new URL(
    "../dist/client/plugin/msi-third-party-embed.min.css",
    import.meta.url,
  ),
  productFeedSource: new URL(
    "../public/tools/product-feed/msi-product-feed.js",
    import.meta.url,
  ),
  productFeedMin: new URL(
    "../dist/client/tools/product-feed/msi-product-feed.min.js",
    import.meta.url,
  ),
  productFeedDemoSource: new URL(
    "../public/tools/product-feed/standalone-demo.js",
    import.meta.url,
  ),
  productFeedDemoMin: new URL(
    "../dist/client/demo/msi-product-feed-demo.min.js",
    import.meta.url,
  ),
};

test("builds upload-ready minified plugin assets", async () => {
  const [sourceJs, sourceCss, minJs, minCss] = await Promise.all([
    stat(paths.sourceJs),
    stat(paths.sourceCss),
    stat(paths.minJs),
    stat(paths.minCss),
  ]);

  assert.ok(minJs.size > 0 && minJs.size < sourceJs.size);
  assert.ok(minCss.size > 0 && minCss.size < sourceCss.size);

  const [javascript, stylesheet] = await Promise.all([
    readFile(paths.minJs, "utf8"),
    readFile(paths.minCss, "utf8"),
  ]);
  assert.match(javascript, /MSIThirdPartyEmbedControl/);
  assert.match(stylesheet, /\.msi-third-party-embed/);

  const pluginModule = await import(
    `${paths.minJs.href}?test=${process.pid}-${Date.now()}`
  );
  assert.equal(typeof pluginModule.MSIThirdPartyEmbedControl, "function");
});

test("builds an upload-ready Product Feed module", async () => {
  const [source, minified] = await Promise.all([
    stat(paths.productFeedSource),
    stat(paths.productFeedMin),
  ]);

  assert.ok(minified.size > 0 && minified.size < source.size);

  const javascript = await readFile(paths.productFeedMin, "utf8");
  assert.match(javascript, /MSIProductFeed/);

  const productFeedModule = await import(
    `${paths.productFeedMin.href}?test=${process.pid}-${Date.now()}`
  );
  assert.equal(typeof productFeedModule.MSIProductFeed, "function");
});

test("builds a standalone direct-API Product Feed demo", async () => {
  const [source, minified] = await Promise.all([
    stat(paths.productFeedDemoSource),
    stat(paths.productFeedDemoMin),
  ]);

  assert.ok(source.size > 0);
  assert.ok(minified.size > source.size);

  const javascript = await readFile(paths.productFeedDemoMin, "utf8");
  assert.match(javascript, /MSI Product Feed Demo/);
  assert.match(javascript, /getProductTagList/);
  assert.doesNotMatch(javascript, /\/api\/tools\/product-feed/);
  assert.doesNotMatch(javascript, /<(?:html|head)(?:\s|>)|__next_f|_next\/static/i);
});
