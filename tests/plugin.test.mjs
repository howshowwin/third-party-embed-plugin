import assert from "node:assert/strict";
import test from "node:test";
import {
  MSIThirdPartyEmbedControl,
  detectLocaleFromHostname,
  decodeConsentCookie,
  encodeConsentCookie,
  normalizeManifest,
  normalizeCookieMaxAgeDays,
  normalizeScriptAttributes,
  normalizeTranslations,
  resolveProviderByUrl,
} from "../public/plugin/msi-third-party-embed.js";

test("localizes provider purposes and falls back to the manifest label", () => {
  const control = new MSIThirdPartyEmbedControl();
  control.translations = normalizeTranslations({
    defaultLocale: "en",
    locales: {
      en: {
        "providers.sideqik-promotions.purpose": "English purpose",
      },
      "fr-FR": {
        "providers.sideqik-promotions.purpose": "Objectif en français",
      },
    },
  });
  control.locale = "fr-FR";

  assert.equal(
    control._getProviderPurpose({
      id: "sideqik-promotions",
      serviceName: "Sideqik Promotions",
      purpose: { label: "Manifest fallback" },
    }),
    "Objectif en français",
  );
  assert.equal(
    control._getProviderPurpose({
      id: "unknown-provider",
      serviceName: "Unknown",
      purpose: { label: "Manifest fallback" },
    }),
    "Manifest fallback",
  );
});

test("bundles the approved service presets in the main controller", () => {
  const control = new MSIThirdPartyEmbedControl();

  for (const providerId of [
    "sideqik-promotions",
    "gleam-competitions",
    "instagram-embeds",
    "facebook-embeds",
  ]) {
    assert.equal(control.snippetPresets.has(providerId), true);
  }

  const sideqikPreset = control.snippetPresets.get("sideqik-promotions");
  assert.equal(
    sideqikPreset.js.find((entry) => typeof entry === "object").src,
    "https://d1hrk5gt3yn7pi.cloudfront.net/api/sideqik-api-1.4.js#62178a3cc9c3400046f5ca24",
  );
});

test("applies a registered provider preset to snippet configuration", () => {
  const control = new MSIThirdPartyEmbedControl();
  assert.equal(control.options.locale, "auto");
  assert.equal(
    control.options.manifestUrl,
    "https://storage-asset.msi.com/event/msi-third-party-embed/third-party-providers.json",
  );
  assert.equal(
    control.options.translationsUrl,
    "https://storage-asset.msi.com/event/msi-third-party-embed/plugin/translations.json",
  );
  control.registerSnippetPreset("sideqik-promotions", { css: 42 });

  assert.throws(
    () =>
      control._createSnippetAdapter({
        type: "snippet",
        providerId: "sideqik-promotions",
        html: '<div class="sideqik-promotion"></div>',
      }),
    /Snippet css must be a string/,
  );
});

test("detects locale from MSI subdomains and falls back to English", () => {
  const translations = {
    defaultLocale: "en",
    locales: { en: {}, "ja-JP": {}, "zh-TW": {}, es: {}, ar: {}, "fr-FR": {} },
    aliases: {},
    domainCodes: {
      jp: "ja-JP",
      tw: "zh-TW",
      arg: "es",
      ar: "ar",
      "ca-fr": "fr-FR",
    },
  };

  assert.equal(detectLocaleFromHostname("jp.msi.com", translations), "ja-JP");
  assert.equal(detectLocaleFromHostname("tw.msi.com", translations), "zh-TW");
  assert.equal(detectLocaleFromHostname("arg.msi.com", translations), "es");
  assert.equal(detectLocaleFromHostname("ar.msi.com", translations), "ar");
  assert.equal(detectLocaleFromHostname("ca-fr.msi.com", translations), "fr-FR");
  assert.equal(detectLocaleFromHostname("www.msi.com", translations), "en");
  assert.equal(detectLocaleFromHostname("mtc.msi.com", translations), "en");
  assert.equal(detectLocaleFromHostname("unknown.msi.com", translations), "en");
  assert.equal(detectLocaleFromHostname("jp.example.com", translations), "en");
  assert.equal(detectLocaleFromHostname("localhost", translations), "en");
});

test("validates cookie lifetime and script attributes", () => {
  assert.equal(normalizeCookieMaxAgeDays(180), 180);
  assert.equal(normalizeCookieMaxAgeDays(999), 400);
  assert.throws(() => normalizeCookieMaxAgeDays("invalid"), /positive number/);
  assert.deepEqual(normalizeScriptAttributes({ id: "sdk", crossorigin: "anonymous" }), [
    ["id", "sdk"],
    ["crossorigin", "anonymous"],
  ]);
  assert.throws(
    () => normalizeScriptAttributes({ src: "https://attacker.example/sdk.js" }),
    /not allowed: src/,
  );
  assert.throws(() => normalizeScriptAttributes({ onload: "alert(1)" }), /not allowed/);
});

test("rejects unsafe cookie names", () => {
  assert.throws(
    () => new MSIThirdPartyEmbedControl({ cookieName: "bad; Domain=example.com" }),
    /invalid characters/,
  );
});

test("rolls back in-memory consent when cookie persistence fails", async () => {
  const control = new MSIThirdPartyEmbedControl();
  control.init = async () => control;
  control._requireProvider = () => ({ id: "video-provider", consentRequired: true });
  control._writeAllowedProviders = () => {
    throw new Error("cookie write failed");
  };

  await assert.rejects(() => control.grant("video-provider"), /cookie write failed/);
  assert.equal(control.allowed.has("video-provider"), false);

  control.allowed.add("video-provider");
  await assert.rejects(() => control.revoke("video-provider"), /cookie write failed/);
  assert.equal(control.allowed.has("video-provider"), true);

  await assert.rejects(() => control.revokeAll(), /cookie write failed/);
  assert.deepEqual([...control.allowed], ["video-provider"]);
});

const manifest = normalizeManifest(
  {
    schemaVersion: 1,
    consentVersion: "v2",
    manifestVersion: "2026-08-11",
    providers: [
      {
        id: "video-provider",
        serviceName: "Video Provider",
        companyName: "Video Company",
        allowedFrameOrigins: ["https://embed.example.com"],
        purpose: { id: "video", label: "播放外部影片" },
      },
    ],
  },
  "https://www.msi.com",
);

test("resolves an approved iframe by exact origin", () => {
  assert.equal(
    resolveProviderByUrl(
      "https://embed.example.com/video/123",
      manifest.providers,
    )?.id,
    "video-provider",
  );
  assert.equal(
    resolveProviderByUrl(
      "https://embed.example.com.attacker.test/video/123",
      manifest.providers,
    ),
    null,
  );
});

test("requires HTTPS privacy policy URLs", () => {
  assert.throws(
    () =>
      normalizeManifest(
        {
          providers: [
            {
              id: "unsafe-provider",
              serviceName: "Unsafe",
              companyName: "Unsafe Inc.",
              purpose: { label: "Test" },
              privacyPolicyUrl: "javascript:alert(1)",
            },
          ],
        },
        "https://www.msi.com",
      ),
    /privacyPolicyUrl must use HTTPS/,
  );
});

test("encodes only unique allowed provider ids", () => {
  const encoded = encodeConsentCookie("v2", [
    "video-provider",
    "video-provider",
  ]);
  const decoded = decodeConsentCookie(encoded, "v2", ["video-provider"]);
  assert.deepEqual([...decoded], ["video-provider"]);
});

test("fails closed when the consent version changes", () => {
  const encoded = encodeConsentCookie("v1", ["video-provider"]);
  const decoded = decodeConsentCookie(encoded, "v2", ["video-provider"]);
  assert.equal(decoded.size, 0);
});

test("drops provider ids that are no longer in the manifest", () => {
  const encoded = encodeConsentCookie("v2", [
    "video-provider",
    "removed-provider",
  ]);
  const decoded = decodeConsentCookie(encoded, "v2", ["video-provider"]);
  assert.deepEqual([...decoded], ["video-provider"]);
});
