import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const HAN = /\p{Script=Han}/u;

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function parse(path, text) {
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function normalize(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .trim()
    .replace(/\s+/g, " ");
}

function translationKeys(siteI18nSource) {
  const file = parse("lib/site-i18n.ts", siteI18nSource);
  const keys = new Set();

  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && node.name.getText(file) === "SITE_ENGLISH_TEXT"
      && node.initializer
      && ts.isCallExpression(node.initializer)
    ) {
      const object = node.initializer.arguments[0];
      if (object && ts.isObjectLiteralExpression(object)) {
        for (const property of object.properties) {
          if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name)) {
            keys.add(normalize(property.name.text));
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  return keys;
}

function hasAttribute(element, name) {
  return element.attributes.properties.some(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === name,
  );
}

function isExcluded(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const tag = current.openingElement.tagName.getText();
      if (tag === "pre" || tag === "code") return true;
      if (hasAttribute(current.openingElement, "data-feed-i18n")) return true;
      if (hasAttribute(current.openingElement, "data-feed-i18n-aria-label")) return true;
      if (hasAttribute(current.openingElement, "data-feed-i18n-placeholder")) return true;
      if (hasAttribute(current.openingElement, "data-site-i18n-ignore")) return true;
    }
    current = current.parent;
  }
  return false;
}

function collectVisibleChinese(path, text) {
  const file = parse(path, text);
  const phrases = new Set();

  function add(value) {
    const normalized = normalize(value);
    if (normalized && HAN.test(normalized)) phrases.add(normalized);
  }

  function visit(node) {
    if (ts.isJsxText(node) && !isExcluded(node)) add(node.text);
    if (
      ts.isJsxAttribute(node)
      && node.initializer
      && ts.isStringLiteral(node.initializer)
      && ["aria-label", "placeholder", "title"].includes(node.name.text)
      && !node.parent.properties.some(
        (attribute) => ts.isJsxAttribute(attribute)
          && [
            "data-feed-i18n",
            "data-feed-i18n-aria-label",
            "data-feed-i18n-placeholder",
          ].includes(attribute.name.text),
      )
    ) {
      add(node.initializer.text);
    }
    if (
      ts.isPropertyAssignment(node)
      && node.name.getText(file) === "description"
      && ts.isStringLiteralLike(node.initializer)
    ) {
      add(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  return phrases;
}

test("covers every visible Chinese site phrase with an English translation", async () => {
  const paths = [
    "app/page.tsx",
    "app/login/page.tsx",
    "app/tools/product-feed/page.tsx",
    "app/tools/third-party-embed/page.tsx",
    "lib/tools.ts",
  ];
  const [dictionarySource, ...pageSources] = await Promise.all([
    source("lib/site-i18n.ts"),
    ...paths.map(source),
  ]);
  const keys = translationKeys(dictionarySource);
  const missing = [];

  paths.forEach((path, index) => {
    for (const phrase of collectVisibleChinese(path, pageSources[index])) {
      if (!keys.has(phrase)) missing.push(`${path}: ${phrase}`);
    }
  });

  assert.deepEqual(missing, []);
});

test("uses the shared language switcher across every site surface", async () => {
  const [layout, homepage, login, productFeed, thirdParty, productDemo, thirdPartyDemo] =
    await Promise.all([
      source("app/layout.tsx"),
      source("app/page.tsx"),
      source("app/login/page.tsx"),
      source("app/tools/product-feed/page.tsx"),
      source("app/tools/third-party-embed/page.tsx"),
      source("public/tools/product-feed/demo.js"),
      source("public/tools/third-party-embed/demo.js"),
    ]);

  assert.match(layout, /SiteI18nProvider/);
  for (const page of [homepage, login, productFeed, thirdParty]) {
    assert.match(page, /SiteLanguageSwitcher/);
  }
  assert.doesNotMatch(productFeed, /data-feed-locale=/);
  assert.match(productDemo, /msi-site-locale-change/);
  assert.match(thirdPartyDemo, /msi-site-locale-change/);
  assert.match(thirdPartyDemo, /locale:\s*siteLocale/);
});
