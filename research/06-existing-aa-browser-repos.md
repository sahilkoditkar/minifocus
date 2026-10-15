# 06 — Existing open-source Android Auto browser / WebView repos

Research date: 2026-10-15. Method: `gh search repos`, `gh api search/code`, `gh api repos/...` (metadata, trees, file reads), plus web search. Nothing was cloned, built or run. Star counts and dates are as of today.

## TL;DR

There are **three distinct ways** people get a WebView onto the Android Auto (AA) screen. All three exist in open-source code we can read:

| # | Technique | Works while moving? | Install friction | Best reference |
|---|---|---|---|---|
| A | **Official "parked app"**: a plain `Activity` with `android.intent.category.CAR_LAUNCHER` and `android:appCategory="game"`. Needs Android 15+ on the phone. AA runs the activity full-screen on the head unit. | **No.** AA closes it when the car moves. | AA developer mode plus "Unknown sources". | `kododake/AABrowser` |
| B | **Car App Library surface**: a `CarAppService` in category `androidx.car.app.category.NAVIGATION` with a `NavigationTemplate`, plus `AppManager.setSurfaceCallback()`. The code feeds `SurfaceContainer.surface` into `DisplayManager.createVirtualDisplay(... OWN_CONTENT_ONLY \| PRESENTATION)`, then shows an `android.app.Presentation` holding a real `WebView` on that display. Taps, scrolls and flings from `SurfaceCallback` are replayed as `MotionEvent`s. | Yes. Navigation apps keep their surface while driving. **This is a safety and legal problem; gate it ourselves.** | "Unknown sources". Some phones or AA builds also need KingInstaller to spoof the Play installer. | `maxteneff/aabrowser-drive` (compact), `guitar-dev-io/autobridge` (best documented, MIT) |
| C | **Legacy unofficial AA SDK**: bundled `aauto.aar` / `gearhead-sdk.aar` with `com.google.android.apps.auto.sdk.CarActivity` and `CATEGORY_PROJECTION`. | Yes (hack) | Needs an unlock tool (AAWireless, aa-proxy-rs) or KingInstaller | Fermata, CarStream, `fcaronte/AABrowser`. **Avoid:** proprietary Google binaries and a fragile, old approach. |

**Best AA rendering reference:** `maxteneff/aabrowser-drive`, directory `app/src/main/java/com/kododake/aabrowser/car/`. It is about 45 KB across 5 files and covers the whole technique B pipeline. To read the same mechanism with very thorough comments, and under MIT, see `guitar-dev-io/autobridge`, `browser/CarHardwareWebWindow.kt` and `CarWebRenderer.kt`.

**Best minimal WebView ad-block browser reference:**
- **Code:** `anthonycr/Lightning-Browser`. It is MPL-2.0 (file-level copyleft, so easy to borrow from) and active again Aug–Oct 2026. Look at `adblock/BloomFilterAdBlocker.kt` and `HostsFileParser.kt`.
- **The original Focus behaviour:** the archived `mozilla-mobile/focus-android` at tag `v6.0-RC4`, in the `app/src/webview/` flavor. Look at `TrackingProtectionWebViewClient.java` and `matcher/UrlMatcher.java`, which match against the Disconnect lists. This is MPL-2.0 but archived.

---

## Ranked shortlist (top 5)

### 1. maxteneff/aabrowser-drive: best AA-rendering reference (technique B)
- URL: https://github.com/maxteneff/aabrowser-drive
- 0★ · **GPL-3.0** · Kotlin · created and last committed 2026-10-05 (one day of commits, one author) · fork-by-copy of kododake/AABrowser
- **What it does:** keeps the kododake phone browser and adds a "driving-mode car app that renders the browser on a navigation surface." The car screen opens on m.youtube.com by default.
- **Key files** (`app/src/main/java/com/kododake/aabrowser/car/`):
  - `BrowserCarAppService.kt`: `CarAppService` → `Session` → `setSurfaceCallback(BrowserSurfaceCallback)`. The screen returns a `NavigationTemplate` whose action strip has a "toggle chrome" button. It uses `HostValidator.ALLOW_ALL_HOSTS_VALIDATOR`.
  - `CarBrowserController.kt` (12 KB) does four things:
    - `createVirtualDisplay(name, w, h, dpi, surface, OWN_CONTENT_ONLY | PRESENTATION)`
    - reuses the display through `virtualDisplay.surface = surface` when the geometry is unchanged
    - keeps the `WebView` alive in a `MutableContextWrapper` across surface churn
    - turns `onClick`, `onScroll`, `onFling` and `onScale` into synthetic `MotionEvent`s dispatched to `presentation.window.decorView`. A click is a down/up pair 40 ms apart, and a scroll becomes a synthetic drag.
  - `CarBrowserPresentation.kt` (19 KB): a `Presentation` holding the WebView, URL bar, progress bar, bookmarks panel and a fullscreen-video container. It sets `FLAG_ALT_FOCUSABLE_IM` so the phone IME never pops up.
  - `CarKeyboardView.kt`: an on-car-screen keyboard, needed because no IME works on the virtual display.
  - Manifest: permissions `androidx.car.app.ACCESS_SURFACE`, `NAVIGATION_TEMPLATES` and `MAP_TEMPLATES`; the service sits in category `androidx.car.app.category.NAVIGATION`.
- **Quality:** small, readable and well commented. No tests. Brand new and unproven.
- **Reusable?** **Yes, this is the template to copy** (we must accept GPL-3.0, or clean-room it from the description above). Adding a "parked only" gate through `CarHardware` speed or `CarConnection` is our job.

### 2. kododake/AABrowser: most popular AA browser; parked-app path (technique A)
- URL: https://github.com/kododake/AABrowser
- **601★**, 172 forks · **GPL-3.0** · Kotlin + Compose (Material 3 Expressive) · last commit 2026-10-13 (v3.3) · active since Oct 2025, about 6 contributors · minSdk 35, so **Android 15+ only**
- **What it does:** a full WebView browser (tabs, bookmarks, start page, UA/desktop toggle, Widevine L3 video, voice input) that AA launches as a parked app.
- **How:**
  - `AndroidManifest.xml` declares `MainActivity` with `CAR_LAUNCHER` plus `androidx.car.app.category.NAVIGATION` plus `APP_MAPS`, `android:appCategory="game"`, `distractionOptimized` and `automotive_app_desc` (`<uses name="media"/>`).
  - It needs no special installer, only AA "Unknown sources".
  - Google's docs say games are currently the only parked category AA supports, which is why the app is labelled a "game". AA closes it when the car moves.
- **Caveats:**
  - README: **"No Ad Blocking: not currently implemented."**
  - It ships **Umami analytics** (`analytics/UmamiTracker.kt` sends an `app_open` event with an anonymous UUID). This is a privacy red flag; strip it in any fork.
  - It uses `woheller69:FreeDroidWarn`.
- **Quality:** large and well modularised (`web/ConfiguredWebView.kt`, `BrowserWebViewClient.kt`, `tabs/`, `UserAgentManager.kt`). Lint is clean. Only stub tests.
- **Reusable?** Yes for the parked path: copy the manifest entries, which need almost no code. The WebView setup classes in `web/` are also useful.
- **Derivatives seen:**
  - `shubhampatel3355/DriveLaunch` (GPL-3.0, 3★)
  - `laimaruthi/DriveBrowser` (no licence, adds a StevenBlack hosts `adblock/AdBlocker.kt`)
  - `nrknithin/AABrowser`
  - `kiranaidev/drivecast`
  - `maxteneff/aabrowser-drive` (#1)

### 3. guitar-dev-io/autobridge: best-documented technique B, permissive licence
- URL: https://github.com/guitar-dev-io/autobridge
- 3★ · **MIT** · Kotlin · created 2026-09-08, commits daily (latest 2026-10-15, v0.4.58-rc9) · 583 `.kt` files, has instrumented tests (`CarHardwareWebWindowTest`, `OffscreenWebViewWindowTest`)
- **What it does:** a "parked-only phone-to-AA surface bridge" with a car browser, video engines, MediaProjection mirroring, an ad-block list and much more.
- **Key files:**
  - `browser/CarHardwareWebWindow.kt`: VirtualDisplay(car surface) → hardware-accelerated `Presentation` → WebView. Its KDoc explains why `WebView.draw(Canvas)` loses `<video>` while a real window does not. It handles surface churn with `VirtualDisplay.setSurface` and a "parked sink". On a size change it recreates the window, because `Presentation` dismisses itself when its display metrics change.
  - `CarWebRenderer.kt`, `CarSurfaceKeyboard.kt`, `FullscreenVideoController.kt`, `browser/AdBlockList.kt`, `BrowserAdBlock.kt`
  - `car/AutoBridgeCarAppService.kt` and `CarBrowserScreen.kt`
- **Caveats:**
  - The project is huge and churning, with one author, and was very new when checked.
  - **Do not borrow its "safety bypass" code:** the README says the parked gate currently only reports and does not block. It also has an opt-in gate override.
- **Reusable?** Yes. MIT means we can lift `CarHardwareWebWindow` and its helpers into any licence. It is the best "why it works" documentation found.

### 4. anthonycr/Lightning-Browser: best ad-block code to borrow
- URL: https://github.com/anthonycr/Lightning-Browser
- **2,439★** · **MPL-2.0** · Kotlin · last commit 2026-10-13. About 100 commits Aug–Oct 2026 (revived: Compose, Gradle 9.8, Kotlin 2.4). 316 source files.
- **What it does:** a lightweight WebView browser.
- **Key files:** `app/src/main/java/acr/browser/lightning/adblock/BloomFilterAdBlocker.kt`, `parser/HostsFileParser.kt`, `allowlist/*`, bundled `assets/hosts.txt`.
- **Quality:** long-lived, tested and well structured.
- **Reusable?** The ad-block package is self-contained. Under MPL-2.0 the copied files stay MPL, but the rest of our app can use any licence.
- **Related:** `Slion/Fulguris` (842★, MPL-2.0 + CPAL, active Oct 2026) is a Lightning fork with a full **ABP-syntax** engine: `fulguris/adblock/AbpBlocker.kt`, `AbpListUpdater.kt`. Use it if we want EasyList rules instead of a hosts file.

### 5. woheller69/browser ("FREE Browser"): smallest privacy WebView browser with ad blocking
- URL: https://github.com/woheller69/browser · on F-Droid
- 305★ · **GPL-3.0** · Java · last commit 2026-07-07. Steady but slow: 1–2 commits a month in 2025–26. **57 source files.**
- **What it does:**
  - StevenBlack hosts ad blocking (`de/baumann/browser/browser/AdBlock.java`: a HashSet of hosts plus a parent-domain walk)
  - anti-fingerprinting measures
  - cookie-banner auto-deny using Mozilla's cookie-banner-rules list
  - per-domain JS, cookie and DOM-storage toggles
  - userscripts
- **Caveat:** the README says the app will stop working on certified devices once Google's 2026/27 developer-verification rule lands, because the dev refuses to register. The same risk applies to our sideloaded APK (see Risks).
- **Reusable?** Yes, as a readable small reference for "privacy WebView defaults". It is the closest thing to a minimal Focus-like WebView app.

---

## Other repos checked

### Android Auto rendering

| Repo | ★ | Licence | Last commit | Technique / notes | Verdict |
|---|---|---|---|---|---|
| [AndreyPavlenko/Fermata](https://github.com/AndreyPavlenko/Fermata) | 1,423 | GPL-3.0 | 2026-09-20 | The `auto` flavor uses legacy `aauto.aar` (`MainCarActivity extends com.google.android.apps.auto.sdk.CarActivity`, `CATEGORY_PROJECTION`). The web addon is `modules/web/` (`FermataWebView`, `WebBrowserFragment`, YouTube addon with SponsorBlock). `MirrorServiceFS` is a Car App Library NAVIGATION service that mirrors the phone through **MediaProjection** (`MirrorDisplay.java`), not own-content. | Good for reading the YouTube/WebView media tricks. The AA layer is legacy or a mirror; don't copy it. |
| [thekirankumar/carstream-android-auto](https://github.com/thekirankumar/carstream-android-auto) | 400 | Apache-2.0 | 2019-05-28 | The original "YouTube on AA" using the legacy aauto SDK `CarActivity`. | Dead. Historical only. |
| [fcaronte/AABrowser](https://github.com/fcaronte/AABrowser) | 17 | MIT* | 2026-10-07 | Revives [slashmax/AABrowser](https://github.com/slashmax/AABrowser) (2020, no licence) on the legacy SDK. It also has a Car App Library `car/CarServiceWide.kt`/`WideScreen.kt` surface variant, plus `utils/AdBlockHost.kt` and `AdBlockJavascript.kt`. | *Bundles proprietary Google `gearhead-sdk.aar`/`aauto.aar` in `browser/libs/`. The README says it was "developed through arguments with Gemini" and is buggy. Needs AAWireless, aa-proxy-rs or KingInstaller to appear. Avoid. |
| [lowyihong1314/android-auto-youtube](https://github.com/lowyihong1314/android-auto-youtube) | 0 | none | 2026-10-09 | Car App Library surface + VirtualDisplay + Presentation, on-screen keyboard and touch replay (YouTube TV). | Same technique as #1. No licence, so we can read it but not copy it. |
| [IngridMorstrad/AndroidAutoBrowser](https://github.com/IngridMorstrad/AndroidAutoBrowser) | 0 | none | 2026-08-26 | Multi-module: an `auto-media` module exposes web audio as a `MediaBrowserService` (offscreen WebView plus JS bridge), and a `car-browser` module targets AAOS. | An interesting "audio-only on AA" idea. No licence. |
| [sckzw/AAWidget](https://github.com/sckzw/AAWidget) | 5 | GPL-3.0 | 2026-09-22 | `AAWidgetScreen.java` renders `AppWidgetHostView` through `SurfaceCallback` → `VirtualDisplay` → `Presentation`. | A small, clean, Java example of technique B with a non-browser view. |
| [mstipanov/MyCar](https://github.com/mstipanov/MyCar) | 0 | MIT | 2026-10-14 | Car App Library surface fed by MediaProjection screen mirroring, plus accessibility touch injection. | Mirror approach, not our model. |
| [xuanthanhtn96/AACast-Doudou](https://github.com/xuanthanhtn96/AACast-Doudou) | 6 | none | 2026-09-29 | Xposed/root hooks into Gearhead to split the AA screen. | Root required. Skip. |
| [birkir/react-native-carplay](https://github.com/birkir/react-native-carplay) | 808 | MIT | 2025-09 | `android/.../utils/VirtualRenderer.kt`: VirtualDisplay + Presentation on an AA navigation surface, from a mature library. | A good permissive second reference for the VirtualDisplay/Presentation lifecycle. |
| [aa-proxy/aa-proxy-rs](https://github.com/aa-proxy/aa-proxy-rs) | 492 | GPL-2.0 | 2026-10-15 | Raspberry Pi wireless AA proxy that can "unlock" apps. | Other direction (head-unit side). Skip. |
| [fcaronte/KingInstaller](https://github.com/fcaronte/KingInstaller) | 561 | GPL-3.0 | 2026-10-03 | Installs an APK with the Play Store spoofed as installer so AA lists it. | A possible install helper. Not code to borrow. |

Not on GitHub as source: **Screen2Auto**, **AA Mirror**, and the **CarTube**-for-AA repos (`Raperowy/CarTube` and others). Those repos only hold APKs or release pages. `Avangelista/CarTube` (567★) is iOS CarPlay. No repo named "AAWebBrowser" exists; the "AA Browser" name belongs to kododake (current) and slashmax (2020).

### Minimal WebView ad-block browsers

| Repo | ★ | Licence | Last commit | Notes |
|---|---|---|---|---|
| [plateaukao/einkbro](https://github.com/plateaukao/einkbro) | 2,030 | GPL-3.0 | 2026-10-11 (≈100 commits Aug–Oct) | Kotlin WebView browser with a vendored `ad-filter/` module (Edsuns AdFilter, ABP syntax plus element hiding and scriptlets). 373 files, feature-heavy. |
| [Slion/Fulguris](https://github.com/Slion/Fulguris) | 842 | MPL-2.0/CPAL | 2026-10-12 | Lightning fork with an ABP engine (see #4). |
| [CookieJarApps/SmartCookieWeb](https://github.com/CookieJarApps/SmartCookieWeb) | 358 | MPL-2.0 | 2026-07 (otherwise mostly dormant since 2023) | Lightning fork. Stale. |
| [LineageOS/android_packages_apps_Jelly](https://github.com/LineageOS/android_packages_apps_Jelly) | 95 | Apache-2.0 | 2026-10-07 | **The most minimal** WebView browser (57 files, Kotlin). Permissive licence, steady maintenance. **No ad blocking.** A good base skeleton if we want Apache-2.0. |
| [duckduckgo/Android](https://github.com/duckduckgo/Android) | 4,855 | Apache-2.0 | 2026-10-15 | A WebView-based privacy browser with a tracker blocker. Very large and modular, so it is a reference rather than a fork base. |
| [egeeuzun/orbit](https://github.com/egeeuzun/orbit) | 4 | none shown | 2026-09 | WebView plus **Brave adblock-rust** through JNI (`adblock/NativeAdblock.kt`, `AdblockEngine.kt`) with uBO/AdGuard lists. A useful pattern if we want uBO-grade blocking; check the licence before copying. |
| [brave/adblock-rust](https://github.com/brave/adblock-rust) | 2,864 | MPL-2.0 | 2026-09-29 | Engine only. It would need our own JNI/NDK build. |
| [Edsuns/AdblockAndroid](https://github.com/Edsuns/AdblockAndroid) | 96 | LGPL-2.1 | 2021 | A WebView ABP-filter library, unmaintained. EinkBro vendors a maintained copy. |
| [marcelbohland/Android-Webview-Adblock](https://github.com/marcelbohland/Android-Webview-Adblock) | 52 | Apache-2.0 | 2026-01 | A tiny hosts-in-`shouldInterceptRequest` example. |
| [mozilla-mobile/focus-android](https://github.com/mozilla-mobile/focus-android) @ `v6.0-RC4` | 2,087 | MPL-2.0 | archived 2022 | The real Focus WebView engine: `app/src/webview/java/org/mozilla/focus/webview/{SystemWebView,TrackingProtectionWebViewClient}.java`, `matcher/{UrlMatcher,Trie,EntityList,BlocklistProcessor}.java`. It is exactly "Focus-style" blocking (Disconnect lists plus an entity allow-list). Archived, so we would need to port it to Kotlin. |

Not verified: Stoutner's *Privacy Browser* (GPL-3.0, WebView). It is hosted off GitHub, and the GitHub hits I found are stale mirrors.

---

## Recommendation for minifocus

1. **Base browser:** we are inventing little here. Two options:
   - **Permissive:** start from Jelly's skeleton (Apache-2.0). Add the Lightning `BloomFilterAdBlocker` and hosts parser (MPL files), or port Focus v6's `UrlMatcher` for Disconnect-list parity.
   - **GPL-3.0 is fine:** fork kododake/AABrowser, delete `analytics/UmamiTracker.kt`, and add ad blocking (DriveBrowser's hosts `AdBlocker.kt` approach, or the einkbro `ad-filter` module).
2. **AA mode: ship both paths.** There is little code for either.
   - **Path A (parked):** manifest only, as in kododake: `CAR_LAUNCHER`, `appCategory="game"`, `distractionOptimized`. It is Google-sanctioned, AA auto-closes it when the car moves, and it needs Android 15+.
   - **Path B (Car App Library surface):** model on `maxteneff/aabrowser-drive/.../car/*` and `autobridge/CarHardwareWebWindow.kt`. **Add our own parked gate** (CarHardware `Speed`/`CarInfo`, fail-closed on unknown) so the browser does not run while the car is moving.
3. Licence decision first. Every working AA browser with a real UI is GPL-3.0, except autobridge, which is MIT.

## Risks noted
- **Install visibility:** the AA "Unknown sources" toggle is required. Some phones or AA builds still hide apps that were not installed by Play (fcaronte's README, GrapheneOS forum), and KingInstaller is the usual workaround.
- **Google developer verification for sideloaded apps:** it starts rolling out in late 2026 in a few countries before going global (Engadget; also the woheller69 README). A sideloaded APK from an unverified developer may stop installing on certified devices.
- **DRM:** WebView gets Widevine L3 only, so some streaming sites won't play (kododake README).
- **The AA host can change behaviour at any time.** Technique B relies on navigation-category leniency that Google may tighten.

## Sources
- https://developer.android.com/training/cars/parked/auto (CAR_LAUNCHER parked apps, Android 15+, "Games are the only parked app category supported by Android Auto at this time")
- https://developer.android.com/training/cars/platforms/android-auto
- https://www.androidauthority.com/sideload-apps-on-android-auto-3681820/
- https://discuss.grapheneos.org/d/10599-android-auto-implement-a-workaround-for-apps-not-installed-via-google-play
- https://engadget.com/2246259/how-to-sideload-android-auto-apps
- https://newreleases.io/project/github/kododake/AABrowser/release/v3.3
- GitHub repos linked above (metadata read with `gh api`, 2026-10-15)
