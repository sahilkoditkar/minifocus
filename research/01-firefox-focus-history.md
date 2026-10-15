# 01 – Firefox Focus history, WebView-based browsers, and fork-or-not

Research date: 2026-10-15.
Method: web sources plus direct inspection of the git history of `mozilla-mobile/focus-android` and `mozilla-tw/FirefoxLite` (partial clones), and shallow clones of Jelly, Fulguris and Lightning. Statements marked "(git)" come from my own reading of the repository history, with commit links you can check.

---

## TL;DR / Verdict

- Firefox Focus for Android used **only the Android system WebView** from v1.0 (June 2017) through **v6.x** (Aug 2018). **v7.0** (Oct 2018) shipped both engines and switched between them at runtime through an A/B experiment, with WebView still the default. **v8.0.22** (Oct 2019) made GeckoView the default for everyone. The dead WebView code was removed in the Android Components rewrite that shipped as **v8.18.0 / v91** (July/Aug 2021).
- The code is **MPL-2.0**. `mozilla-mobile/focus-android` was archived in Jan 2023, then lived in `mozilla-mobile/firefox-android` (archived June 2024), and is now in mozilla-central at `mobile/android/focus-android`.
- **Last tags with WebView:** `v6.1.1-RC3` (Aug 2018) is the last tag where WebView was the only shipping engine. `v8.0.21` (Oct 2019) is the last tag where WebView was still the default.
- **Recommendation: do not fork.** The 2018 codebase is Java plus Kotlin 1.2, Gradle 4.1, AGP 3.0, support library 27, targetSdk 27, `kotlin-android-extensions`, `AsyncTask`, and it calls `setAppCacheEnabled`, which no longer compiles against API 33 or later. Getting it to targetSdk 36 (required on Play since 31 Aug 2026) means rewriting most of it, and you would still carry MPL file-level obligations and have to strip all Mozilla branding. **Start fresh with Kotlin, Jetpack Compose and `androidx.webkit`.** Borrow the *ideas*: the trie-based URL matcher, the erase flow, the WebView hardening settings and the URL-bar-first UI. Read and reimplement them rather than copying them. If you do copy any file, keep it MPL-2.0 with its header.
- **Blocklist licence warning:** the Disconnect lists that Focus used (`disconnect-blacklist.json` / `entitylist.json`) are **CC BY-NC-SA 4.0, which is non-commercial**. DuckDuckGo's lists are also NC. For a project that may ever be monetised, use EasyList/EasyPrivacy (GPLv3 / CC BY-SA 3.0, downloaded at runtime) or Steven Black hosts.
- **Trademark:** "Firefox Focus" is a registered Mozilla wordmark and logo. "Focus" on its own is not on Mozilla's list, but it is a generic, heavily used mark: Burda's FOCUS magazine is the reason Mozilla ships "Klar" in DE/AT/CH. Avoid "Focus" in the name.

---

## 1. Engine history of Firefox Focus for Android

### Timeline (git-verified)

| Date | Version / commit | What happened |
|---|---|---|
| 2017-02-10 | [`5d8750c`](https://github.com/mozilla-mobile/focus-android/commit/5d8750c8152895a1e816d71220ec2a5e89bf0c56) | "Hide WebView implementation behind interface" (`IWebView`). This is the start of engine abstraction. |
| 2017-02-16 | [`61a40ec`](https://github.com/mozilla-mobile/focus-android/commit/61a40ec22da51d555896455de5c509b7db3113b4) | Separate `focus` / `klar` product flavors. |
| 2017-06-16 | tag [`v1.0`](https://github.com/mozilla-mobile/focus-android/tree/v1.0) | First release. `app/build.gradle` already has `flavorDimensions "product", "engine"`, engine = `webkit` / `gecko`. The Gecko flavor was **debug-only** ("We only need a gecko debug build for now"). minSdk 21, targetSdk 25. |
| 2017-09-14 | [`8940f45`](https://github.com/mozilla-mobile/focus-android/commit/8940f45ba74e288f27c8301ed058a54211b3c0d8) | "Rename flavor: webkit -> webview". From here the variants are **`focusWebview{Debug,Beta,Release}`, `klarWebview…`, `focusGecko…`, `klarGecko…`**, so the flavor names you remembered are real. |
| 2018-03 (V4.1) | `app/build.gradle` | Third dimension `abi` added. Gecko builds limited to Klar non-release ("We only need Klar builds with gecko for now"). Release builds were still WebView-only. |
| 2018-06-22 | [`9843eff`](https://github.com/mozilla-mobile/focus-android/commit/9843effbceb7f747c72e419112b0d79969dd35ed) | "Build GeckoView versions of Focus too." |
| 2018-07-12 | [`63339d2`](https://github.com/mozilla-mobile/focus-android/commit/63339d2d9a5d132bf4a1fffc4c46c0ce393abe87) | **"Add renderer selection between GeckoView and WebView"**. The `engine` build-flavor dimension is **removed**. Both engines now ship in one APK (`ClassicWebViewProvider` and `GeckoWebViewProvider`), selected at runtime. |
| 2018-07-24 | [`5305b1d`](https://github.com/mozilla-mobile/focus-android/commit/5305b1d46c83ff98b786e68e8b850711328e83a7) | A/B test (Fretboard experiment `geckoEngineExperimentDescriptor`) to choose the engine. |
| 2018-08-06 | tag [`v6.1.1-RC3`](https://github.com/mozilla-mobile/focus-android/tree/v6.1.1-RC3) (commit `fc33da1`) | **Last 6.x tag: the last release line where shipping builds were WebView-only.** It still has the `webview`/`gecko` flavor dimension. |
| 2018-09 / 2018-10 | v7.0 ([Mozilla Hacks announcement](https://hacks.mozilla.org/2018/09/focus-with-geckoview/)) | "Focus with GeckoView". Every copy now contains Gecko (APK grows from about 4 MB to about 38 MB), enabled through a staged rollout. In `v7.0-RC10`, `Config.DEFAULT_NEW_RENDERER = false` for focus and klar release; only Nightly defaults to Gecko. Users enrolled in the experiment got Gecko. |
| 2019-10-03 | tag `v8.0.21` (commit [`a62c697`](https://github.com/mozilla-mobile/focus-android/tree/v8.0.21)) | **Last tag where WebView was still the default renderer** (`DEFAULT_NEW_RENDERER = false`). |
| 2019-10-04 | [`22150b6`](https://github.com/mozilla-mobile/focus-android/commit/22150b6add521dc5bdd2633824d950f4730a7534), first in `v8.0.22` | "Switch default to GeckoView at app startup for all users". Removes the engine toggle and experiment settings. From here on WebView is dead code in the app. |
| 2020-05-19 (authored) | [`be56599`](https://github.com/mozilla-mobile/focus-android/commit/be56599d04385a506c24684db705dd9b80122a10) | "Refactor Focus to use browser-engine component" (Android Components). Deletes `SystemWebView`, `FocusWebViewClient`, `TrackingProtectionWebViewClient`, and more. It landed on `main` in 2021 and first appears in tags **v8.18.0 (2021-07-26)** and **v91.1.0 (2021-08-05)**. |
| 2021-04 to 2021-06 | [`29f3be4`](https://github.com/mozilla-mobile/focus-android/commit/29f3be4aeec7e09b53103bc7cdd14fa19501cad0), [`57e6d92`](https://github.com/mozilla-mobile/focus-android/commit/57e6d92809605d486b28f8605b3862f456ea9d54) | Removal of the remaining `webview/matcher/*` (trie and Disconnect list matcher) and the WebView tests. |
| 2021-07-12 | tag `v8.17.1` (`f0e44ad`) | Last 8.x tag. It still *contains* `ClassicWebViewProvider` and the matcher sources, but GeckoView is hard-wired (`var engine = GeckoWebViewProvider()`). |

Other sources on the switch: [VentureBeat](https://venturebeat.com/business/mozilla-geckoview-firefox-preview-android), [linuxfr: "Firefox Focus / Klar avec GeckoView"](https://linuxfr.org/news/firefox-focus-klar-avec-geckoview), [Packt Hub](https://hub.packtpub.com/developers-of-firefox-focus-set-to-replace-androids-webview-with-geckoview/), [ctrl.blog](https://o.ctrl.blog/entry/mozilla-gecko-focus.html).

Mozilla's own reason for leaving WebView ([Hacks, 2018](https://hacks.mozilla.org/2018/09/focus-with-geckoview/)): WebView "isn't designed for building browsers", "only supports a subset of web standards", and "tends to have quite a bit of variance between versions". These are the same trade-offs we accept by choosing WebView. They matter less in 2026 because WebView has updated through Play since Android 5 and ships with Chrome on Android 7–9 and 10+. They still matter for extensions, which WebView cannot run, for fine-grained network control, and for fingerprinting resistance.

### Answer to Q1
- **Originally WebView?** Yes. WebView was the only shipping engine from 1.0 through 6.x (2017-06 to 2018-08).
- **Switched to GeckoView in** 7.0 (Sept/Oct 2018, staged). It became the default for all users in **8.0.22 (Oct 2019)**.
- **Both at once?** Yes, in two phases:
  1. **Build flavors (2017-06 to 2018-07):** `focusWebview*` / `klarWebview*` / `focusGecko*` / `klarGecko*` (before Sept 2017 these were `*Webkit*`). The Gecko variants were debug/beta or Klar only.
  2. **Single APK with runtime switch (7.0 to 8.0.21):** `ClassicWebViewProvider` vs `GeckoWebViewProvider`, chosen by an A/B experiment.
- **WebView flavor removed:** the build-flavor dimension was removed 2018-07-12 (`63339d2`). The runtime option was removed 2019-10-04 (`22150b6`, v8.0.22). The code was deleted in the 2021 Android Components rewrite (v8.18 / v91).

---

## 2. Licence and where the code lives

- **Licence:** MPL-2.0 ([LICENSE in the repo](https://github.com/mozilla-mobile/focus-android/blob/main/LICENSE); every source file carries the MPL header).
- **Repo trail:**
  1. [`mozilla-mobile/focus-android`](https://github.com/mozilla-mobile/focus-android): **archived 2023-01-12**. The README points to firefox-android. It has 281 tags, from `v1.0` to `v108.1.0`.
  2. [`mozilla-mobile/firefox-android`](https://github.com/mozilla-mobile/firefox-android): a monorepo of Fenix, Focus and Android Components. Migrated to mozilla-central on 2024-03-18 and **archived 2024-06-17** ("As of Firefox 128, all future releases will be fully managed in Mozilla Central").
  3. **mozilla-central**, mirrored at [`mozilla-firefox/firefox`](https://github.com/mozilla-firefox/firefox), path [`mobile/android/focus-android`](https://github.com/mozilla-firefox/firefox/tree/main/mobile/android/focus-android) ([searchfox](https://searchfox.org/firefox-main/source/mobile/android/focus-android/)). This is GeckoView-only, so it is irrelevant as a WebView base.
- **Best reference snapshots for the WebView era:**
  - [`v6.1.1-RC3`](https://github.com/mozilla-mobile/focus-android/tree/v6.1.1-RC3) (2018-08-06, `fc33da1`). WebView engine in `app/src/webview/`, matcher in `app/src/webview/java/org/mozilla/focus/webview/matcher/`, lists in `shavar-prod-lists/`. This is the classic "old Focus" UI.
  - [`v8.0.21`](https://github.com/mozilla-mobile/focus-android/tree/v8.0.21) (2019-10-03). WebView is still the default. It is more Kotlin-heavy, on AndroidX, and the code is mixed with Gecko and experiment code.
  - Release branch: `releases/v8.0`.

Toolchain at those snapshots (git):

| | v6.1.1-RC3 (2018) | v8.0.24 (2019) | v8.17.1 (2021) |
|---|---|---|---|
| AGP / Gradle | 3.0.1 / 4.1 | 3.2.1 / 4.7 | 3.5.3 / 5.4.1 |
| Kotlin | 1.2.30 | 1.3.50 | 1.3.61 |
| Support libs | `com.android.support` 27.1.1 | AndroidX 1.0.0 | AndroidX |
| compile / target SDK | 27 / 27 | 28 / 28 | 29 / 29 |
| Main sources | 76 Java + 59 Kotlin | 55 Java + 119 Kotlin | 55 Java + 119 Kotlin |
| Other | `kotlin-android-extensions` (synthetics, 7 uses), `AsyncTask` (22 uses), Spotbugs, Adjust and Sentry telemetry | Fretboard experiments, Gecko | Android Components |

---

## 3. Firefox Lite (formerly Firefox Rocket)

- **What:** Mozilla Taiwan's lightweight browser for emerging markets (Indonesia, India and others). It was originally derived from Focus: its package namespace is still `org.mozilla.focus`.
- **Engine:** **Android WebView.** In the final source, `app/build.gradle` has only the `webkit` engine flavor ("We can build with two engines: webkit or gecko", but only `webkit` is defined). There are leftover `app/src/gecko/` sources, but the shipped app was WebView (git).
- **Status:** **discontinued 2021-06-30**, with no more security updates and removal from Google Play ([MobileSyrup](https://mobilesyrup.com/2021/07/06/mozilla-sunsets-firefox-lite-app/), [Ubergizmo](https://ubergizmo.com/2021/07/mozilla-firefox-lite-browser-killed-off)). The repo was **archived 2021-07-05**.
- **Repo / licence:** [`mozilla-mobile/FirefoxLite`](https://github.com/mozilla-mobile/FirefoxLite) (`mozilla-tw/FirefoxLite` redirects there). **MPL-2.0.** About 545 Java and 536 Kotlin files. Kotlin 1.3.70, AGP 3.6.1, Gradle 5.6.4, targetSdk 29. It contains Firebase (Crashlytics, Performance, Remote Config) and a lot of extra features (content hub, games, rewards). Not a good minimal base. Its [content-blocking doc](https://github.com/mxlius/FirefoxLite/blob/main/docs/contentblocking.md) (from a mirror) describes the same Disconnect-list approach as Focus.
- "Firefox Rocket" is still on Mozilla's trademark list.

---

## 4. Other open-source WebView-based browsers

Data from the GitHub/Codeberg APIs, F-Droid and shallow clones, as of 2026-10-15.

| Project | Licence | Language | Last activity | Size / architecture notes | Ad/tracker blocking | Verdict as base / reference |
|---|---|---|---|---|---|---|
| **Jelly** (LineageOS) — [GitHub mirror](https://github.com/LineageOS/android_packages_apps_Jelly) | **Apache-2.0** (REUSE-compliant) | 100% Kotlin (57 files) | Active (2026-10-07; feature commits Sept 2026) | Small, modern: Gradle KTS, compile/targetSdk 36, minSdk 26, Room, coroutines, ViewModels, View-based UI (no Compose). Very close to the "minimal" philosophy. | **None** (no `shouldInterceptRequest`) | **Best reference or permissive base.** Apache-2.0 allows reuse without copyleft. You would need to add blocking, erase flow and Focus-style UI. |
| **Lightning Browser** — [anthonycr/Lightning-Browser](https://github.com/anthonycr/Lightning-Browser) | MPL-2.0 | Kotlin (312 kt, 4 java); **partial Compose (about 51 files)** | `main` very active (Oct 2026, Gradle 9.8, Kotlin 2.4, targetSdk 37), but the **last tagged release is 5.1.0 from 2019-10-01** (F-Droid is still on 5.1.0). The CHANGELOG has a large unreleased "Upcoming" section. | Dagger, coroutines (moved off RxJava), well structured. Full-featured (tabs, bookmarks, history), so not minimal. | Hosts-file blocking with a Bloom filter (`BloomFilterAdBlocker`, `assets/hosts.txt`) | Good reference for a WebView blocking implementation and a Compose browser chrome. Heavier than we want. MPL is file-level. |
| **Fulguris** — [Slion/Fulguris](https://github.com/Slion/Fulguris) | **MPL-2.0 for old files, CPAL-1.0 for all new files** since commit 53528d0 (CPAL is attribution-heavy "badgeware") | Kotlin (389 kt, 15 java) | Very active (v2.1.2, 2026-10-12) | Fork of Lightning. Hilt/Dagger and RxJava2. Feature-rich (sessions, tab bars, I2P/Orbot). Play build has a subscription nag after 20 tabs and Firebase. | Full **ABP/uBO-style filter engine** (`fulguris/adblock/AbpBlocker*`, list updater, user rules, hosts parser) | Strong reference for an ABP filter engine on WebView. **Avoid as a base** because of CPAL attribution terms and its size. |
| **FOSS Browser** — [Codeberg: Gaukler_Faun/FOSS_Browser](https://codeberg.org/Gaukler_Faun/FOSS_Browser) (the GitHub `scoute-dich/browser` is now an empty placeholder) | **AGPL-3.0+** | Java | Active (v24 on F-Droid; WIP commit 2026-09-13) | Single developer, Java, older-style code. | Steven Black hosts list, auto-updated | Reference only. AGPL is a strong-copyleft trap if you want permissive licensing. |
| **Privacy Browser** (Soren Stoutner) — [stoutner.com](https://www.stoutner.com/category/privacy-browser-android/), [F-Droid](https://f-droid.org/packages/com.stoutner.privacybrowser.standard/) | **GPLv3+** | Kotlin (the multi-year Java to Kotlin port is finished) | Active: 3.20 (2026-03-11), 3.20.1 on F-Droid | Single developer, self-hosted git (gitweb). Very privacy-maximalist: per-domain settings, JS off by default, filter lists (EasyList, EasyPrivacy, Fanboy), and the cache is cleared after every page load in 3.20. | EasyList-family filter lists | Excellent reference for **privacy hardening of WebView**. GPLv3 means no copying unless we go GPL. |
| **DuckDuckGo Privacy Browser** — [duckduckgo/Android](https://github.com/duckduckgo/Android) | **Apache-2.0** (app code) | Kotlin | Extremely active (daily) | Large, professional, modular monorepo. **WebView-based.** Has the "Fire button" erase flow, which is the closest modern analogue of the Focus erase. | Own Tracker Data Set (TDS). The **blocklists are CC BY-NC-SA 4.0** ([tracker-blocklists](https://github.com/duckduckgo/tracker-blocklists), [tracker-radar](https://github.com/duckduckgo/tracker-radar)) | Best *architecture* reference for modern WebView privacy (request interception, fire button, GPC, cookie handling). Too big to fork. Do not ship their lists commercially. |
| Bromite / Cromite | GPLv3 (patches) | C++ (Chromium fork) | Bromite dead since 2023; Cromite active | Own Chromium engine, **not WebView** | — | Out of scope (not WebView). |
| Mull / IronFox | MPL-2.0 | Gecko (Fennec fork) | **Mull discontinued Dec 2024** with DivestOS ([Techlore](https://discuss.techlore.tech/t/the-divestos-project-has-ended/11593), [Privacy Guides](https://discuss.privacyguides.net/t/the-end-of-mobile-divested-projects/23396)). IronFox is its successor ([thread](https://discuss.privacyguides.net/t/ironfox-a-new-mull-fork/23638/100)) | Gecko, **not WebView** | — | Out of scope. |

---

## 5. Fork the old WebView-era Focus, or start fresh?

### Why forking v6.1.1 / v8.0.21 is a bad idea in 2026
1. **Toolchain debt.** AGP 3.0 / Gradle 4.1 / Kotlin 1.2 / support-lib 27 (v6) will not build on a current JDK and Android Studio without a staged migration (AGP 3 to 8, Gradle 4 to 8/9, `android.support` to AndroidX, Kotlin 1.2 to 2.x, removal of `kotlin-android-extensions` synthetics, which were removed in Kotlin 1.8).
2. **Target SDK.** Since **31 Aug 2026 Google Play requires targetSdk 36** for new apps and updates ([Play target-SDK requirement](https://developer.android.com/google/play/requirements/target-sdk), [Play Console help](https://support.google.com/googleplay/android-developer/answer/11926878)). Moving from 27 to 36 brings nine releases of behaviour changes: scoped storage, notification permission (Focus uses a persistent "erase" notification), exact alarms and foreground-service types, predictive back, edge-to-edge enforcement (API 35+), package visibility (`<queries>` for "open in app"), and `PendingIntent` mutability flags.
3. **Removed and deprecated APIs in the WebView code** (git, `ClassicWebViewProvider`/`WebViewProvider.java` at v6.1.1): `WebSettings.setAppCacheEnabled()` was **removed from the SDK in API 33**, so it causes a compile error. `setSaveFormData()` and `setSavePassword()` are deprecated or no-ops, `TEXT_AUTOSIZING` is deprecated, and there are 22 uses of `AsyncTask` (deprecated in API 30).
4. **UI stack.** It uses XML Views, Fragments, `android.support.design` and custom NestedWebView scrolling hacks. A Compose rewrite would replace almost all of it anyway.
5. **Mixed concerns.** v7+ code is tangled with GeckoView, Fretboard experiments, Adjust and Sentry telemetry. v6 has Adjust, Sentry and Mozilla telemetry, which all need removing for a privacy-first product.
6. **MPL-2.0 obligations.** These are manageable but real: every file taken from Focus (and modifications to it) must stay MPL-2.0 with its header, and its source must be made available. MPL is file-level, so new files can use any licence (Apache/MIT/MPL) as a "Larger Work".
7. **Trademark.** You must remove "Firefox", "Focus", "Klar", the Focus logo and all Mozilla branding (see section 6). The Mozilla Public License "does not grant permission to use Mozilla trademarks" ([Mozilla distribution policy](https://www.mozilla.org/en-US/about/partnerships/distribution/)).
8. **Blocklists.** The bundled `shavar-prod-lists/disconnect-*.json` are **CC BY-NC-SA 4.0** ([shavar-prod-lists LICENSE](https://github.com/mozilla-services/shavar-prod-lists/blob/master/LICENSE)). Older Disconnect lists were GPLv3 ([Mozilla bug 1369500](https://bugzilla.mozilla.org/show_bug.cgi?id=1369500)). NonCommercial plus ShareAlike is incompatible with any monetisation and awkward to bundle in an app store build.

Net effect: you would keep perhaps 10–20% of the code (matcher, some cleanup logic, strings), so "forking" amounts to a rewrite that also carries legacy baggage.

### What is worth borrowing (as ideas or reimplementation; copy under MPL if verbatim)
- **Tracking-protection matcher design** (`webview/matcher/`: `UrlMatcher`, `Trie`, `BlocklistProcessor`, `EntityListProcessor`, `FocusString`). It uses a reversed-domain trie per category (Advertising / Analytics / Social / Content), an **entity list** so first-party-owned domains are not blocked (for example google.com resources on youtube.com), and a webfont-blocking pseudo-category. Hooked in through `TrackingProtectionWebViewClient.shouldInterceptRequest()`, which returns an empty `WebResourceResponse` for blocked requests. This is a clean, fast design. **Reimplement it in Kotlin and feed it permissively licensed lists** (EasyList/EasyPrivacy GPLv3/CC BY-SA 3.0, downloaded at runtime and not bundled, [easylist.to licence](https://easylist.to/pages/licence.html); or Steven Black hosts, MIT). Disconnect's *JSON format* (categories to entities to domains) is a good model, but avoid the NC lists if monetisation is possible.
- **WebView hardening checklist** (from `WebViewProvider.java` v6.1.1): file and content access off, universal and file-URL access off, `setDatabaseEnabled(false)`, geolocation off, `setJavaScriptCanOpenWindowsAutomatically(false)`, third-party cookies toggle, block-images and block-JS toggles, X-Requested-With suppression (commit `3433aec`), and a custom UA token. Modern additions: `androidx.webkit` `WebSettingsCompat` / `ProxyController` / `ServiceWorkerControllerCompat` (service-worker requests bypass `WebViewClient` unless you hook them too), `WebViewCompat.setSafeBrowsingAllowlist`, and `WebViewFeature.REQUESTED_WITH_HEADER_ALLOW_LIST`.
- **Erase flow:** the floating trash button, the persistent "Erase browsing history" notification while a session is open, erase on task removal and on leaving the app, and cleanup of `CookieManager.removeAllCookies`, `WebStorage.deleteAllData`, cache, history and the WebView data directories (`WebViewDataTest` lists which `app_webview` folders must end up empty, which is a useful acceptance test).
- **UI ideas from the "old" Focus:** URL-bar-first start screen with no tabs or homepage clutter, the gradient purple background, the tracker counter badge and "shield" panel with per-category toggles, the "Open in…" / Custom Tabs support, Add-to-home-screen, the "focus:about" style internal pages, and search-suggestions opt-in. Recreate these in Compose with your own artwork.
- **Tests worth porting as specs:** `TrieTest`, `UrlMatcherTest`, `DisconnectTest`, `EntityListTest`, `WebViewDataTest`.

### Recommendation
**Start fresh**: Kotlin 2.x, Jetpack Compose (Material 3), `androidx.webkit`, minSdk 26–29, targetSdk 36. Keep the WebView in an `AndroidView`. Use a single-activity, single-session model with no tabs, or at most a few. Implement your own trie/hash matcher for blocking. Use **Jelly (Apache-2.0)** as the main code reference you may legally copy from. Use DuckDuckGo (Apache-2.0) for the fire-button and request-interception patterns, and Lightning/Fulguris for blocking engines (MPL/CPAL, so ideas only unless you accept those licences). Use old Focus `v6.1.1-RC3` as the UX and behaviour spec. If you ever copy a Focus file verbatim, keep it MPL-2.0 with the header. The simplest choice is to license the whole project MPL-2.0 or Apache-2.0 so that is easy.

---

## 6. Trademark note: "Focus" in the name

- Mozilla registers **"Firefox Focus"** (wordmark and logo), and also "Firefox Rocket". **"Focus" alone and "Klar" are not on the list** ([Mozilla trademarks list](https://www.mozilla.org/en-US/foundation/trademarks/list/)). Modified Mozilla code may not be distributed under Mozilla marks without written consent ([distribution policy](https://www.mozilla.org/en-US/about/partnerships/distribution/)).
- "Focus" is a crowded mark. Hubert Burda Media's **FOCUS** magazine is why Mozilla renamed the app **Klar** in Germany, Austria and Switzerland ([Mozilla SUMO](https://support.mozilla.org/en-US/kb/difference-between-firefox-focus-and-firefox-klar), [Mozilla press DE 2015](https://blog.mozilla.org/press-de/2015/12/08/app-focus-by-firefox-ein-content-blocker-fur-das-offene-web/)). Burda won a 1998 Cologne court ruling stopping Ford from using "Focus" for a car in Germany ([WardsAuto](https://wardsauto.com/ford/german-magazine-threatens-to-sue-ford-over-use-of-focus-name), [Marketing Week](https://www.marketingweek.com/1998/08/06/ford-settles-dispute-over-focus-brand/)).
- A browser named "*X* Focus" or "Focus *X*", especially with a similar purple look, invites a likelihood-of-confusion claim from Mozilla, because it is in the same product class and imitates the trade dress, and possibly a claim from Burda in the EU. "minifocus" is fine as an internal codename but **not as a public product name**. Pick a distinct name, avoid the Focus purple-gradient-plus-orb look, and never say "based on Firefox Focus" in store listings (factual credit in an About/licences screen is fine). This is not legal advice; do a quick EUIPO/USPTO search before you settle on a name.

---

## Sources

- Mozilla Hacks – Firefox Focus with GeckoView (2018): https://hacks.mozilla.org/2018/09/focus-with-geckoview/
- VentureBeat: https://venturebeat.com/business/mozilla-geckoview-firefox-preview-android
- linuxfr: https://linuxfr.org/news/firefox-focus-klar-avec-geckoview
- Packt Hub: https://hub.packtpub.com/developers-of-firefox-focus-set-to-replace-androids-webview-with-geckoview/
- ctrl.blog: https://o.ctrl.blog/entry/mozilla-gecko-focus.html
- focus-android (archived): https://github.com/mozilla-mobile/focus-android, with tags https://github.com/mozilla-mobile/focus-android/tags
- firefox-android (archived): https://github.com/mozilla-mobile/firefox-android
- mozilla-central Focus: https://github.com/mozilla-firefox/firefox/tree/main/mobile/android/focus-android and https://searchfox.org/firefox-main/source/mobile/android/focus-android/
- Bugzilla 1998292 (focus/klar flavors exist for the Klar trademark reason): https://bugzilla.mozilla.org/show_bug.cgi?id=1998292
- shavar-prod-lists licence: https://github.com/mozilla-services/shavar-prod-lists/blob/master/LICENSE
- Disconnect GPL history: https://bugzilla.mozilla.org/show_bug.cgi?id=1369500
- EasyList licence: https://easylist.to/pages/licence.html
- DuckDuckGo tracker-blocklists / tracker-radar: https://github.com/duckduckgo/tracker-blocklists, https://github.com/duckduckgo/tracker-radar
- Firefox Lite: https://github.com/mozilla-mobile/FirefoxLite, https://mobilesyrup.com/2021/07/06/mozilla-sunsets-firefox-lite-app/, https://ubergizmo.com/2021/07/mozilla-firefox-lite-browser-killed-off
- Jelly: https://github.com/LineageOS/android_packages_apps_Jelly
- Lightning: https://github.com/anthonycr/Lightning-Browser
- Fulguris: https://github.com/Slion/Fulguris
- FOSS Browser: https://codeberg.org/Gaukler_Faun/FOSS_Browser
- Privacy Browser: https://www.stoutner.com/category/privacy-browser-android/, https://www.stoutner.com/?p=4805, https://f-droid.org/packages/com.stoutner.privacybrowser.standard/
- DuckDuckGo Android: https://github.com/duckduckgo/Android
- Mull end of life: https://discuss.techlore.tech/t/the-divestos-project-has-ended/11593, https://discuss.privacyguides.net/t/the-end-of-mobile-divested-projects/23396
- Play target SDK: https://developer.android.com/google/play/requirements/target-sdk, https://support.google.com/googleplay/android-developer/answer/11926878
- Mozilla trademarks list: https://www.mozilla.org/en-US/foundation/trademarks/list/
- Mozilla distribution policy: https://www.mozilla.org/en-US/about/partnerships/distribution/
- Firefox Klar explanation: https://support.mozilla.org/en-US/kb/difference-between-firefox-focus-and-firefox-klar, https://blog.mozilla.org/press-de/2015/12/08/app-focus-by-firefox-ein-content-blocker-fur-das-offene-web/
- Burda vs Ford "Focus": https://wardsauto.com/ford/german-magazine-threatens-to-sue-ford-over-use-of-focus-name, https://www.marketingweek.com/1998/08/06/ford-settles-dispute-over-focus-brand/
