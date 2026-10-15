# MiniFocus — Plan v1

> Minimal, privacy-first Android browser on the **system WebView** (no bundled engine), with ad/tracker blocking, a one-tap Erase, and a car mode. UI spirit: old Firefox Focus (2017–2019).
>
> Status: **planning & design — awaiting go/no-go.** No app code yet.

Detailed research: [`research/`](research/) · Design system: [`design/DESIGN.md`](design/DESIGN.md) · Mockups: [`design/mockups/`](design/mockups/) (start with `00-overview.png`)

![Overview](design/mockups/00-overview.png)

---

## 1. Key decisions (from research)

| Question | Answer | Source |
|---|---|---|
| Did old Focus use WebView? | **Yes.** v1.0–6.x (2017–18) were WebView-only; v7 shipped both engines; GeckoView became default in v8.0.22 (Oct 2019); WebView code deleted 2021. | [01](research/01-firefox-focus-history.md) |
| Fork it? | **No.** Gradle 4 / Kotlin 1.2 / support libs / targetSdk 27, uses APIs removed in API 33, telemetry + Mozilla branding to strip, MPL headers. Start fresh; borrow *ideas* (URL-bar-first UI, erase flow, WebView hardening, trie matcher). | [01](research/01-firefox-focus-history.md) |
| Best code references | **DuckDuckGo Android** (Apache-2.0, WebView, best blocking architecture), **Jelly** by LineageOS (Apache-2.0, modern Kotlin). Avoid copying GPL/AGPL code (Privacy Browser, FOSS Browser). | [01](research/01-firefox-focus-history.md), [02](research/02-ad-blocking-and-privacy.md) |
| Ad-blocking engine | **MVP:** pure-Kotlin domain blocker (EasyList + EasyPrivacy + HaGeZi domain rules) in `shouldInterceptRequest`. **v2:** Brave **adblock-rust** (MPL-2.0) via our own JNI → full syntax + cosmetic filtering. | [02](research/02-ad-blocking-and-privacy.md) |
| Filter lists | EasyList/EasyPrivacy (GPLv3 / CC BY-SA), HaGeZi (GPLv3) — OK to bundle with attribution. **Not** Disconnect / DDG Tracker Radar / Peter Lowe (non-commercial). Serve updates from our own CDN, never hammer easylist.to. | [02](research/02-ad-blocking-and-privacy.md) |
| "Android CarPlay" | Android Auto **does not allow third-party browsers** (only games are a parked category as of Sep 2026). Browsers are a **beta parked category on Android Automotive OS** (internal testing only for now). | [03](research/03-car-mode-feasibility.md) |
| Name | "Focus" is risky (Firefox Focus is a Mozilla mark; Burda enforces "Focus" in Germany — why Focus is "Klar" there). Keep `minifocus` as codename; **pick a public name before Play Store.** | [01](research/01-firefox-focus-history.md) |

## 2. Feature scope

### MVP (v0.1 — "it's a browser you'd use daily")
- Gradient home with a single search/URL field; suggestions; search-engine choice (DuckDuckGo default)
- Single-session browsing (Focus-style), slim top bar, shield badge with live blocked count
- **Erase** FAB + erase-on-exit + Erase notification while app is in background (cookies, storage, cache, history, WebView `Profile` data)
- Ad & tracker blocking (Standard / Strict), per-site allowlist, shield bottom sheet with category breakdown
- Third-party cookies off, HTTPS-only upgrade, block web fonts (optional), per-site JavaScript toggle
- Overflow menu: share, open in…, desktop site, add to home screen, find in page
- Light / Dark / Gradient themes; Material 3 dynamic-free custom palette
- Bundled precompiled filter lists + weekly background update (WorkManager)
- No telemetry, no accounts

### v0.2 — Car
- **In-phone Car mode** (landscape/portrait dashboard UI: big voice button, ≥76 dp shortcut tiles, high contrast); browsing UI only when parked/passenger
- **Read aloud** (TTS of reader-mode article text) — the bridge to the car
- **Android Auto media app**: "MiniFocus – Read aloud" list of saved articles played via TTS (`MediaBrowserService` / Media3) — allowed while driving
- Test with Desktop Head Unit (DHU)

### v0.3 — Power
- adblock-rust engine via JNI (cosmetic filtering, scriptlets in isolated world)
- Tabs (optional, still minimal), private-only by default
- Reader mode, custom filter-list URLs, export/import settings
- **Android Automotive OS parked-browser build** (same APK, `car` feature flags) → internal testing track + Google early-access / "Car ready" nomination

### Explicitly out of scope
Own engine, sync/accounts, extensions, telemetry, browsing on Android Auto while driving.

## 3. Architecture

```
app/                      Compose UI, navigation, theming
core/browser/             WebView wrapper (MfWebView), WebViewClient/ChromeClient, Profile mgmt, erase
core/blocking/            ContentBlocker interface
  ├─ DomainBlocker        MVP: hashed host set, walks up subdomains, 3rd-party check
  └─ RustBlocker          v2: adblock-rust via JNI (CI-built .so)
core/filterlists/         bundled lists, compiler (build-time), updater (WorkManager)
core/settings/            DataStore prefs, per-site permissions (Room)
feature/car/              in-phone car mode UI, TTS reader
feature/auto/             Android Auto MediaLibraryService (Media3)
automotive/ (later)       AAOS parked-browser entry point
```

- **Stack:** Kotlin 2.x, Jetpack Compose (M3), `androidx.webkit` (≥1.15: Profile, `addDocumentStartJavaScript`, `ServiceWorkerClientCompat`), Coroutines/Flow, Hilt, DataStore, Room, WorkManager, Media3.
- **SDK:** minSdk 29 (Android 10), targetSdk 36.
- **Blocking path:** `shouldInterceptRequest` (worker thread) → skip main frame → 3rd-party? → `ContentBlocker.match(url, pageHost)` → return empty `WebResourceResponse` + bump counter. Same for service workers.
- **Hardening:** no file access, no content access, Safe Browsing on, `X-Requested-With` minimized via allow-list API, trimmed UA, Media Integrity API disabled, GPC header via `Profile#addCustomHeader`.
- **Known WebView limits:** no request bodies/resource type, no WebSocket/WebRTC interception, no in-app DNS-over-HTTPS (link to system Private DNS), YouTube in-stream ads not blockable, **Google sign-in blocks embedded WebViews** (test early; fall back to Custom Tab for OAuth).

## 4. Milestones

| # | Milestone | Deliverable |
|---|---|---|
| M0 | Project setup | Gradle (version catalog), modules, CI (GitHub Actions: build, lint, unit tests), debug APK artifact |
| M1 | Browser shell | Home → search → browse → back/forward, URL bar, menu, themes |
| M2 | Privacy core | Erase + erase-on-exit, cookies/HTTPS/JS settings, hardening |
| M3 | Blocking | DomainBlocker + list compiler + shield sheet + counter + allowlist + updater |
| M4 | Polish & beta | Erase animation, settings screen, accessibility, perf (cold start, block-match < 50 µs), F-Droid/Play internal track |
| M5 | Car | In-phone car mode, TTS read-aloud, Android Auto media app, DHU testing |
| M6 | v2 engine + AAOS | adblock-rust JNI, cosmetic filtering, AAOS parked build |

## 5. Open questions for you
1. **Public name** — keep "MiniFocus" as a codename only? Candidate directions: Hush, Bare, Lumen, Clearview, Minim (to be trademark-checked).
2. **Distribution** — Play Store, F-Droid, or both? (F-Droid needs fully FOSS build; fine with this plan.)
3. **License** — Apache-2.0 (lets us borrow from DDG/Jelly) vs GPLv3 (lets us borrow from more browsers, but stricter). Recommend **Apache-2.0** for code; lists keep their own licenses.
4. **Default search engine** — DuckDuckGo, or let the user pick on first launch?
5. **Tabs** — strict single-session like old Focus, or minimal tabs from MVP?

## 6. Dev environment needed on the Mac
Not installed yet: **JDK 17+**, **Android Studio** (SDK, emulator, DHU). Will set up at M0.
