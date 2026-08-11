import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeConsentCookie,
  encodeConsentCookie,
  normalizeManifest,
  resolveProviderByUrl,
} from "../public/plugin/msi-third-party-embed.js";

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
