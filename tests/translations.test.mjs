import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const translations = JSON.parse(
  await readFile(new URL("../public/plugin/translations.json", import.meta.url), "utf8"),
);
const providerPurposeKeys = [
  "providers.youku-video.purpose",
  "providers.sideqik-promotions.purpose",
  "providers.gleam-competitions.purpose",
  "providers.instagram-embeds.purpose",
  "providers.facebook-embeds.purpose",
];

test("uses English as the default plugin locale", () => {
  assert.equal(translations.defaultLocale, "en");
  assert.ok(translations.locales.en);
});

test("contains every supplied MSI domain code", () => {
  const codes = [
    "africa", "ar", "arg", "br", "ca", "ca-fr", "cl", "co", "latam",
    "mx", "pe", "us", "au", "kh", "cn", "hk", "in", "id", "jp", "kr",
    "my", "ph", "sg", "tw", "th", "vn", "bg", "cz", "eeu", "fr", "de",
    "gr", "hu", "it", "nl", "pl", "ro", "es", "se", "tr", "ua", "uk",
  ];
  for (const code of codes) assert.ok(translations.domainCodes[code], `Missing ${code}`);
  assert.equal(translations.domainCodes.hk, "zh-TW");
  assert.equal(translations.domainCodes.gr, "el-GR");
  assert.equal(translations.domainCodes.nl, "nl-NL");
  assert.equal(translations.domainCodes.se, "sv-SE");
});

test("keeps every default translation key available in Traditional Chinese", () => {
  const englishKeys = Object.keys(translations.locales.en).sort();
  const traditionalChineseKeys = Object.keys(translations.locales["zh-TW"]).sort();
  assert.deepEqual(traditionalChineseKeys, englishKeys);
});

test("keeps the requested local-language bundles complete", () => {
  const englishKeys = Object.keys(translations.locales.en).sort();
  for (const locale of ["el-GR", "nl-NL", "sv-SE"]) {
    const localKeys = Object.keys(translations.locales[locale])
      .filter((key) => key !== "$extends")
      .sort();
    assert.deepEqual(localKeys, englishKeys, `Incomplete locale: ${locale}`);
  }
});

test("resolves every component key for every locale", () => {
  const requiredKeys = Object.keys(translations.locales.en);

  for (const [locale, messages] of Object.entries(translations.locales)) {
    const parent = messages.$extends
      ? translations.locales[messages.$extends]
      : {};
    for (const key of requiredKeys) {
      assert.equal(
        typeof (messages[key] ?? parent[key] ?? translations.locales.en[key]),
        "string",
        `Missing resolved translation: ${locale}.${key}`,
      );
    }
  }
});

test("provides a localized purpose for every provider in every locale", () => {
  for (const [locale, messages] of Object.entries(translations.locales)) {
    for (const key of providerPurposeKeys) {
      assert.equal(
        typeof messages[key],
        "string",
        `Missing direct provider purpose translation: ${locale}.${key}`,
      );
      assert.ok(messages[key].trim(), `Empty provider purpose: ${locale}.${key}`);
    }
  }
});

test("maps every supported MSI market to an available locale", () => {
  const markets = [
    "Global", "Brazil", "Bulgaria", "Canada", "China", "Czech Republic",
    "France", "Germany", "Greece", "Hong Kong", "Hungary", "India",
    "Indonesia", "Italy", "Japan", "Malaysia", "Mexico", "Netherlands",
    "Peru", "Philippines", "Poland", "Romania", "Russia",
    "Middle East Arabic", "Spain", "Sweden", "Taiwan", "Thailand",
    "Türkiye", "Ukraine", "Vietnam", "Korea", "Cambodia", "Latin America",
    "United States", "United Kingdom", "Australia", "Middle East",
    "Singapore", "Africa", "East Europe", "Argentina", "Chile", "Colombia",
  ];

  assert.deepEqual(Object.keys(translations.markets).sort(), markets.sort());
  for (const locale of Object.values(translations.markets)) {
    const resolved = translations.aliases[locale] ?? locale;
    assert.ok(translations.locales[resolved], `Missing locale bundle: ${resolved}`);
  }
});
