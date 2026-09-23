---
name: msi-product-feed
description: Integrate or troubleshoot MSI Product Feed in existing product pages using MSI tag and product APIs, target-local HTML templates, product or series mode, CMS placeholder normalization, and before/after slider hooks. Use for MSIProductFeed, not the third-party consent embed plugin.
---

# MSI Product Feed integration

Use the existing MSIProductFeed plugin to replace static product cards with API data while preserving the page's layout. This self-contained skill describes the v0.3.1 API and needs no agent-specific tools. Respond in the user's language. If newer deployed code is available, inspect it before assuming its behavior matches this version.

## Integration decisions

- Inspect the actual target, repeated card structure, current slider initialization, and final CMS output. Keep unrelated HTML/CSS and page behavior intact.
- Use the official ESM plugin. It needs no React, jQuery, plugin stylesheet, provider whitelist or translation JSON. A page that uses Slick still needs its existing jQuery, Slick JS and CSS.
- Put the template in a native `template[data-msi-product-template]` inside the target. This avoids CMS rewriting of HTML inside JavaScript strings. The template represents one card, not the entire slider or the target itself.
- Preserve existing static fallback cards until data and the replacement fragment are ready. Do not empty the target or unslick it before `init()` completes the fetch stage; use the `before` hook.
- Use one feed per distinct target. A selector resolves only its first matching element; it does not render to every matching container.
- Use `mode: "products"` for product cards, `mode: "series"` for one card per matched classification. Do not infer category membership from a combined product response.
- The default uses direct API calls. Do not silently add a proxy, change country, weaken browser security or deploy a service to work around a request failure.

## Complete basic integration

Place the target before the module script. Adapt the card classes to the existing page; IDs such as `demo-0` are examples and must be unique within the page.

```html
<div id="demo-0" class="slider__Laptops">
  <template data-msi-product-template>
    <div class="slider__Laptops-box">
      <div class="slider__Laptops-item">
        <img src="{img}" alt="{title}">
        <h4>{title}</h4>
        <a href="{link}" target="_blank" rel="noopener noreferrer">
          <span>Learn More</span>
        </a>
      </div>
    </div>
  </template>
  <!-- Existing static fallback cards may remain here until replacement. -->
</div>

<script type="module">
  import { MSIProductFeed } from
    "https://storage-asset.msi.com/event/msi-product-feed/js/msi-product-feed.min.js";

  const feed = new MSIProductFeed({
    productLine: "nb",
    // Omit country to call the current page's origin.
    tagTitles: ["Titan Series", "Raider Series"],
    sort: "default",
    target: "#demo-0"
  });

  try {
    const result = await feed.init();
    if (result.missingTagTitles.length) {
      console.warn("Skipped unmatched tags:", result.missingTagTitles);
    }
  } catch (error) {
    console.error("Product Feed failed:", error.code, error.message);
  }
</script>
```

Keep `import` and top-level `await` inside `type="module"`. For a classic-script-only host, use an async function with dynamic `import()` and catch its rejection. Do not paste `await feed.init()` at the top level of a classic script. Example tag titles must be checked against the selected Local and product line; they are not guaranteed to exist on every site.

## Country, product line and API selection

`country: "uk"` calls `https://uk.msi.com`; `"tw"`, `"www"`, `"mtc"`, `"africa"` and other valid MSI subdomain labels work the same way. Supply the label, not a complete URL. Country values are trimmed and lowercased; accepted characters are letters, digits and hyphens. They are not restricted to two-letter country codes.

Omitted, empty or null `country` uses the current origin, including localhost when testing locally. `mtc.msi.com` remains MTC: do not remap it to `www.msi.com`. URL query parameters such as `country_code=global` do not automatically override origin selection.

Common `productLine` values: `nb`, `hh`, `desktop`, `monitor`, `pro-monitors`, `vga`, `mb`. Other valid API lines may be supplied; this is a suggested list, not an exhaustive enum. The plugin normalizes the line to lowercase.

The request flow is:

1. `GET /api/v1/product/getProductTagList?product_line=nb` on the resolved origin.
2. Read `result.filterTagList`. Traverse arrays and nested `tag` and `level2` entries. Compare requested `tagTitles` to `title` exactly after trimming the requested values; matching is case-sensitive, not substring or fuzzy matching.
3. Product mode requests `/api/v1/product/getProductList?product_line=nb&page_number=1&page_size=99&sort=default&id[]=...` with repeated `id[]` parameters and deduplicated IDs. Read `result.getProductList`.

Both a successful HTTP response and JSON `status.code` equal to 200 are required. HTML login/challenge pages are not valid API responses. Do not fabricate IDs or reuse another country's IDs when tag resolution fails.

`strictTags` defaults to `false`: unmatched titles appear in `missingTagTitles`, while matched titles continue. If no IDs match, the plugin throws `NO_TAG_IDS`; it does not silently fetch every product. `strictTags: true` throws `TAG_NOT_FOUND` on any missing title. An empty `tagTitles` array is invalid.

## Options and result

| Option | Meaning / default |
| --- | --- |
| `productLine` | Required API product line |
| `tagTitles` | Required nonempty array of exact API titles |
| `mode` | `"products"` (default) or `"series"` |
| `country` | Optional MSI subdomain label; omitted uses current origin |
| `sort` | `"default"` or `"date"` |
| `target` | CSS selector or DOM element for rendering |
| `html` | Optional explicit template string; otherwise read target-local template |
| `before`, `after` | Optional functions; async functions are awaited |
| `strictTags` | `false` by default |
| `pageNumber`, `pageSize` | Positive integers, defaults 1 and 99 in product mode |
| `categoryPath` | Series listing path override, e.g. `"Laptops"`, not a complete URL |
| `requestTimeoutMs` | Positive integer, default 15000 for the init operation |
| `signal` | Optional external AbortSignal |

Advanced options include `fetcher`, `document`, `location`, `proxyUrl`, and `buildProductUrl(product, context)`. Use only when the task calls for them and their environment is available. A custom product URL builder receives `apiOrigin`, `index`, and `raw` in its context. It does not override the series listing URL; use `categoryPath` for that path.

`await feed.init()` returns `apiOrigin`, `mode`, `count`, `ids`, `matchedTags`, `missingTagTitles`, `emptyTagTitles`, `products`, `series`, and `items`. Rendered cards come from `items`: products in product mode, series entries in series mode. In product mode, `count` can be the API's total count rather than the number in this response. Pagination is explicit; the plugin does not automatically fetch every page.

For data-only use, omit `target`, `html`, `before`, and `after` together:

```javascript
const feed = new MSIProductFeed({
  productLine: "monitor",
  country: "uk",
  tagTitles: ["MPG Series"],
  sort: "date"
});
const result = await feed.init();
console.log(result.products, result.missingTagTitles);
```

This fragment assumes the same module import and error handling as the complete example.

## Series mode

Reuse the same card template with `mode: "series"`. For each matched tag, the plugin makes a separate product request with that tag ID, `page_number=1`, `page_size=1`, and the selected sort. This avoids pairing an image with an unrelated category from a combined response.

```javascript
const feed = new MSIProductFeed({
  mode: "series",
  productLine: "nb",
  country: "www",
  tagTitles: ["Titan Series", "Raider Series"],
  sort: "default",
  target: "#demo-0"
});
await feed.init();
```

Run this instead of the basic example on that target, not concurrently with it. Each card uses the first product's image, the tag's title, and a category link such as `https://www.msi.com/Laptops/Products?tag_multi_select=9392`. Requested title order is preserved; if multiple API tags have the same title, each matching tag can produce a card. Product-mode output follows API order, not necessarily requested title order.

| productLine | Default series listing path |
| --- | --- |
| `nb` | `Laptops` |
| `hh` | `Handhelds` |
| `desktop` | `Desktops` |
| `monitor` | `Monitors` |
| `pro-monitors` | `Business-Productivity-Monitors` |
| `vga` | `Graphics-Cards` |
| `mb` | `Motherboards` |

Other lines fall back to their normalized productLine as the path. Verify the actual Local listing URL and set `categoryPath` if required. Series mode always uses the first page/first product, regardless of configured pageNumber/pageSize. Empty categories are omitted and reported in `emptyTagTitles`. A failed per-tag request rejects the operation before rendering; it is not treated as an empty category.

## Template and CMS behavior

| Placeholder | Product mode | Series mode |
| --- | --- | --- |
| `{img}` | Product image (`picture`) | First product image |
| `{title}` | Plain-text product title | Plain-text tag title |
| `{link}` | Resolved product URL | Series listing URL |
| `{id}` | Product ID | Tag ID |
| `{subname}` | Plain-text subtitle | First product subtitle |
| `{label}` | Plain-text label | First product label |
| `{release}` | Release value | First product release value |
| `{productLine}` | API product category | Configured product line |
| `{index}` | Zero-based rendered index | Zero-based rendered index |
| `{number}` | One-based rendered index | One-based rendered index |

Use single braces with these exact names; the GDPR snippet plugin's `{{key}}` syntax does not apply. Values are HTML-escaped. Unknown placeholders throw `UNKNOWN_PLACEHOLDER`. Normalized objects use fields such as `picture`, `titleText`, and `url`; `{img}` and `{link}` are template aliases, not those object's field names.

The template is parsed as HTML and repeated for every item. Use balanced tags, quoted URL attributes, no nested anchors and no surrounding target wrapper. Malformed closing tags can cause browser-repaired nesting across cards. Inspect the served markup, not only the editor's input, when debugging CMS output.

Version 0.3.1 restores `{img}` and `{link}` in quoted `src` and `href` attributes when the CMS percent-encodes braces or prefixes the placeholder with a page URL. For example, `src="https://mtc.msi.com/preview/promotion/detail/%7Bimg%7D"` is normalized before substitution. This is a targeted URL repair, not a general decoder for arbitrary CMS changes. If it fails, inspect the deployed plugin version and the exact output string; do not decode the entire document.

The DOM validator rejects script/iframe/object/embed/base, inline event attributes, srcdoc and non-HTTP(S) URLs in validated URL attributes. Links with `target="_blank"` gain `noopener noreferrer`. Use reviewed markup; do not remove validation to make embedded scripts run. Keep CSS and JS outside the card template.

## Before/after and Slick

The rendering order is: resolve template and options, fetch all required data, build and validate the detached fragment, await `before`, replace target children once, then await `after`. Hooks run only for rendering, not data-only mode. Tag/API/template/fragment failures before this stage do not invoke either hook.

Both hooks receive `feed`, `target`, `products`, `items`, `series`, `matchedTags`, `missingTagTitles`, `apiOrigin`, and resolved `options`. `after` also receives `error` and `failedPhase` (`"before"`, `"render"`, or null). After a before/render failure, `after` still runs; a failure inside `after` rejects `init()` without undoing the DOM replacement.

Use the page's existing Slick options and dependencies. Insert these functions into the configuration when Slick integration is requested:

```javascript
before({ target }) {
  const slider = window.jQuery(target);
  if (slider.hasClass("slick-initialized")) {
    slider.slick("unslick");
  }
},
after({ target, error }) {
  if (error) return; // Add page-specific recovery if teardown partly succeeded.
  window.jQuery(target).slick({ slidesToShow: 3, arrows: true, dots: true });
}
```

These are object members, not a standalone script. Ensure the inert template still resides inside the actual target when init reads it. If an existing slider wraps or discards template nodes, capture its template from the DOM before that transformation and pass the captured string as `html`. Do not install or configure Slick on a page that does not use it merely because this skill includes an example.

A successful empty product response (or all-empty series) renders zero cards and replaces the existing contents. If the requested behavior is to preserve the fallback on empty data, implement an explicit page-specific guard in `before({ items })` and handle its error. Do not claim the default preserves fallback in that case.

## Reinitialization and cleanup

The first successful render replaces the target's children, including its template. For filters or repeated refreshes, capture the template once before the initial render and retain it in the feed's options:

```javascript
const target = document.querySelector("#demo-0");
const html = target.querySelector("template[data-msi-product-template]").innerHTML;
const feed = new MSIProductFeed({
  productLine: "nb", tagTitles: ["Titan Series"], target, html
});
await feed.init();
await feed.init({ sort: "date" });
```

`init(overrides)` merges overrides for that call; it does not permanently rewrite constructor options. A new init aborts the previous request, but this is not a guarantee of race-free custom async hooks. Serialize page-driven refreshes when hooks can overlap and avoid multiple feeds competing for the same target.

`feed.abort()` aborts pending requests. `feed.destroy()` aborts, clears `result` and marks state destroyed; it does not remove rendered cards, restore static HTML, or unslick the page. Perform page-specific teardown separately. Do not borrow embed-handle `refresh()` or consent APIs from the GDPR plugin.

## CORS and diagnosis

Direct browser requests from localhost, Vercel, or one MSI Local to another depend on the API's CORS policy. Setting `country` selects the destination; it does not enable CORS. `mode: "no-cors"` produces an unreadable response and is not a solution. A server-side request succeeding does not prove the browser will succeed.

Prefer same-origin calls on the intended MSI page. When cross-origin access is required, the API must allow that origin or an authorized backend proxy must be supplied. `proxyUrl` only points to a proxy: it does not create one. Do not assume the documentation site hosts `/api/tools/product-feed`; the current docs link to an external MTC demo. A proxy 502 requires inspection of its upstream status/body and network access; it is not by itself evidence of a template bug.

Useful errors: `INVALID_CONFIG`, `INVALID_COUNTRY`, `INVALID_PRODUCT_LINE`, `INVALID_MODE`, `INVALID_SORT`, `TARGET_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `UNKNOWN_PLACEHOLDER`, `UNSAFE_TEMPLATE`, `UNSAFE_TEMPLATE_URL`, `TAG_NOT_FOUND`, `NO_TAG_IDS`, `NETWORK_ERROR`, `HTTP_ERROR`, `API_ERROR`, `INVALID_RESPONSE`, `INVALID_TAG_RESPONSE`, `INVALID_PRODUCT_RESPONSE`, and `ABORTED`. Inspect `error.code`, `message` and `details` along with actual requests. An aborted request may reflect cancellation or timeout. Do not treat every error as CORS.

## Verification and delivery

Check the affected workflow, using fixtures when live APIs are unavailable, and distinguish fixture results from live validation:

- Confirm the intended origin/product line, exact tag matches, and missing-tag behavior. Do not substitute real page selections with guessed titles to hide errors.
- Confirm rendered card count, titles, images, balanced wrappers and destination URLs. In series mode, verify each image and listing ID belongs to the same tag.
- Confirm request failures leave static content untouched and do not prematurely unslick. Exercise custom hooks and repeated init only if the page uses them.
- For CMS issues, verify the actual published template, encoded URLs, and loaded plugin version. Do not assume editing local source updates the remote minified asset.

In the MSI tools repository, `npm run build:product-feed` produces `dist/client/tools/product-feed/msi-product-feed.min.js`. Its production URL is `https://storage-asset.msi.com/event/msi-product-feed/js/msi-product-feed.min.js`. A Vercel docs deployment does not upload that file to MSI Storage; report any required asset upload separately. Do not publish or change backend configuration unless authorized by the user's task.

Documentation: https://msi-tools-doc.vercel.app/tools/product-feed (site login required).
Live demo: https://mtc.msi.com/preview/promotion/detail/27346?country_code=global (may require internal access).

Deliver edits with placement instructions, the relevant configuration choices and the checks performed. Preserve the user's existing architecture instead of replacing the page with a new demo.
