import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("uses the standard Next.js build expected by Vercel", async () => {
  const packageJson = JSON.parse(await text("package.json"));

  assert.equal(packageJson.scripts.dev, "next dev");
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.start, "next start");
  assert.equal(typeof packageJson.dependencies.next, "string");
  assert.equal(packageJson.devDependencies.vinext, undefined);
  assert.equal(packageJson.devDependencies.wrangler, undefined);
});

test("keeps only the production plugin assets remote", async () => {
  const [demo, stylesheet, page] = await Promise.all([
    text("public/demo/demo.js"),
    text("app/globals.css"),
    text("app/page.tsx"),
  ]);

  assert.match(
    demo,
    /https:\/\/storage-asset\.msi\.com\/event\/msi-third-party-embed\/plugin\/msi-third-party-embed\.min\.js/,
  );
  assert.match(demo, /manifestUrl:\s*"\/third-party-providers\.json"/);
  assert.match(demo, /translationsUrl:\s*"\/plugin\/translations\.json"/);
  assert.match(
    stylesheet,
    /https:\/\/storage-asset\.msi\.com\/event\/msi-third-party-embed\/plugin\/msi-third-party-embed\.min\.css/,
  );
  assert.match(page, /src="\/demo\/demo\.js"/);
  assert.doesNotMatch(page, /demo-render/);
});

test("removes the obsolete single-file and Cloudflare entry points", async () => {
  for (const path of [
    "scripts/export-demo.tsx",
    "vite.config.ts",
    "worker/index.ts",
    ".openai/hosting.json",
  ]) {
    await assert.rejects(access(new URL(path, root)));
  }
});
