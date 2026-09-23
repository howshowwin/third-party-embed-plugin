---
name: msi-third-party-embed
description: Integrate or troubleshoot MSI consent-controlled third-party embeds in existing web pages, including YOUKU, Sideqik, Gleam, Instagram, Facebook, and reusable popup containers. Use for the MSI GDPR embed plugin, not general legal advice or MSI Product Feed.
---

# MSI third-party embed integration

Use the existing MSIThirdPartyEmbedControl plugin to defer approved third-party content until visitor consent. Preserve the user's page structure, styling, and requested edit scope. This is a self-contained integration skill; it does not require a particular agent, framework, or tool. Respond in the user's language.

## Working contract

- Inspect the actual page and its existing controller, containers, event handlers, and third-party loaders before editing. Reuse one controller per page so provider consent stays synchronized.
- Distinguish a provider (consent scope) from an embed instance (one target). Several Instagram posts share `instagram-embeds` but each simultaneous instance needs its own target and unique ID.
- Keep third-party iframe `src`, SDK scripts, resource-loading HTML/CSS, API calls, and preconnect/prefetch requests out of the active page before consent. Hiding an already loaded widget is insufficient. MSI plugin assets and its manifests load during initialization.
- Use approved providers and built-in presets. If a service or resource origin is missing, identify it and direct the user to Ran#2084 for approval and updates to the backend CSP and Provider JSON. Do not invent provider IDs, broaden the allowlist, or mark consent optional to make an example work.
- Let the plugin own its consent UI, cookie, and withdrawal controls. Do not grant consent automatically on page load, popup opening, scrolling, or a generic “view post” click.
- Preserve the plugin footer and settings access. Closing/destroying an embed is not withdrawal of consent.
- This plugin implements technical consent controls; do not describe integrating it as a guarantee of GDPR compliance.
- YouTube is managed separately in this project. Do not migrate it into this tool unless requested.

## Production assets and initialization

Use these exact production URLs; no jQuery or React dependency is required by the plugin:

```html
<link rel="stylesheet" href="https://storage-asset.msi.com/event/msi-third-party-embed/plugin/msi-third-party-embed.min.css">
<div id="demo-0"></div>

<script type="module">
  import { MSIThirdPartyEmbedControl } from
    "https://storage-asset.msi.com/event/msi-third-party-embed/plugin/msi-third-party-embed.min.js";

  const control = new MSIThirdPartyEmbedControl();
  await control.init();
  // Put the relevant control.create(...) calls below, inside this module.
</script>
```

Keep `import` and top-level `await` inside `type="module"`. If the host only supports classic scripts, use an async function with dynamic `import()` and handle its rejected promise. Do not paste top-level `await` into a classic script.

The controller automatically fetches these separate JSON files (they are not bundled into the JS):

- Provider manifest: https://storage-asset.msi.com/event/msi-third-party-embed/third-party-providers.json
- UI translations: https://storage-asset.msi.com/event/msi-third-party-embed/plugin/translations.json

Constructor options include `manifestUrl`, `translationsUrl`, `locale` (default `"auto"`), `cookieName` (default `"msi_thirdPartyCookieControl"`), `cookieMaxAgeDays` (default `180`), and `reloadOnCustomRevoke` (default `true`). Normally keep defaults. Locale comes from the MSI hostname's first subdomain label; `www`, `mtc`, and unknown labels fall back to English. Do not implement language detection by blindly truncating every hostname to two characters.

Cookie encoding, allowed provider IDs, consent version, and expiry belong to the controller. Do not create another consent store or assume consent carries across MSI subdomains.

## Choose the built-in integration

| Service | providerId | type | Page supplies |
| --- | --- | --- | --- |
| YOUKU | `youku-video` | `iframe` | Approved player URL |
| Sideqik | `sideqik-promotions` | `snippet` | Promotion DIV, token and URL |
| Gleam | `gleam-competitions` | `snippet` | Activity DIV and link |
| Instagram | `instagram-embeds` | `snippet` | One blockquote and public permalink |
| Facebook | `facebook-embeds` | `snippet` | Public post DIV and URL |

This table reflects the maintained integrations. The deployed Provider JSON remains authoritative. Origin checks use exact scheme/host/port, not string suffix matching or a general `*.cloudfront.net` permission.

Each example below belongs after initialization in the same module. Create the corresponding empty DIV before the script. Replace sample content with the user's real public URL or service-issued ID; do not claim a sample campaign is still active.

### YOUKU

```javascript
await control.create({
  type: "iframe",
  providerId: "youku-video",
  target: "#demo-0",
  url: "https://player.youku.com/embed/YOUR_YOUKU_VID?client_id=YOUR_CLIENT_ID",
  title: "YOUKU Video",
  allow: "autoplay; encrypted-media; fullscreen; picture-in-picture"
});
```

Use the official player URL, not a watch-page URL. `url` is the plugin field; do not substitute `src`.

### Sideqik

```javascript
await control.create({
  type: "snippet",
  providerId: "sideqik-promotions",
  target: "#demo-1",
  html: '<div class="sideqik-promotion" data-token="{{token}}" data-promotion-url="{{url}}"></div>',
  options: {
    token: "de9Cjo6b",
    url: "https://sdqk.me/p/the-desk-my-stage-aug-2026_hq-de9Cjo6b"
  }
});
```

The preset provides the queue, CSS and approved SDK. Do not also paste the vendor's bootstrap script into the page.

### Gleam

```javascript
await control.create({
  type: "snippet",
  providerId: "gleam-competitions",
  target: "#demo-2",
  html: '<div class="giveaway__embed-placeholder"><a class="e-widget generic-loader" href="{{url}}" rel="nofollow">{{title}}</a></div>',
  options: {
    url: "https://gleam.io/GcEwF/excellence-refined-giveaway",
    title: "Excellence Refined Giveaway"
  }
});
```

Do not insert `https://widget.gleamjs.io/e.js` separately. The preset loads it after consent. For SDKs that auto-scan only once, verify subsequent dynamic widgets with the actual vendor API; do not assume reusing a cached script reruns its scanner.

### Instagram

```javascript
await control.create({
  type: "snippet",
  providerId: "instagram-embeds",
  target: "#demo-3",
  html: '<blockquote class="instagram-media" data-instgrm-permalink="{{url}}" data-instgrm-version="14"></blockquote>',
  options: { url: "https://www.instagram.com/p/Db3Eif_ASSQ/" }
});
```

Use `https://www.instagram.com/p/SHORTCODE/` or `/reel/SHORTCODE/`; normalize `/reels/` to `/reel/` and remove tracking query parameters. Use one post per instance: the preset selects the first `.instagram-media` in its snippet. For simultaneous posts, loop over distinct targets and call `create` once for each; catch individual failures so one failure does not prevent later posts from registering.

The preset creates an `embed/captioned/` iframe after consent. Do not load `embed.js`, invoke `instgrm.Embeds.process()`, or construct a second iframe. Current height behavior is width-based (920–1200px), with internal scrolling; it cannot measure the cross-origin document's true height. Caption, likes and comments availability is controlled by Instagram. Do not promise these can be forced by a flag or try to edit the iframe's document.

### Facebook

```javascript
await control.create({
  type: "snippet",
  providerId: "facebook-embeds",
  target: "#demo-4",
  html: '<div class="fb-post" data-href="{{url}}" data-width="500" data-show-text="true"></div>',
  options: {
    url: "https://www.facebook.com/story.php?story_fbid=1016192431171299&id=100083416537348"
  }
});
```

Prefer the public post's canonical URL. If given a `/share/p/` link, obtain its resolved public permalink rather than guessing the post ID. The preset loads the localized Facebook SDK with its configured API version and parses the prepared container. Do not add another SDK, `FB.init`, or a hard-coded Graph version to the page.

## HTML supplied outside JavaScript (CMS compatibility)

If the CMS rewrites HTML inside JS strings, place an inert native template outside the target and read it before creating the embed. This is ordinary browser code; the GDPR plugin does not automatically discover a Product Feed template or recognize its `{img}`/`{link}` syntax.

```html
<template id="ig-template">
  <blockquote class="instagram-media"
    data-instgrm-permalink="{{url}}" data-instgrm-version="14"></blockquote>
</template>
<div id="demo-3"></div>
```

```javascript
const html = document.querySelector("#ig-template").innerHTML;
await control.create({
  type: "snippet", providerId: "instagram-embeds", target: "#demo-3",
  html, options: { url: "https://www.instagram.com/p/Db3Eif_ASSQ/" }
});
```

Snippet substitutions use double braces (`{{url}}`) and escape the option value for HTML. Validate the service URL as well; escaping is not origin approval. Keep the template outside the target because the plugin replaces the target's children. Inspect the final CMS output if it also modifies templates; do not assume the source survived unchanged.

## Reusing an Instagram popup target

`create()` returns `{ id, providerId, refresh(), destroy() }`. Retain the handle. Await `destroy()` before creating another instance on the same target. `target.innerHTML = ""`, hiding the popup, and `refresh()` do not unregister or change its configured post. `control.remove(id)` is the equivalent removal API.

For rapid clicks, serialize create/destroy operations and invalidate stale requests. The following helper uses an existing controller and target. Connect it to the page's existing accessible popup open/close handlers rather than introducing a second popup system:

```javascript
function createInstagramSlot(control, target) {
  let current = null;
  let queue = Promise.resolve();
  let revision = 0;

  function enqueue(task) {
    const result = queue.then(task);
    queue = result.catch(() => {}); // Keep the queue usable after a failure.
    return result; // The caller still receives and handles the failure.
  }

  async function dispose() {
    if (!current) return;
    const previous = current;
    current = null;
    await previous.destroy();
  }

  return {
    show(rawUrl) {
      const url = new URL(rawUrl);
      const path = url.pathname.replace(/^\/reels\//, "/reel/");
      if (url.origin !== "https://www.instagram.com" ||
          !/^\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(path)) {
        throw new Error("Use a public Instagram post or Reel permalink.");
      }
      const permalink = url.origin + path.replace(/\/?$/, "/");
      const request = ++revision;
      return enqueue(async () => {
        await dispose();
        if (request !== revision) return;
        const embed = await control.create({
          type: "snippet",
          providerId: "instagram-embeds",
          target,
          html: '<blockquote class="instagram-media" data-instgrm-permalink="{{url}}" data-instgrm-version="14"></blockquote>',
          options: { url: permalink }
        });
        if (request !== revision) {
          await embed.destroy();
          return;
        }
        current = embed;
      });
    },
    close() {
      revision += 1;
      return enqueue(dispose);
    }
  };
}

const instagramSlot = createInstagramSlot(control, document.querySelector("#demo-3"));
// In the existing async open handler, reveal the popup before calling:
// await instagramSlot.show(clickedLink.dataset.igUrl);
// In every close path (button, backdrop, Escape):
// await instagramSlot.close();
// Catch errors in the handlers and show a local error message.
```

Do not wrap external URLs directly in HTML interpolation. Use validated URLs with escaped `options`, as above. Keep each helper associated with a single target. Closing a popup preserves provider consent; use withdrawal only when the visitor actually asks to revoke.

## Other approved HTML / CSS / JavaScript widgets

Use `type: "snippet"` with reviewed `html`, optional `css`, `options`, and `js`. `js` accepts a function, script URL, `{ src, attributes }`, or an ordered array of these. A string is a script URL, not JavaScript source text. Do not use `eval` or `new Function`.

The lifecycle is: prepare HTML/CSS, `beforeLoad(context)`, load `scripts`, process `js` entries in order, then `mount(context)`. A JS function receives `root` (prepared container), `global` (window), `options`, `signal`, `isAllowed`, and `loadScript`. Use `signal` with async requests and check `signal.aborted || !isAllowed()` before applying async results. Use the provided `loadScript` for external SDKs; its origins must be approved. Additional SDK network activity is not automatically sandboxed by this plugin.

`mount` can return a cleanup function or an object with `unmount()`. Alternatively provide `unmount({ mountResult, prepared, provider, options })`. Clean up page-owned listeners, timers and observers. Shared SDK loading is cached, so rerendering may require the vendor's actual initialization method.

Snippet HTML rejects `script`, `iframe`, `object`, `embed`, `link`, `base`, `meta`, inline `on*` handlers, `srcset`, and inline style `url()`. CSS `@import` is rejected. Use iframe mode for iframes, `js` for scripts, and approved CSS resources. Reviewed snippet functions execute in the page; this is not a sandbox for untrusted user input.

Built-in presets are shallow-merged with configuration: supplying `js`, `mount` or `beforeLoad` replaces that preset field. Avoid overriding built-in lifecycle fields just to customize content.

Use advanced `registerAdapter(id, adapter)` / `type: "custom"` only when a reusable lifecycle cannot be expressed with a snippet. Adapters support `providerIds`, `prepare`, `load`, `mount`, and `unmount`; `mount` is required. Do not invent vendor APIs. Match the deployed implementation before adding an adapter.

## Consent, cleanup and diagnostics

- `control.openSettings()` opens the built-in consent manager.
- `control.hasConsent(providerId)` and `getAllowedProviderIds()` inspect current state after initialization.
- `await control.grant(providerId)` is for a deliberate consent action, normally handled by the plugin UI.
- `await control.revoke(providerId)` / `revokeAll()` withdraw consent and update the cookie. Same-provider instances synchronize within the controller.
- Iframe-mode withdrawal removes content and restores the placeholder without reloading. With the default setting, a provider with a loading, active or errored snippet/custom instance triggers reload after withdrawal; this includes the Instagram snippet despite its iframe output.
- `await embed.destroy()` unregisters that embed and cleans up its target without changing saved consent. It cannot undo data already transmitted or reliably unload a vendor's global SDK.
- Initialization or allowlist failures must leave third-party content blocked. Do not fall back to injecting the vendor's original embed code.

When debugging, check module syntax, target existence/uniqueness, controller duplication, Provider JSON and translation requests, approved exact origins, CSP/console failures, cookie persistence, and the vendor's public-content availability. A plugin registration success is not proof that an external post rendered. Do not infer a CSS clipping problem without inspecting dimensions and overflow.

## Verify the integration being delivered

Use the smallest relevant checks for the requested change:

1. With no saved consent, the affected target shows the consent placeholder and makes no requests to that provider. Use a clean test profile or the built-in withdrawal action; avoid erasing unrelated cookies.
2. Grant through the UI: verify the intended content loads and other registered instances of that provider synchronize.
3. Withdraw: verify iframe removal or snippet reload, then confirm the provider remains blocked after reload.
4. For popup changes, test first post, second post, close/reopen, rapid switching, and close while loading. Check for duplicate-target errors and stale content.
5. Verify the final CMS-generated markup, responsive layout and visible withdrawal control. Test different locale hosts only if language behavior is part of the change.

Deliver the actual HTML/CSS/JS edits with placement instructions, and clearly state which checks ran and which live-provider behavior remains unverified. Keep unrelated page code intact. Do not publish, change approval records or upload Storage assets merely because this skill was invoked; follow the user's task scope.

Maintained documentation: https://msi-tools-doc.vercel.app/tools/third-party-embed (requires site access). If remote documentation is unavailable, use this file and inspected plugin code; do not invent newer APIs.
