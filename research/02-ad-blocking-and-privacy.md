# 02: Ad and tracker blocking, plus privacy features, in a system-WebView browser

*Researched 2026-10-15. Stack assumed: Kotlin, Jetpack Compose, `android.webkit.WebView` + `androidx.webkit` (latest stable **1.17.1**, 1.18.0-rc01 in RC), minSdk 26-29.*

> **TL;DR.** Every serious WebView-based privacy browser blocks requests in `WebViewClient.shouldInterceptRequest` (plus `ServiceWorkerClientCompat` for service workers), injects JS/CSS with `WebViewCompat.addDocumentStartJavaScript`, and handles cookies with `CookieManager` and `androidx.webkit.Profile`. DuckDuckGo's Apache-2.0 Android app does exactly this and is the best reference. Its *code* is reusable, but its *tracker list* (TDS) is **CC BY-NC-SA**.
> **MVP:** a Kotlin host/domain matcher (hash set with a suffix walk) built from EasyList and EasyPrivacy network rules, with third-party cookies off. **v2:** Brave's **adblock-rust** (MPL-2.0) behind a thin JNI wrapper you write and own, with full ABP/uBO syntax, cosmetic filters and scriptlets.

---

## 1. Network-level blocking in WebView

### 1.1 `WebViewClient.shouldInterceptRequest(WebView, WebResourceRequest)`

From the AOSP Javadoc ([WebViewClient.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/webkit/WebViewClient.java)):

- Returning `null` means "WebView loads it normally". Returning a `WebResourceResponse` serves your data. **Blocking** is done by returning an empty response: `WebResourceResponse(null, null, null)`. DuckDuckGo does exactly this ([WebViewRequestInterceptor.kt](https://github.com/duckduckgo/Android/blob/develop/app/src/main/java/com/duckduckgo/app/browser/WebViewRequestInterceptor.kt)).
- *"This method is called on a thread other than the UI thread."* It is **synchronous**: the network load for that resource waits until you return.
- It is called for http(s), data and file URLs. It is **not** called for `javascript:` or `blob:` URLs, or for `file:///android_asset/` and `file:///android_res/` URLs.
- **Redirects:** *"this is only called for the initial resource URL, not any subsequent redirect URLs."* So an allowed URL that 302-redirects to a tracker is never seen. This is a real gap.
- When Safe Browsing is on, intercepted URLs are still checked by Safe Browsing.

**What `WebResourceRequest` gives you:** URL, method, `isForMainFrame`, `hasGesture`, `isRedirect` (API 24+), and request headers (Accept, Referer, User-Agent, X-Requested-With, ...).

**What it does *not* give you:**

| Missing | Consequence | Workaround |
|---|---|---|
| **Request body** (POST/PUT) | You can block a POST but can't inspect it or replay it faithfully ([Tencent doc](https://tencentcloud.com/document/product/1130/55312), [Volcengine doc](https://www.volcengine.com/docs/6758/165130)) | Blocking doesn't need the body. Only proxying does. |
| **Resource type** (script, image, sub_frame, xhr...) | ABP `$script`, `$image`, `$third-party`+type options can't be evaluated exactly. Privacy Browser's author: *"any filtering based on request type is currently impossible"* ([Stoutner forum](https://redmine.stoutner.com/boards/1/topics/461), [blog](https://stoutner.com/?p=798)) | Infer it, like DDG's [`UrlToTypeMapper`](https://github.com/duckduckgo/Android/blob/develop/app/src/main/java/com/duckduckgo/app/trackerdetection/UrlToTypeMapper.kt): `X-Requested-With: XMLHttpRequest` means xhr, the `Accept` header (`image/*`, `text/css`...), else the file extension's MIME type. `isForMainFrame` gives document vs everything else. |
| **Initiator / frame URL** | You only know the WebView's top-level URL, which you track yourself from `onPageStarted` or `shouldOverrideUrlLoading` | DDG tracks `documentUri` per tab. For service workers it uses the `Origin` or `Referer` header. |
| **Redirect hops** | See above | Partial: CNAME and redirect lists. Not solvable in general. |
| **WebSockets** | Not passed to `shouldInterceptRequest`. A WebSocket can bypass an allowlist built on it ([Aleph Security, Cordova advisory](https://www.alephsecurity.com/vulns/aleph-2014001)). This is old but still true as far as any current docs show. | JS shim that wraps `window.WebSocket` via document-start script (partial), or `ProxyController` + a local proxy (heavy). |
| **WebRTC / STUN** | Not interceptable | JS shim, or a setting that disables `RTCPeerConnection` |
| **Speculative prefetch** | *"`shouldInterceptRequest()` is completely skipped for this background request"* ([Speculative loading doc](https://developer.android.com/develop/ui/views/layout/webapps/speculative-loading)) | Don't use `Profile.prefetchUrlAsync`/`prerenderUrlAsync` with untrusted URLs. Subresources of a prefetched page *are* intercepted. |

**Threading and performance:**

- The callback runs on WebView's IO thread pool. Every microsecond you spend delays that resource. The target is **< 50 µs per request**, which means no disk I/O, no DB queries and no regex compilation in the hot path.
- **Don't hop to the main thread.** DDG's [`BrowserWebViewClient.shouldInterceptRequest`](https://github.com/duckduckgo/Android/blob/develop/app/src/main/java/com/duckduckgo/app/browser/BrowserWebViewClient.kt) does `runBlocking { withContext(main) { ... } }` to read the current document URL. That couples network loads to UI jank. Keep the per-tab "current document URL" in an `@Volatile` or atomic field instead.
- **Load the matcher off the main thread at startup.** Until it's ready, either return `null` (fail-open) or queue the request. DDG ships a bundled `tds.json` (about 1.5 MB raw) for first run.
- **Scale numbers to plan around.** EasyList + EasyPrivacy + uBO filters is about 100k rules. Brave says its ~100k default filters now take ~75% less memory after a FlatBuffers rewrite, saving ~45 MB on Android/iOS/desktop ([Brave](https://brave.com/privacy-updates/36-adblock-memory-reduction), [The Register](https://www.theregister.com/2026/01/06/brave_refurbishes_rust_adblocking_engine/), [engineer's write-up](https://shivankaul.com/blog/adblock-memory-reduction)). Brave's 2019 claim was ~5.6 µs per request classification ([Brave blog](https://brave.com/blog/improved-ad-blocker-performance/)). Ghostery's independent Node benchmark puts Brave at 0.041 ms median ([WhoTracks.me study](https://whotracks.me/blog/adblockers_performance_study.html)). Either way, **naive Kotlin regex-per-rule over 100k rules would be orders of magnitude too slow.** You need token or hash indexing. DDG gets away with regexes only because it first indexes by tracker domain (suffix walk) and then tests a handful of rules for that domain ([TdsClient.kt](https://github.com/duckduckgo/Android/blob/develop/app/src/main/java/com/duckduckgo/app/trackerdetection/TdsClient.kt)).

### 1.2 Service Workers

Service worker fetches do **not** go through the tab's `WebViewClient`. Register a `ServiceWorkerClientCompat` via `ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(...)`, or per `Profile` via `profile.serviceWorkerController`. There's no document URL, so DDG derives it from the `Origin`/`Referer` headers ([BrowserServiceWorkerClient.kt](https://github.com/duckduckgo/Android/blob/develop/app/src/main/java/com/duckduckgo/app/browser/serviceworker/BrowserServiceWorkerClient.kt)). **You must implement this.** Otherwise sites with service workers (YouTube, Twitter/X, news PWAs) bypass your blocker for SW-initiated fetches.

### 1.3 Relevant `androidx.webkit` APIs (as of 1.17.1 / 1.18.0-rc01)

Source: [androidx.webkit release notes](https://developer.android.com/jetpack/androidx/releases/webkit). Always gate calls with `WebViewFeature.isFeatureSupported(...)`.

| API | Since | Why it matters for us |
|---|---|---|
| `WebViewCompat.addDocumentStartJavaScript(webView, script, originRules)` → `ScriptHandler` | pre-1.8 (feature flag `DOCUMENT_START_SCRIPT`; exact version not verified) | Cosmetic filtering, scriptlets and anti-fingerprinting shims. Runs in **every frame whose origin matches**, *before any page JS*, and blocks parsing until done, so keep it short. Must be added *before* `loadUrl` ([WebViewCompat.java Javadoc](https://github.com/androidx/androidx/blob/androidx-main/webkit/webkit/src/main/java/androidx/webkit/WebViewCompat.java)). |
| `WebViewCompat.addWebMessageListener` | 1.3 | Safe JS→native channel, scoped by origin. Use it instead of `addJavascriptInterface`. |
| `JavaScriptExecutionWorld` / isolated-world injection, `addJavaScriptOnEvent`, `JavaScriptReplyProxy#executeJavaScript` | 1.16.0 (May 2026) | Run your content scripts in an **isolated world**, so pages can't see or tamper with your hiding code. This is Chrome-extension-like, and new. |
| `Profile` / `ProfileStore` (`MULTI_PROFILE`), `WebViewCompat.setProfile` | 1.9.0 | Separate cookie jar, storage, SW controller and geolocation per profile. Gives you **private tabs** and "burn" via `ProfileStore.deleteProfile`. Profile is per WebView and must be set before first load. |
| `WebStorageCompat.deleteBrowsingData(...)` / per-site deletion (`DELETE_BROWSING_DATA`) | 1.13.0 | One call clears *"network cache, cookies, and any JavaScript-readable storage"* for a profile or a site ([WebStorageCompat.java](https://github.com/androidx/androidx/blob/androidx-main/webkit/webkit/src/main/java/androidx/webkit/WebStorageCompat.java)). Ideal for the Fire button and clear-on-exit. |
| `WebSettingsCompat.setCookiesIncludedInShouldInterceptRequest` + `WebResourceResponseCompat#setCookies` | 1.15.0 | If you *re-fetch* a request yourself (OkHttp) to strip headers, you can now see and return cookies. GET only (no body). |
| `Profile#addCustomHeader` | 1.15.0 | Static custom headers per origin pattern. Useful for a **GPC header** (`Sec-GPC: 1`) without DDG's reload hack. Changes apply on document load (1.18 doc note). |
| `WebSettingsCompat.setRequestedWithHeaderOriginAllowList` | 1.6 → **deprecated 1.15.0** | Google **cancelled** the removal of `X-Requested-With`. The header (which carries **your package name**) *"will again be sent on all requests"*. You can't strip it from WebView-originated requests. It's a fingerprinting and WebView-detection signal you have to accept. |
| `WebSettingsCompat.setUserAgentMetadata` | 1.9.0 | Controls **UA Client Hints** (`Sec-CH-UA*`). Otherwise brands reveal "Android WebView" even if you rewrite the UA string. |
| `WebSettingsCompat.setWebViewMediaIntegrityApiStatus` | 1.10.0 | Disable it, or `ENABLED_WITHOUT_APP_IDENTITY`. It stops embedded media providers (e.g. YouTube) getting an attested app ID ([Android blog](https://android-developers.googleblog.com/2023/11/increasing-trust-for-embedded-media.html)). |
| `WebSettingsCompat.setAttributionRegistrationBehavior` | 1.9.0 | Turn off Attribution Reporting registration. |
| `setPartitionedCookiesEnabled` (CHIPS) | 1.13.0 | Decide whether partitioned 3P cookies are allowed while unpartitioned 3P cookies stay blocked. |
| `ProxyController` (`PROXY_OVERRIDE`) | 1.1 | The only way to route *all* WebView traffic (incl. WebSockets) through your own code, using a local proxy. Use it for DoH or a VPN-like filter. Heavy. |
| `Profile.prefetchUrlAsync`, `prerenderUrlAsync`, `preconnect`, `enqueuePreconnect` | 1.13 to 1.17 | Performance features. **Prefetch bypasses interception**, so use them only for first-party, user-initiated cases (or not at all in an MVP). |
| `WebViewCompat.setAudioMuted`, `setBackForwardCacheSettings`, `NavigationListener`, `WebViewCompat#navigate` | 1.11 to 1.17 | Not privacy-specific, but useful for a browser. |
| `WebView.startSafeBrowsing` | **deprecated 1.13** | Safe Browsing is on by default. Use `WebSettingsCompat.setSafeBrowsingEnabled`. |

---

## 2. Filter engines usable on Android

| Engine | License | Status (Oct 2026) | Android story | Verdict |
|---|---|---|---|---|
| **Brave adblock-rust** ([repo](https://github.com/brave/adblock-rust), crate `adblock` **0.13.3**) | **MPL-2.0** (some files Apache/MIT, per [Debian copyright](https://metadata.ftp-master.debian.org/changelogs/main/r/rust-adblock/stable_copyright)) | Very active (pushed 2026-10-13, 2.8k stars). Also vendored into Firefox's tree ([searchfox](https://searchfox.org/firefox-main/source/third_party/rust/adblock/src)). | **No official Android/Kotlin bindings.** Official bindings are Rust, npm and (community) Python. Tiny community JNI wrappers exist: [mlm-games/adblock-rs-kt-wrapper](https://github.com/mlm-games/adblock-rs-kt-wrapper) (MPL-2.0, 0 stars, Sep 2026), [breadrock1/adblock-coffee](https://github.com/breadrock1/adblock-coffee) (Java, 2025), plus hobby browsers using it ([orbit](https://github.com/egeeuzun/orbit), [onyx-browser](https://github.com/abidhasansojib/onyx-browser)). None is mature. **Plan to write your own ~300-line JNI or UniFFI layer** with `cargo-ndk`. Note: UniFFI's Kotlin backend uses JNA, which adds size and doesn't call `JNI_OnLoad` ([jffi notes](https://docs.rs/crate/jffi/0.4.18)). For a tiny API surface, hand-written `jni` crate bindings are leaner. | **Best engine. Recommend for v2.** |
| **libadblockplus-android** ([repo](https://github.com/adblockplus/libadblockplus-android)) | GPLv3 (ABP) | **Dormant.** Last push **2021-09-24**. README references jcenter/Bintray/NDK 16b. Needs V8 embedded. | Had an `AdblockWebView` | **Don't use.** |
| **eyeo "Browser Ad-Filtering Solution" / Chromium SDK** ([docs](https://developers.eyeo.com/eyeo-chromium-sdk/guides/configure-sdk-settings)) | Commercial partner agreement | Active | Integrates into **a Chromium fork** (`org.chromium.components.adblock.FilteringConfiguration`), not system WebView. eyeo *recommends Acceptable Ads on by default* (monetised allowlist). | Not applicable to a WebView browser. |
| **AdGuard CoreLibs** ([repo](https://github.com/AdguardTeam/CoreLibs)) | Repo says Apache-2.0, but… | The repo has **only a README ("In development") and a LICENSE**. The actual CoreLibs engine (used in AdGuard for Android since v2.12, [blog](https://adguard.com/en/blog/introducing-corelibs.html)) is **closed source**. AdGuard's open engine is [tsurlfilter](https://github.com/AdguardTeam/tsurlfilter) (TypeScript, **GPL-3.0**). | No usable native library | **Not usable.** |
| **Edsuns/AdblockAndroid** ([repo](https://github.com/Edsuns/AdblockAndroid)) | LGPL-2.1 | Dormant since 2021. Based on Brave's *old* C++ `ad-block`. | Ready-made WebView integration with element hiding and scriptlets | Interesting for reading, too stale to depend on. |
| **DuckDuckGo tracker blocker** (in the [Android app](https://github.com/duckduckgo/Android), **Apache-2.0**) | Code Apache-2.0. **Data (TDS) CC BY-NC-SA 4.0** | Very active | Kotlin domain-indexed matcher over `tds.json`: per-tracker-domain rules, entity (owner) grouping for first-party detection, surrogates, CNAME uncloaking | **Great reference design.** You can copy the code (Apache). Their list can't be used commercially without a licence. |
| **Simple domain hash** (DIY) | n/a | n/a | `HashSet`/sorted `LongArray` of host hashes + a suffix walk (`a.b.ads.com` → `b.ads.com` → `ads.com`) + an eTLD+1 third-party check | **Recommend for MVP.** ~1-2 days, zero native code, µs lookups. |

### Recommendation

**MVP: domain matcher in pure Kotlin.**

- **Build step.** Parse the network-only, host-anchored rules (`||host^`, optionally with `$third-party`) from EasyList and EasyPrivacy, and parse hosts-format lists, into a deduplicated host set. Compile it to a binary asset: a sorted `LongArray` of 64-bit hashes (300k hosts ≈ 2.4 MB) or a `HashSet<String>`.
- **Matching.** Suffix-walk the request host. Apply blocking only to third-party subresources (`!isForMainFrame` and a different eTLD+1, via `PublicSuffixDatabase` from OkHttp or Guava's `InternetDomainName`). Add exception rules (`@@||host^`) and a per-site user allowlist.
- **What you lose.** Path rules (`/ads/banner*`), type options, cosmetic filters and scriptlets. In practice host rules catch most third-party ad and tracker requests, and they're what Privacy Browser and most hosts-based blockers do.
- **Design.** Put it behind an interface such as `interface ContentBlocker { fun check(url, documentUrl, typeHint): Decision; fun cosmetics(url): Cosmetics? }` so v2 is a drop-in.

**v2: adblock-rust via your own JNI.**

- **Network checks.** Use `Engine::check_network_request(Request::new(url, source_url, type))`. Feed the inferred type as above.
- **Startup.** `Engine::serialize()`/`deserialize()` lets you compile lists in a `WorkManager` job and load a binary blob in milliseconds at startup.
- **Cosmetics.** Get per-site cosmetics via `url_cosmetic_resources(url)` (hide selectors + scriptlet JS) and generic class/id hiding via `hidden_class_id_selectors(...)`, driven by a `MutationObserver` in your document-start script ([Engine API docs](https://docs.rs/adblock/latest/adblock/struct.Engine.html)).
- **Redirects.** `use_resources` provides uBO-compatible redirect resources. The API-level equivalent of DDG's surrogates is returning a `WebResourceResponse` with stub JS.
- **Licence.** MPL-2.0 is file-level copyleft. You can link it into a proprietary or Apache app as long as you publish modifications to adblock-rust's own files.

---

## 3. Filter lists: licences and redistribution

| List | Licence | Bundle in APK? | Notes |
|---|---|---|---|
| **EasyList / EasyPrivacy** (+ Fanboy lists) | **Dual: GPLv3+ *or* CC BY-SA 3.0+**, your choice ([licence page](https://easylist.to/pages/licence.html)). Attribution: "The EasyList authors (https://easylist.to/)". | **Yes**, with attribution. Under CC BY-SA, *your compiled or derived list* (e.g. the extracted host set) must also be CC BY-SA, and you should offer the source/derivation. It's data, so it **doesn't make your app GPL** (separate work or aggregation). | `! Expires: 4 days`. Hosted on easylist.to behind Cloudflare free tier. Abusive fetchers have **throttled EasyList for everyone**: AdGuard reported an Indian-market browser and its forks re-downloading on every launch ([AdGuard blog](https://adguard.com/en/blog/easylist-filter-problem-help.html)). **Mirror it on your own CDN and respect Expires.** |
| **uBlock filters** (ads, privacy, unbreak, quick-fixes), from [uAssets](https://github.com/uBlockOrigin/uAssets) | **GPL-3.0** | OK as separate data files (ship them unmodified with their licence). Scriptlet/redirect *resources* from uBO are GPL-3.0 JS too. | Needed for YouTube scriptlets (`json-prune`, `set-constant`). Uses uBO syntax, which **only adblock-rust** (among the options above) understands. |
| **AdGuard filters** ([AdGuardFilters](https://github.com/AdguardTeam/AdGuardFilters)) | GPL-3.0 | Same as uBO | AdGuard-specific syntax is partially supported by adblock-rust |
| **Peter Lowe's list** ([pgl.yoyo.org](https://pgl.yoyo.org/adservers/)) | **"McRae General Public License v4.r53"** ([text](https://pgl.yoyo.org/license/)): use *"in any manner that could possibly be construed as making anybody any money"* is forbidden. ScanCode classes it as proprietary ([ScanCode](https://scancode-licensedb.aboutcode.org/mcrae-pl-4-r53.html)). | **Only for a non-commercial app**, or with written permission (pgl@yoyo.org). | ~3.5k hosts, curated by hand, low false positives |
| **Disconnect** ([services.json](https://github.com/disconnectme/disconnect-tracking-protection)), the list Firefox Focus used | **CC BY-NC-SA 4.0.** Commercial licence on request (support@disconnect.me). | Non-commercial only | Focus started on WebView (≤6.x) with Disconnect lists, then **moved to GeckoView** in 7.0 ([Wikipedia](https://en.wikipedia.org/wiki/Firefox_Focus), [ctrl.blog](https://www.ctrl.blog/entry/mozilla-gecko-focus/)). The focus-android repo is now archived. |
| **DuckDuckGo Tracker Radar / TDS** ([tracker-radar](https://github.com/duckduckgo/tracker-radar), [tracker-blocklists](https://github.com/duckduckgo/tracker-blocklists)) | **CC BY-NC-SA 4.0.** *"If you'd like to license the list for commercial use, please reach out."* | Non-commercial only | Rich entity, ownership and prevalence data. The Android app uses `web/tds.json`. |
| **HaGeZi DNS blocklists** ([repo](https://github.com/hagezi/dns-blocklists)) | GPL-3.0 | Yes (as data) | Large, well-maintained domain lists (Light/Normal/Pro tiers). A good MVP host-list source alongside EasyPrivacy. |
| **StevenBlack hosts** ([repo](https://github.com/StevenBlack/hosts)) | Repo MIT, **but** it aggregates MVPS (CC BY-NC-SA), Dan Pollock (non-commercial), yoyo (McRae) and others ([source table](https://github.com/StevenBlack/hosts/blob/master/readme.md)) | Beware: the MIT badge doesn't cover the contents | |
| **OISD** | GPL-3.0 ([repo](https://github.com/sjhgvr/oisd)) | Yes (as data) | |

**Implications:**

1. If the browser will ever be commercial (paid, ads, or arguably even donations or sponsorships), **avoid bundling NC lists** (DDG TDS, Disconnect, Peter Lowe, MVPS). Safe defaults are EasyList, EasyPrivacy, uBO filters, HaGeZi and AdGuard. Comply with GPL/CC BY-SA by shipping the lists unmodified (or publishing your derived version), with attribution in an "Open-source licences" screen. *(Not legal advice. Have a lawyer glance at it before launch.)*
2. A lower-risk pattern for optional NC lists is user opt-in. The *user's device* downloads the list from the publisher, so you never redistribute it.

**Update strategy:**

- **Bundle a snapshot** in `assets/` so protection works offline on first run.
- **Schedule updates.** Use a `PeriodicWorkRequest` every 24 h (respect each list's `Expires`, typically 4 days for EasyList). Use conditional GETs (`ETag`/`If-Modified-Since`), add jitter, and back off on failure. **Never fetch on app launch.**
- **Fetch from your own mirror.** A GitHub Action pulls upstream lists, validates them, compiles them (host set or serialized adblock-rust engine), and publishes to a CDN with a manifest (version + SHA-256). Clients download the *compiled* artefact, which avoids parsing 100k rules on-device on low-end phones and reduces load on volunteer hosts.
- **Run sanity checks before swapping.** Check that the rule count is within ±30% of the previous build, run a smoke-test allow/block corpus (borrow from DDG's [privacy-reference-tests](https://github.com/duckduckgo/privacy-reference-tests)), and only then swap atomically (write temp, `rename`). Keep the last-known-good version.
- **Add a remote "unbreak" config.** This is a small JSON of per-site exceptions you can push quickly, as DDG's [privacy-configuration](https://github.com/duckduckgo/privacy-configuration) (Apache-2.0) does.

---

## 4. Cosmetic filtering (element hiding) in WebView

**Feasible, with caveats.**

- **Mechanism.** Use `WebViewCompat.addDocumentStartJavaScript(webView, script, setOf("*"))` (feature `DOCUMENT_START_SCRIPT`). The script runs before page JS in **every matching frame, including cross-origin iframes** ([Javadoc](https://github.com/androidx/androidx/blob/androidx-main/webkit/webkit/src/main/java/androidx/webkit/WebViewCompat.java)).
  - This fixes the historic "can't inject into iframes" limitation. Privacy Browser's author noted that limitation ([Stoutner #442](https://redmine.stoutner.com/issues/442)), and DDG's help page still lists it ([DDG web tracking protections](https://duckduckgo.com/duckduckgo-help-pages/privacy/web-tracking-protections/)).
  - DDG now injects its Content Scope Scripts this way ([RealWebViewCompatContentScopeScripts.kt](https://github.com/duckduckgo/Android/blob/develop/content-scope-scripts/content-scope-scripts-impl/src/main/java/com/duckduckgo/contentscopescripts/impl/RealWebViewCompatContentScopeScripts.kt), [AddDocumentStartJavaScriptPlugin.kt](https://github.com/duckduckgo/Android/blob/develop/js-messaging/js-messaging-api/src/main/java/com/duckduckgo/js/messaging/api/AddDocumentStartJavaScriptPlugin.kt): *"execute before any other scripts… run as early as possible and/or on iframes"*).
- **The script is static per WebView, not per URL.** It's registered once and can't be swapped mid-navigation. Two patterns work:
  1. **Inject a small loader** that calls back to native via `addWebMessageListener` with `location.href`. Native answers with the site's selectors and scriptlets, and the loader inserts a `<style>` with `display:none !important`. There's an async gap of a few ms, so a brief ad flash is possible.
  2. **Embed per-site rules in the script** (a compact map from host to selectors). That's fine for small rule sets, but EasyList has ~40k cosmetic rules, which is too big to parse on every frame.
  - Pattern 1 plus a **generic-hide stylesheet** inlined in the script is the uBO-Lite-like compromise. With adblock-rust, use `url_cosmetic_resources` for per-site rules and `hidden_class_id_selectors` for generic rules, with a `MutationObserver` collecting new class/id names.
- **Use isolated worlds (webkit 1.16+, `JavaScriptExecutionWorld`)** so pages can't detect or override your hiding code. Fall back to the page world on older WebView.
- `evaluateJavascript` in `onPageStarted`/`onPageFinished` is a fallback only. It's too late (ads flash), and it runs only in the main frame.
- **Cost.** Keep the document-start script tiny, because it *"will block the loading of the page until it's finished"*. Procedural filters (`:has-text`, `:upward`) are CPU-heavy. Skip them in v2 or apply them only on demand.
- **Requires JS enabled.** If the user disables JS for a site, cosmetic filtering is off for that site too. Network blocking still works.

---

## 5. YouTube and video ads: realistic expectations

- **Network blocking alone does nothing on youtube.com.** Video ads come from the same `googlevideo.com`/`youtube.com` endpoints as content, and ad metadata travels inside the player JSON. uBO-style blocking relies on **scriptlets** (`json-prune` of `adPlacements`/`playerAds`, and `set-constant` on `ytInitialPlayerResponse.adPlacements`), which hook `JSON.parse`/`Response.json` ([WebKit bug discussion](https://bugs.webkit.org/show_bug.cgi?id=225861)). *"If you run uBlock Origin with only EasyList… it will not block ads on YouTube."*
- **SSAI (server-side ad insertion).** YouTube has been testing ads stitched into the stream ([AdGuard](https://adguard.com/en/blog/youtube-server-side-ad-insertion.html), [TechRadar](https://www.techradar.com/pro/youtubes-server-side-ad-insertion-complicates-ad-blocking-efforts)). Where SSAI is active, no client-side blocker can reliably remove ads.
- **Cat and mouse.** Fixes break weekly, and even uBO users report partial success ([Lemmy thread](https://lemmy.linuxuserspace.show/comment/1444880), [Brave community](https://community.brave.app/t/youtube-ads/500303/)). YouTube also shows anti-adblock walls.
- **WebView-specific risks:**
  - YouTube can identify WebView traffic: the `; wv` UA token, the `X-Requested-With: <your.package>` header (now permanent, see §1.3), and possibly the WebView Media Integrity API. Disable that API or strip app identity with `setWebViewMediaIntegrityApiStatus`.
  - Embeds without a proper Referer now fail with **Error 153** ([Simon Willison](https://simonwillison.net/2025/Dec/1/youtube-embed-153-error/), [YouTube IFrame API revision history](https://developers.google.com/youtube/iframe_api_revision_history)).
- **Play Store.** Device and Network Abuse bans apps that *"block or interfere with another app displaying ads"*. In-browser blocking of web content is long tolerated (DDG, Brave, Samsung Internet, AdGuard browsers are all on Play; [Android Police 2016](https://www.androidpolice.com/2016/03/01/google-explicitly-bans-ad-blockers-from-the-play-store-except-all-those-ad-blocking-web-browsers-apparently)). The same policy also forbids using a service *"in a manner that violates its terms of service"* ([policy](https://support.google.com/googleplay/android-developer/answer/9888379?hl=en)). **Don't market "YouTube ad-free" or background play.**
- **Recommendation:**
  - **MVP:** promise nothing for YouTube video ads. You can still block YouTube's tracking pings and banner/companion ads.
  - **v2:** ship uBO's YouTube scriptlets via adblock-rust with fast filter updates (your CDN, hours not weeks). Expect it to work most of the time and break periodically.

---

## 6. Other privacy features practical in WebView

| Feature | Feasible? | How / caveats |
|---|---|---|
| **Block 3rd-party cookies** | **Yes** | `CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)`. It's already the default for apps targeting API 21+ ([CookieManager.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/webkit/CookieManager.java)). It's per WebView, not per request. DDG flips it *on* temporarily during Google SSO (`accounts.google.com`) and for a few hosts ([ThirdPartyCookieManager.kt](https://github.com/duckduckgo/Android/blob/develop/app/src/main/java/com/duckduckgo/app/browser/cookies/ThirdPartyCookieManager.kt)). Also decide on CHIPS (`setPartitionedCookiesEnabled`). |
| **First-party tracker cookies** | Partial (JS) | DDG's Content Scope Scripts cap `document.cookie` lifetime to 7 days and block listed scripts from 1P cookies. **content-scope-scripts is Apache-2.0** ([repo](https://github.com/duckduckgo/content-scope-scripts)), so it's reusable. |
| **Disable JS per site** | **Yes (approx.)** | `settings.javaScriptEnabled` is per WebView. Set it in `shouldOverrideUrlLoading`/`onPageStarted` *before* the main-frame load commits, based on host. Iframes inherit the WebView setting, so it can't differ per frame. |
| **HTTPS-only / upgrade** | **Yes for navigations** | Upgrade `http://` in `shouldOverrideUrlLoading` and in your URL bar. For main-frame loads hitting `shouldInterceptRequest`, cancel and `loadUrl(https)` as DDG does. On TLS failure show an interstitial with a "continue over HTTP" choice (detect via `onReceivedError`/timeouts). Keep `MIXED_CONTENT_NEVER_ALLOW` (the default). Subresource upgrades are limited, matching DDG's note: *"Platform limits prevent upgrading additional requests."* |
| **Clear all on exit / Fire button** | **Yes** | `WebStorageCompat.deleteBrowsingData(...)` (1.13+), or the legacy combination: `CookieManager.removeAllCookies` + `flush`, `WebStorage.deleteAllData`, `webView.clearCache(true)`, `clearHistory`, `clearFormData`, `WebViewDatabase.clearHttpAuthUsernamePassword`, then delete the `app_webview/` dirs. DDG's [WebDataManager.kt](https://github.com/duckduckgo/Android/blob/develop/app/src/main/java/com/duckduckgo/app/browser/WebDataManager.kt) is a good checklist, including IndexedDB and leftover service workers. With `Profile`s, delete a whole profile instead. Also clear your own history DB, tab thumbnails and favicons. |
| **Private / incognito tabs** | **Yes (webkit 1.9+)** | A dedicated ephemeral `Profile`, deleted when the last private tab closes. Also disable screenshots in private tabs with `FLAG_SECURE`. |
| **Fingerprinting protection** | **Limited** | No native knobs. You can only shim JS APIs (canvas/audio noise, `navigator.hardwareConcurrency`, battery, etc.) via document-start scripts in isolated or main world. DDG does this with content-scope-scripts and per-site exceptions. WebView *can't* hide: the `X-Requested-With` header, TLS/HTTP2 fingerprints, Chromium version, GPU (WebGL renderer strings, unless shimmed). |
| **User-Agent** | **Yes** | Use `settings.userAgentString`. Copy DDG's approach ([UserAgentProvider.kt](https://github.com/duckduckgo/Android/blob/develop/user-agent/user-agent-impl/src/main/java/com/duckduckgo/user/agent/impl/UserAgentProvider.kt)): a Chrome-style *reduced* UA (`Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/NNN.0.0.0 Mobile Safari/537.36`), dropping `; wv` and `Version/4.0`, with a desktop-mode variant. Align UA-CH via `setUserAgentMetadata`. Removing `wv` also reduces sites refusing to work in WebViews. |
| **Google sign-in** | **Risk** | Google blocks OAuth in "embedded webviews" (`disallowed_useragent`, [Google 2021](https://developers.googleblog.com/2021/06/upcoming-security-changes-to-googles-oauth-2.0-authorization-endpoint.html)). Full browsers like DDG work in practice. Detection is likely UA- and header-based, so test Google login early. |
| **Referrer trimming** | **No (natively)** | DDG: *"Unsupported due to Android WebView limitations."* You can't edit outgoing headers without re-fetching (GET only). A partial option is a JS `<meta name=referrer>` or `document.referrer` shim. |
| **Tracking-param stripping (utm, fbclid, gclid)** | **Yes for navigations** | Rewrite in `shouldOverrideUrlLoading` (main frame) and in URL-bar input. |
| **GPC** | **Yes** | JS `navigator.globalPrivacyControl = true` via document-start script, plus the `Sec-GPC: 1` header via `Profile#addCustomHeader` (1.15+). DDG uses a reload-with-headers hack. |
| **DNS-over-HTTPS** | **No WebView setting** | WebView uses the system resolver, so it automatically honours Android **Private DNS** (DoT, and DoH3 for well-known resolvers on Android 11+ via Mainline, [Google security blog](https://security.googleblog.com/2022/07/)). Chrome's "Secure DNS" setting doesn't exist in WebView. The only app-level route is `ProxyController` → a local HTTP CONNECT proxy that resolves via DoH ([Alibaba Cloud pattern](https://help.aliyun.com/en/document_detail/2984178.html)). It's doable but a lot of complexity and battery for an MVP. **Recommend: deep-link users to system Private DNS settings** and suggest a resolver (e.g. `dns.adguard-dns.com`, `one.one.one.one`, `dns.quad9.net`). |
| **Safe Browsing** | **Yes, on by default** | `WebSettingsCompat.setSafeBrowsingEnabled`. Google SB uses hash-prefix lookups, so there's a modest privacy cost. Make it a toggle (DDG built its own "malicious site protection" instead). |
| **Cookie-consent popups** | v2 | [duckduckgo/autoconsent](https://github.com/duckduckgo/autoconsent) (**MPL-2.0**) works through a JS bridge. DDG notes iframe consent limits. |
| **Disable misc web features** | **Yes** | Disable geolocation (deny in `onGeolocationPermissionsShowPrompt`), camera/mic (`onPermissionRequest`), `setAllowFileAccess(false)`, `setAllowContentAccess(false)`, Attribution Reporting off, payment request off (default), Media Integrity API off, `setSaveFormData` (deprecated, no-op on O+), and offer a WebRTC disable shim. |

---

## 7. Reference architecture: DuckDuckGo Android (WebView-based, Apache-2.0)

Repo: [github.com/duckduckgo/Android](https://github.com/duckduckgo/Android) (Apache-2.0, ~4.9k stars, pushed daily). It's a heavily modular Gradle project (`*-api` / `*-impl` / `*-store` modules, Dagger/Anvil plugin points). Privacy-relevant modules: `tracker-detection`, `request-filterer`, `httpsupgrade`, `cookies`, `fingerprint-protection`, `content-scope-scripts`, `element-hiding`, `autoconsent`, `ad-click`, `malicious-site-protection`, `data-clearing`, `privacy-config`, `app-tracking-protection` (VPN-based, separate from the browser).

**Request pipeline** (`WebViewRequestInterceptor.shouldIntercept`, called from `BrowserWebViewClient.shouldInterceptRequest` inside `runBlocking`):

1. Malicious-site check (before or after the HTTPS upgrade, behind a flag)
2. `requestFilterer` (blocks referrer-based "bounce" requests right after navigation)
3. Ad-click attribution detection (allows DDG's own search-ad conversion)
4. Per-site UA switch: reload with a new UA if needed
5. **HTTPS upgrade** for main frame: cancel and `loadUrl(httpsUrl)`
6. DuckPlayer intercept (YouTube privacy player)
7. **GPC header** for main-frame GET: cancel and reload with headers
8. Trusted-site bypass, then mixed-content flagging
9. **Request blocklist** (path-level rules) for non-main-frame requests, minus content-blocking exceptions, tracker allowlist and user allowlist
10. **Tracker detection.** `TrackerDetectorImpl.evaluate` → `TdsClient.matches`: index by host suffix, then regex rules for that domain with `options`/`exceptions` (domains + inferred types), a first-party/same-entity check against TDS entity ownership, and the user allowlist.
11. If blocked and a **surrogate** exists, return stub JS (e.g. a fake GA or FB SDK). Otherwise return an empty response.
12. If not blocked, run **CNAME uncloaking** (an in-memory map from cloaked to real host built from TDS) and re-evaluate.

**Service workers:** `BrowserServiceWorkerClient` (`ServiceWorkerClientCompat`) runs the same tracker evaluation, with the document URL taken from `Origin`/`Referer`.

**JS layer:** **Content Scope Scripts** (Apache-2.0, shared with iOS, macOS, Windows and extensions) are injected via `addDocumentStartJavaScript`, configured by remote privacy-config. They provide fingerprinting shims, cookie protections, GPC, element hiding, Google sign-in popup hiding, click-to-load for social embeds, and messaging through `addWebMessageListener` with per-session secrets.

**Remote config:** [privacy-configuration](https://github.com/duckduckgo/privacy-configuration) (Apache-2.0) holds feature toggles, rollouts and per-site "unprotected temporary" exceptions, so breakage can be fixed without an app release.

**Data:** TDS (`tds.json`, bundled ~1.5 MB and updated remotely; CC BY-NC-SA). Surrogates come from [tracker-surrogates](https://github.com/duckduckgo/tracker-surrogates) (Apache-2.0).

**Fire button:** `WebDataManager` clears cache, history, web storage (selectively), form data, auth, cookies, IndexedDB and the `app_webview` directories, with "fireproof" site exceptions and automatic clearing on restart.

**Lessons for us:**

- **Copy:** their *structure*. That means an interceptor chain, suffix-indexed host matching, an entity-aware first-party check, surrogates, a service-worker client, document-start content scripts, remote exceptions, and a Fire button.
- **Reuse directly (Apache/MPL):** content-scope-scripts, tracker-surrogates, autoconsent, and reference tests.
- **Avoid:** their main-thread hops inside `shouldInterceptRequest`, and their TDS list unless you're non-commercial or licensed.
- **Note** that DDG deliberately does **tracker** blocking, not full **ad** blocking (no EasyList). For "strong ad blocking" we go further with EasyList and uBO lists plus adblock-rust in v2.

---

## 8. Recommended plan

**MVP (weeks 1-3):**

1. `ContentBlocker` interface + `HostSetBlocker`. Build-time Gradle task or CI compiles EasyList + EasyPrivacy host rules + HaGeZi "Light/Normal" into a binary host set. It ships in assets and updates from your CDN via WorkManager.
2. `shouldInterceptRequest` + `ServiceWorkerClientCompat`: third-party check (eTLD+1), suffix-walk lookup, empty response, per-tab blocked counter, per-site allowlist ("shields down").
3. Third-party cookies off. Fire button via `WebStorageCompat.deleteBrowsingData`. A private tab via `Profile`.
4. HTTPS upgrade for navigations, tracking-param stripping, reduced UA, Media Integrity API and Attribution Reporting off, Safe Browsing toggle, deep link to Private DNS.
5. Licence and attribution screen.

**v2:**

1. adblock-rust via a custom JNI `.so` (arm64-v8a + armeabi-v7a + x86_64), with a serialized engine compiled in CI.
2. Full network syntax: EasyList, EasyPrivacy, uBO filters, uBO privacy, and regional lists.
3. Cosmetic filtering + scriptlets via `addDocumentStartJavaScript` in an isolated world, plus `addWebMessageListener`.
4. Surrogates and redirect resources, CNAME uncloaking (needs a DNS lookup; consider a DoH-based resolver in-app just for this), and content-scope-scripts for fingerprinting, GPC and cookie TTL.
5. autoconsent, a remote unbreak config, and breakage reporting.
6. YouTube scriptlets with fast list updates. Treat this as best effort.
