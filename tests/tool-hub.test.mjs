import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("renders the documentation homepage from a central tool registry", async () => {
  const [homepage, registry] = await Promise.all([
    text("app/page.tsx"),
    text("lib/tools.ts"),
  ]);

  assert.match(homepage, /toolDocuments\.map/);
  assert.match(homepage, /getToolHref/);
  assert.match(registry, /slug:\s*"third-party-embed"/);
  assert.match(registry, /`\/tools\/\$\{tool\.slug\}`/);
});

test("keeps each tool manual in its own route folder", async () => {
  const manualUrl = new URL("app/tools/third-party-embed/page.tsx", root);
  const manual = await text("app/tools/third-party-embed/page.tsx");

  await access(manualUrl);
  assert.match(manual, /ThirdPartyEmbedGuide/);
  assert.match(manual, /href="\/"/);
  assert.match(manual, /src="\/tools\/third-party-embed\/demo\.js"/);
});

test("uses the shared MSI Storage logo on the hub and tool manuals", async () => {
  const [homepage, manual, brand] = await Promise.all([
    text("app/page.tsx"),
    text("app/tools/third-party-embed/page.tsx"),
    text("lib/brand.ts"),
  ]);

  assert.match(
    brand,
    /https:\/\/storage-asset\.msi\.com\/global\/picture\/image\/icons\/logo\.png/,
  );
  assert.match(homepage, /MSI_LOGO_URL/);
  assert.match(manual, /MSI_LOGO_URL/);
  assert.doesNotMatch(homepage, /\/msi-logo\.png/);
  assert.doesNotMatch(manual, /\/msi-logo\.png/);
});

test("keeps all explicitly sized interface text at 12px or larger", async () => {
  for (const path of [
    "app/globals.css",
    "public/plugin/msi-third-party-embed.css",
  ]) {
    const stylesheet = await text(path);
    const pixelFontSizes = [
      ...stylesheet.matchAll(/font(?:-size)?\s*:[^;\n]*?(\d+)px/g),
    ].map((match) => Number(match[1]));

    assert.ok(pixelFontSizes.length > 0, `No font sizes found in ${path}`);
    assert.ok(
      pixelFontSizes.every((size) => size >= 12),
      `Found interface text below 12px in ${path}`,
    );
  }
});
