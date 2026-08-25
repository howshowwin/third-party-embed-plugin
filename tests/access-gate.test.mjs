import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("protects the manual and public demo data behind a server-side gate", async () => {
  const [proxy, route, login] = await Promise.all([
    text("proxy.ts"),
    text("app/api/site-access/route.ts"),
    text("app/login/page.tsx"),
  ]);

  assert.match(proxy, /SITE_ACCESS_PASSWORD|SiteAccessPassword/);
  assert.match(proxy, /request\.cookies\.get/);
  assert.match(proxy, /NextResponse\.redirect/);
  assert.match(route, /httpOnly:\s*true/);
  assert.match(route, /sameSite:\s*"lax"/);
  assert.match(login, /method="post"/);
});

test("requires the password to come from the server environment", async () => {
  const [accessControl, exampleEnvironment] = await Promise.all([
    text("lib/site-access.ts"),
    text(".env.example"),
  ]);

  assert.match(accessControl, /process\.env\.SITE_ACCESS_PASSWORD/);
  assert.match(accessControl, /\?\.trim\(\) \?\? ""/);
  assert.match(exampleEnvironment, /^SITE_ACCESS_PASSWORD=\S+/m);
});

test("asks all compliant crawlers not to index the deployment", async () => {
  const [robots, config, layout] = await Promise.all([
    text("app/robots.ts"),
    text("next.config.ts"),
    text("app/layout.tsx"),
  ]);

  assert.match(robots, /disallow:\s*"\/"/);
  assert.match(config, /X-Robots-Tag/);
  assert.match(layout, /index:\s*false/);
});
