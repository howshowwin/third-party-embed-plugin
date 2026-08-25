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
