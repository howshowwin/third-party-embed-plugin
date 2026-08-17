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
