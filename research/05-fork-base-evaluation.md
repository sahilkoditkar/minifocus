# 05: Fork-base evaluation (DuckDuckGo Android vs. alternatives)

*Research date: 2026-10-15. Method: blobless shallow clone of `duckduckgo/Android` at `develop` (commit `04bb95f`, 2026-10-15). Sparse clone of `mozilla-firefox/firefox` (`mobile/android/focus-android` plus gradle plumbing). The GitHub API was used for release and commit counts, and F-Droid `fdroiddata` metadata was read directly. Nothing was built or run. A label of "(estimate)" marks a judgement, not a measurement.*

**Question.** The owner does not want to maintain a browser. Can we fork an actively maintained browser and keep a small **patch layer** on top? That layer would hold rebranding, a few UI tweaks and an Android Auto entry point. Claude Code would re-apply it on each upstream release, and GitHub Actions would build a sideloadable APK.

---

## TL;DR

| Rank | Base | Fit to "Focus-like + WebView + blocking + Erase + car" | Build from public repo | Patch-layer cost (estimate) |
|---|---|---|---|---|
| **1** | **DuckDuckGo Android, as an *overlay* fork** (additive module plus scripted transforms) | WebView ✔, tracker blocking ✔, Fire/Erase ✔ (and a new ephemeral **Fire mode**), Focus look only partly achievable | **Yes.** `assembleFdroidRelease` on a stock `ubuntu-latest` runner with no secrets. F-Droid already ships it. | **About 0 textual conflicts per release** if we never edit hot files. About 1–2 h/month of compile fixes and new-feature denylisting. **Rebasing edits to `BrowserTabFragment` would conflict about every 2–4 weekly releases.** |
| **2** | **Firefox Focus (GeckoView)**, extracted to a standalone repo in the style of `reference-browser` | Closest product: Focus UI, erase and single session. Mozilla maintains it. **Not WebView.** APK grows by about 50–70 MB. | **Hard.** In-tree it needs `./mach bootstrap` plus an artifact build of the 5.5 GB monorepo. Extracting it means rewriting about 50 `project(':components:…')` lines to Maven coordinates and copying in-tree Gradle plugins. No maintained third-party Focus fork exists. | UI patches rarely conflict (`BrowserFragment.kt`: 19 commits in 2026). **Build plumbing probably breaks every few Firefox releases** (13 per year). Initial extraction is 1–3 days, then 0–3 h per release. |
| 3 | Jelly (LineageOS) plus our own blocking/erase | Tiny, modern, Apache-2.0, **no blocking** | Trivial | Low rebase cost, but **we would own blocking and erase**. That is "maintaining a browser", which the owner wants to avoid. |
| 4 | Lightning | MPL-2.0, hosts-file blocking, full-featured. No tagged release since 2019. | Easy | Medium. Unclear release points, and the UI is far from Focus. |
| 5 | Fulguris | CPAL-1.0 badgeware on new files, Firebase, large | Easy | Medium-high. Licence friction. |
| 6 | IronFox (Gecko/Fenix) | Full Firefox, not minimal | **Very heavy.** Builds Gecko from source. | High |
| 7 | Cromite (Chromium) | Own engine, 333 patches on Chromium | **Extreme.** About 100 GB+ disk, hours of build time, self-hosted runner needed. | Very high. Even upstream lags (148 to 153 took May to Sept 2026). |

**Recommendation.** Take **DuckDuckGo-overlay** as the default path. It meets the original WebView requirement, its builds are already proven reproducible without credentials, and its plugin architecture lets us add features **without editing upstream files**. Accept that the UI will be "DDG with a Focus-style home page and an Erase FAB", not a pixel copy of 2018 Focus. If the owner wants **exactly the Focus UI** and accepts GeckoView, spend 1–2 days on a **spike**: extract Focus against Maven Android Components and GeckoView. Switch to that path only if the spike builds cleanly on GitHub Actions for two consecutive Firefox releases.

---

## 1. DuckDuckGo Android: size, structure, cadence

| Metric | Value | Source |
|---|---|---|
| Default branch | `develop` | `gh repo view` |
| Repo size (GitHub) | 368 MB on GitHub. A blobless shallow checkout is about 160 MB, of which `.git` is 39 MB. 10,906 files. | measured |
| Gradle modules | **About 199** (auto-discovered: any dir or subdir with `build.gradle`, see `settings.gradle`). Every feature uses the `-api` / `-impl` / `-internal` / `-store` pattern. | `settings.gradle`, `find` |
| Code size | **About 482k lines** of non-test Kotlin/Java. The `:app` module alone is about 118k lines. | `wc -l` |
| Languages (GitHub) | Kotlin 35.4 MB (≈99%). Small amounts of JS/HTML (bundled `@duckduckgo/*` npm packages committed in `node_modules`), Python, C++ (bloom filter), Ruby (fastlane). | `gh` |
| SDK / toolchain | minSdk 28, target/compileSdk 36, **JDK 21**, AGP via refreshVersions. DI is Anvil/Dagger with a **migration to Metro in flight** (`gradle.properties: ddg.di=Metro`). | `build.gradle`, `gradle.properties`, repo `CLAUDE.md` |
| Licence | Apache-2.0 (code) | `LICENSE` |
| 2026 commits to `develop` | **2,326** (Jan 1 to Oct 15) | GitHub API |
| **Releases in 2026** | **63 releases**: Jan 8, Feb 6, Mar 8, Apr 5, May 7, Jun 8, Jul 7, Aug 5, Sep 5, Oct 4 (to the 14th). That is **about 6.3 per month**, a new minor version **every week** (5.261 to 5.298) plus hotfix patch releases. There are also daily `LGC-*` tags (nightly "last good commit"). | GitHub releases API |
| Release asset | Only `duckduckgo-5.298.1-play-release.apk` is attached to GitHub releases. | releases API |

**Consequence for the patch layer.** Tracking every release means about 50 rebuilds per year. The sensible policy is **automated** tracking: a scheduled Action builds every new tag. A **human or Claude** only looks when the build fails, and only every 2–4 weeks, not weekly.

---

## 2. Can it be built from the public repo without private credentials?

**Yes, using the `fdroid` flavor.** The evidence:

- **Flavors.** `app/build.gradle` defines `productFlavors { internal; fdroid; play }` on a `store` dimension, and `fdroidDebug` is filtered out. `fdroid` swaps three Google-dependent implementations for dummy ones:
  - `:subscriptions-dummy-impl` replaces `:subscriptions-impl`, which uses Google Play **Billing** 8.3.0. So **Privacy Pro / subscriptions are compiled out** in fdroid.
  - `:persistent-storage-dummy-impl` replaces `:persistent-storage-impl`, which uses **play-services-auth-blockstore**.
  - `:credential-exchange-dummy-impl` replaces `:credential-exchange-impl`, which uses `providerevents-play-services`.
  - `referral-impl` only pulls `installreferrer` for `play`. `app/src/play/` also adds the HTTPS-upgrade embedded bloom file and the referrer pixel sender. `app/src/fdroid/` contains only no-op tracers and seeders plus a network-security config.
- **No `google-services.json`, no Firebase, no Crashlytics.** I searched all build files and found Play libraries in only the three modules above.
- **Signing.** Release signing reads `$HOME/jenkins_static/com.duckduckgo.mobile.android/*.properties`. If that file is missing, the build prints "release artifacts will not be signed" and still succeeds. We sign with our own key in CI.
- **Proprietary font.** `DuckSans` is a commercial Fontwerk font fetched from `maven.pkg.github.com/duckduckgo/native-apps-ducksans` only when GPR credentials exist. Otherwise the in-repo `:fonts` shim provides empty `<font-family/>` resources that fall back to the system font. The validation task only guards `PlayRelease` and `InternalRelease`. **fdroidRelease builds fine without the font.** The NOTICE file forbids redistributing DuckSans, so we must never include it.
- **Secrets that only affect features, not the build:**
  - `MALICIOUS_SITE_PROTECTION_AUTH_TOKEN` is baked into `BuildConfig` and sent as `X-Auth-Token` to DDG's scam/phishing API. **Without it, malicious-site protection will not authenticate**, so expect 401s and the feature is effectively off. Tracker blocking is unaffected.
  - `NETP_DEBUG_SERVER_TOKEN` (VPN debug only) and `DEVELOCITY_ACCESS_KEY` (build cache) are optional.
- **DDG's own CI proves it.** `.github/workflows/build-fdroid-apk.yml` runs `./gradlew assembleFdroidRelease` on **`ubuntu-latest`** (a stock 4-vCPU runner) on every push to `develop`, with submodules (`bloom_cpp`, `privacy-grade`) checked out recursively.

### F-Droid
`fdroiddata/metadata/com.duckduckgo.mobile.android.yml` exists and is current: latest **5.296.0** (Sept 2026). It is categorised Browser and **AI Chat**, with AntiFeature `NonFreeNet` because DuckDuckGo is the only search engine. Its `prebuild` recipe is a ready-made "de-Google" patch set we can copy:

```
sed -i -e 's|maven.pkg.github.com/duckduckgo/native-apps-ducksans|jitpack.io|' build.gradle
sed -i -e '/com.android.billingclient:billing/d' subscriptions/subscriptions-impl/build.gradle
sed -i -e '/play-services-auth-blockstore/d' persistent-storage/persistent-storage-impl/build.gradle
sed -i -e '/KotlinX.coroutines.playServices/d' persistent-storage/persistent-storage-impl/build.gradle
sed -i -e '/useUploadSigning/,+4d' app/build.gradle
rm app/src/play/res/raw/https_mobile_v2_bloom.bin ; scandelete app/src/androidTest
gradle: [fdroid]   ndk: 28.2.13676358   submodules: true
```

F-Droid needs these lines because its scanner checks all source, not just the flavor being built. **We do not strictly need them**, because `fdroidRelease` never links those libraries. They are still a good blueprint for a clean, reproducible build.

**What the fdroid flavor does *not* remove:** Sync, Duck.ai, VPN/AppTP, autofill, email protection, Duck Player, pixels/ATB telemetry, remote messaging, onboarding, PIR. All of these are still compiled in and controlled by remote config.

---

## 3. Features a minimal browser doesn't want: how deeply wired are they?

### 3.1 The control plane: DDG remote config, and a clean lever for a fork

Almost every feature is a `@ContributesRemoteFeature` interface (**263 of them**) whose `Toggle`s have a compiled default (`@Toggle.DefaultValue`). These defaults are **overridden at runtime by DDG's privacy config**: `PRIVACY_REMOTE_CONFIG_URL = https://staticcdn.duckduckgo.com/trackerblocking/config/v6/android-config.json` (619 KB, 195 features). As of today it has `aiChat` (40 subfeatures), `sync`, `privacyPro`, `networkProtection`, `appTrackerProtection`, `duckPlayer`, `autofill`, `incontextSignup`, `remoteMessaging`, `pir` and `adBlockingExtension` **all `enabled`**.

So **if a fork uses DDG's config unchanged, DDG decides which features appear in our app.** New promos, Duck.ai entry points and the like will show up with no code change on our side.

**The lever.** DDG's internal flavor already contains `DevPrivacyConfigPatchApiInterceptor` (`privacy-config-internal`). It is an OkHttp `ApiInterceptorPlugin` that intercepts that exact URL and applies **RFC 6902 JSON patches** before the app parses the response. A fork can ship its own copy, about 80 lines in a **new** module. The copy would force `state: "disabled"` on the features we don't want. Points in its favour:
- No signature on the config. `PrivacyConfigPersister`'s "signature" is only a hash of the local plugin list.
- The `ApiInterceptorPlugin` interface has had **0 commits since 2025**.
- Interceptors are added to the shared `@Named("api") OkHttpClient` in `NetworkModule` (4 commits in 2026).

**Risk.** Each feature checks its toggle in different places, so a disabled feature can still leave stray UI (a settings row, an empty-state card). Each one found needs a small fix. A **denylist** also misses features DDG adds later. Plan a monthly diff of `features` keys, which can be automated: the Action fails when unknown top-level keys appear.

### 3.2 Telemetry (pixels and ATB)

- **1,101 call sites** use `pixel.fire(…)` / `enqueueFire(…)`. They all go through **one** Retrofit `PixelService` (`https://improving.duckduckgo.com/t/{name}_android_{formFactor}`) on the `@Named("nonCaching")` client.
- That client installs every `PixelInterceptorPlugin`. The interface has been unchanged since 2023-11. A fork plugin that **short-circuits every request with a synthetic `200`** kills all pixels in one new file.
- **ATB** is the install-cohort ID (`/atb.js`, `/exti/` on duckduckgo.com via `StatisticsService`). It also travels on the `api` client and is appended to DDG search URLs. Handle it with the same interceptor approach. To strip the `atb` param from search URLs, replace the `RequestRewriter` binding using Anvil `replaces`.
- `EnqueuedPixelWorker` compares `applicationId` to `com.duckduckgo.mobile.android`, so pixels from a renamed package are already flagged as non-official.

### 3.3 Per-feature assessment

| Feature | Where | Compile-out possible? | Practical approach for a fork | Coupling into `:app` |
|---|---|---|---|---|
| **Privacy Pro / subscriptions** | `subscriptions/*` | **Already dummy in fdroid** | Nothing to do. Also disable `privacyPro` in the config patch to hide marketing. | 12 files |
| **VPN (NetP)** | `network-protection/*`, `vpn-network` | No, impl is wired | Config patch: `networkProtection` disabled. It is gated behind a subscription anyway, which is dummy. | 7 files |
| **AppTP** (App Tracking Protection) | `app-tracking-protection/*` | No | Config patch: `appTrackerProtection` disabled. Its VPN service stays in the manifest but is never started. | 2 files |
| **Sync** | `sync/*` (7 modules) | No | Config patch: `sync` disabled. Also hide the settings row. | 17 files, 0 in BrowserTabFragment |
| **Duck.ai** | `duckchat/*` | No | Config patch: `aiChat` disabled. **The most deeply wired feature**: 55 files in `:app` and **11 imports in `BrowserTabFragment`**. Expect stray entry points (omnibar button, menu). | high |
| **Duck Player** | moved into `ad-blocking` module (June 2026, #8785) | No | Config patch: `duckPlayer` disabled | low |
| **Autofill / passwords** | `autofill/*` | No | User-level setting. Leave it, or disable via config. **31 imports in `BrowserTabFragment`.** | high |
| **Email protection** | `autofill` + `email` package | No | Config patch: `incontextSignup` and email features disabled | medium |
| **Remote messaging** (in-app promos) | `remote-messaging/*` | No | Config patch: `remoteMessaging` disabled, or interceptor-block `staticcdn…/remotemessaging/…` | low |
| **PIR** (data-broker removal) | `pir/*` | No | Subscription-gated, so it stays dormant. Config patch to be safe. | low |
| **Onboarding** (Dax dialogs) | `onboarding/*`, `app/onboarding` (**126 commits in 2026**) | No | A `CAN_SKIP_ONBOARDING` build flag exists (`-Pskip-onboarding`). Otherwise replace `OnboardingFlowChecker` via Anvil `replaces`. **Don't patch the onboarding code itself.** It is a high-churn area. | medium |
| **Surveys** | `survey/*` | No | Interceptor-block `staticcdn…/survey/…` | low |

**Conclusion.** None of these are cheap to *delete*. Removing an `-impl` module leaves unsatisfied Dagger/Metro bindings across about 196 `project(...)` dependencies. All of them are cheap to **disable** from additive code: a config-patch interceptor, a pixel kill-switch interceptor, and a few Anvil `replaces = [...]` bindings. The codebase already uses `replaces` in 16 places. The APK stays large (about 30–40 MB, estimate), but nothing runs.

### 3.4 Are the Fire button and tracker blocking cleanly separated?

- **Tracker blocking:** **separated in practice, not in modules.** The core lives in `:app`: `app/trackerdetection/*` (TdsClient, TrackerDetector), `WebViewRequestInterceptor.kt` (465 lines, **12 commits in 2026**) and `BrowserWebViewClient.kt` (25 commits).
  - Supporting modules: `request-filterer`, `httpsupgrade`, `element-hiding`, `cookies`, `autoconsent`, `fingerprint-protection`, `content-scope-scripts`, `malicious-site-protection`, and the new `ad-blocking` (scriptlet-based ad blocking, remotely gated, default off).
  - A bundled `app/src/main/res/raw/tds.json` (1.57 MB) covers the first run. Updates come from `staticcdn.duckduckgo.com/trackerblocking/v5/current/android-tds.json`.
  - This is **low-churn and we never need to touch it.** That is the main reason DDG is attractive.
- **Fire / Erase:** `data-clearing-api/-impl` exposes `FireDialogProvider.createFireDialog(origin)`, `DataClearingTrigger.clearData(types)` and `DataClearingPlugin`. The UI orchestration lives in `app/fire/*` (3.8k lines, 40 commits in 2026).
  - **New in 2026:** `browser-mode` adds `BrowserMode.FIRE`, an **ephemeral "Fire mode" with its own isolated `androidx.webkit.Profile`** (`RealFireModeAvailability` requires `MULTI_PROFILE` and `DELETE_BROWSING_DATA`). It is very close to Focus's "everything is private, burn on exit" model.
  - "Automatically clear data on exit" (`AutomaticDataClearer`) already exists as a setting. A fork can **default it on** through a scripted settings default or a `replaces` binding.
  - An **Erase FAB in our own code can call `FireDialogProvider` or `DataClearingTrigger` from a fork module** without touching upstream files.

---

## 4. UI tweak feasibility (old-Focus look) and conflict risk

**Where the UI lives (`:app`):**

| File / area | Size | 2026 commits (Jan 1 to Oct 15) | Per weekly release |
|---|---|---|---|
| `browser/BrowserTabFragment.kt` | **6,830 lines** | **215** | **≈5** |
| `browser/BrowserTabViewModel.kt` | 6,133 lines | 191 | ≈4.5 |
| `browser/BrowserActivity.kt` | 1,920 lines | 69 | ≈1.7 |
| `browser/omnibar/*` | 6,166 lines | 69 | ≈1.7 |
| `app/src/main/res/layout/*` | n/a | 161 | ≈4 |
| `res/layout/fragment_browser_tab.xml` | n/a | 8 | ≈0.2 |
| `app/src/main/AndroidManifest.xml` | n/a | 17 | ≈0.4 |
| `app/build.gradle` | 786 lines | 50 | ≈1.2 |
| `res/values/strings.xml` (app) | n/a | 48 | ≈1.2 |
| `new-tab-page/*` module | n/a | 25 | ≈0.6 |
| `app/fire/*` | n/a | 40 | ≈1 |

**Patching `BrowserTabFragment` / `ViewModel` / omnibar is a rebase trap.** At about 5 commits per week on a 6.8k-line file, any hunk we keep there has a real chance of conflicting each release. A rough estimate is a 10–30% conflict chance per hunk per release, which comes to **5–15 manual conflict resolutions per year per hunk**. Each conflict also risks semantic drift, where the code compiles but behaves wrongly. A September 2026 brand-design PR (#9732) also **renamed many icon resources**. Resource renames break scripted overlays too.

**What can be done additively (no edits to hot files):**
1. **Focus-style home (gradient plus centred field plus logo):** contribute our own `NewTabPagePlugin` via `@ContributesActivePlugin(boundType = NewTabPagePlugin::class, priority = -1, featureName = "pluginMiniFocusNtp", parentFeatureName = "pluginPointNewTabPagePlugin")`.
   - `RealNewTabPageProvider` picks `getPlugins().firstOrNull()`, and lower priority comes first (`PriorityKey` docs). Our page therefore replaces DDG's NTP.
   - It returns any `View`, so it can be Compose in an `AndroidView`/`ComposeView`.
   - `NewTabPagePlugin.kt` had 6 commits since 2025, so it is stable.
   - **Limitation:** DDG's omnibar stays above (or below, via the user setting) our home view. A "single search field only" home would mean hiding the omnibar on the NTP, which touches `BrowserTabFragment` or the omnibar.
2. **Erase FAB:** add it inside our NTP view (free). For a FAB *while browsing*, add an overlay via an `Application.ActivityLifecycleCallbacks` or `BrowserLifecycleObserver` plugin that attaches a FAB to `BrowserActivity`'s content view. That is hacky but additive. DDG's own fire button in the omnibar stays.
3. **Theme/colour:** a design-system theme override via resource overlay (same resource names in our module). Moderate breakage risk on DDG resource renames.
4. **Defaults** (clear-on-exit, Fire mode, bottom bar, no onboarding): Anvil `replaces` bindings or settings-default overrides.

**Bottom line.** Expect "DDG chrome with a Focus-style home and an Erase FAB" with near-zero rebase cost. A faithful 2018-Focus UI on DDG means editing the 6.8k-line fragment and accepting continuous conflict work. **That is what the owner wants to avoid.**

---

## 5. Android Auto module on DDG

**Mechanism (sideload only).** Per [developer.android.com/training/cars/parked/auto](https://developer.android.com/training/cars/parked/auto), Android Auto on **Android 15+ phones** runs any Activity whose intent filter includes `android.intent.action.MAIN` and `android.intent.category.CAR_LAUNCHER` directly on the head unit. Today only the *games* category passes Play review. Sideloaded apps need AA developer settings with "Unknown sources" (see [03](03-car-mode-feasibility.md)). No template library or `Surface` is needed: a normal Activity with a WebView works.

**Touch points on DDG:**

| Option | Upstream files touched | Notes |
|---|---|---|
| **A. `<activity-alias>` → `com.duckduckgo.app.browser.BrowserActivity` with `CAR_LAUNCHER`**, declared in a fork library module's manifest (merged automatically) | **0** (plus 1 dependency line in `app/build.gradle`) | Simplest. But `BrowserActivity` is `launchMode="singleTask"`, so the single browser task *moves* to the car display (the phone shows AA). That is fine in a car. Its `configChanges` already include `screenSize|smallestScreenSize|screenLayout|orientation`. Density and IME on the car display must be tested on the DHU. |
| **B. Dedicated `CarBrowserActivity`** (landscape, big targets, no onboarding) using DDG's blocking | 0 upstream edits, but the code must live **in the `:app` source set**. `RequestInterceptor`, `BrowserWebViewClient` (≈38 injected deps) and `DuckDuckGoWebView` are in `:app`, and a library module cannot depend on an application module. Use `sourceSets.main.java.srcDirs += '../minifocus/app-src'` (1 line). | Inject `RequestInterceptor` via Dagger (`@InjectWith(ActivityScope)`) and call `shouldIntercept(request, webView, documentUri, null)` from a lean `WebViewClient`. This gets tracker blocking on the car without DDG's tab machinery. Compile breaks whenever `RequestInterceptor`'s signature changes (estimate: 1–3 times a year). |
| C. Car App Library `Surface` (navigation template) plus `VirtualDisplay`/`Presentation` WebView | 0 | Policy-violating on Play, and more code. Only worth it if a Surface-only path is needed. Not recommended. |

**Does Anvil/Dagger make it easy?** Yes. Any new module (auto-discovered by `settings.gradle`) can contribute bindings, multibindings and plugins to `AppScope`/`ActivityScope` without touching upstream wiring. That covers `ApiInterceptorPlugin`, `PixelInterceptorPlugin`, `NewTabPagePlugin`, `MainProcessLifecycleObserver`, `DataClearingPlugin` and others. There are 191 `@ContributesPluginPoint` and 34 `@ContributesActivePluginPoint` usages. **Caveat:** the in-flight **Metro migration** (`ddg.di=Metro` is now the default in `gradle.properties`) means our annotations must keep compiling under DDG's Metro/Anvil interop. Expect one forced migration of the overlay module sometime in 2026–27 (estimate).

---

## 6. Trademark and rebranding

- DDG's [Terms](https://duckduckgo.com/terms) reserve the DuckDuckGo name and the **Dax** mascot. Using the open-source code grants no trademark rights.
- The [partnerships help page](https://duckduckgo.com/duckduckgo-help-pages/company/partnerships) says: don't put "DuckDuckGo" in an app title without asking, don't use Dax, and don't pair DDG search with a service that has a different privacy policy.
- DDG's data repos state that logos and marks are **CC BY-NC-ND 4.0**, separately from the code. They have enforced against lookalikes (UDRP cases). **A fork must rename itself and change its icon.**

**How much branding is in resources:**
- `appName` (`translatable="false"`, but duplicated in **~30 locale files**) and `appDescription`. `applicationId com.duckduckgo.mobile.android` (1 line).
- **21 `ic_launcher*`** mipmaps in `:app` (plus alternate-icon `<activity-alias>`es in the manifest: pink, blue, black, gold, green). There are **about 295 resource files** matching `*dax*` / `*logo*` / `*ddg*` / `*duckduckgo*` / `ic_launcher*` across modules (50 with "dax").
- **705 "DuckDuckGo" mentions in default-locale `values/*.xml`** and **6,680 including translations**. Many are legitimate ("DuckDuckGo Search"). Many say "DuckDuckGo blocked…", "DuckDuckGo Settings".

**Approach.** A **scripted transform**, not git patches. A script runs on a fresh upstream checkout and:
1. sets `applicationId`;
2. sets `appName` in every locale;
3. replaces launcher icons (overwrite the mipmaps);
4. removes the alternate-icon aliases;
5. hides the Dax logo on our NTP (we own that view anyway).

Rewriting all 705 strings is optional and fragile. A reasonable middle ground is to rewrite strings that name the *app* and keep strings that name the *search engine*. Scripts re-run on every release and fail loudly when a target disappears. Expect about 1–2 fixes a year when DDG renames resources (estimate).

**Hard-coded package checks to review after renaming:** `PlayStoreUtils.DDG_APP_PACKAGE`, `VerificationCheckAppPackage`, `RealAutofillService`, `AutofillServiceStatusLifecycleObserver`, AppTP's own-app exclusion, and `EnqueuedPixelWorker`. These are mostly harmless (they disable "official build" behaviours).

---

## 7. Licensing and use of DDG servers

| Component | Licence | Fetched at runtime from | Fork use |
|---|---|---|---|
| App code | Apache-2.0 | n/a | ✔ Keep NOTICE and headers |
| `content-scope-scripts`, `duckduckgo-autofill` (bundled JS) | Apache-2.0 | bundled | ✔ |
| `privacy-dashboard` | Apache-2.0 | bundled | ✔ |
| `autoconsent` (cookie-popup handling) | **MPL-2.0** | bundled npm | ✔ File-level copyleft. Keep it unmodified. |
| `bloom_cpp`, `privacy-grade` (submodules) | Apache-2.0 (marks excluded) | n/a | ✔ |
| **Privacy config** (`privacy-configuration` repo) | **Apache-2.0** (marks CC BY-NC-ND) | `staticcdn.duckduckgo.com/trackerblocking/config/v6/android-config.json` | ✔ Could even be mirrored and modified |
| **Tracker blocklist (TDS)**, Tracker Radar | **CC BY-NC-SA 4.0**: non-commercial, share-alike. Commercial use needs a licence from DDG. | `staticcdn…/trackerblocking/v5/current/android-tds.json` (+ bundled `tds.json`) | ✔ for a **personal, non-commercial, attributed** fork. ✘ if ever monetised |
| Surrogates, HTTPS-upgrade bloom, remote messaging, surveys, domain-app mapping | (DDG data) | `staticcdn.duckduckgo.com/...` | Use or block as desired |
| Malicious-site API | proprietary service | `X-Auth-Token` required | ✘ Our build has no token, so the feature is effectively off |
| DuckSans font | proprietary (Fontwerk) | GitHub Packages (auth) | ✘ Never ship it. The shim is used automatically. |

**Is it allowed and sustainable to keep using DDG's CDN?**
- Nothing in the code or docs forbids an unofficial client from fetching these public JSON files. F-Droid's own DDG build does exactly that (it keeps DDG's package name and branding, which F-Droid may do as a distributor). For a single owner sideloading a personal build, the traffic is negligible.
- **Risks:**
  - DDG could gate endpoints by User-Agent or ATB at any time. The fork sends `ddg_android/<ver>` UAs unless we change them.
  - DDG controls feature flags (mitigated by the config-patch interceptor).
  - The NC clause rules out any commercial future (already noted in [02](02-ad-blocking-and-privacy.md)).
- **Mitigation if needed:** a daily GitHub Action mirrors `android-config.json` and `android-tds.json` to GitHub Pages. That means 3–6 URL constants repointed by an interceptor, not by editing upstream. Attribution is preserved and the mirror stays NC.
- **Search engine:** the DDG app has **no search-engine choice**. `QueryUrlConverter` is bound as `OmnibarEntryConverter` and always builds duckduckgo.com URLs. A fork can swap it with an Anvil `replaces` binding (additive), but autocomplete and SERP-specific features would still assume DDG. If the owner wants other engines, that is extra work.

---

## 8. Alternatives through the same lens

### 8.1 Firefox Focus (current, GeckoView)

- **Where:** `mozilla-firefox/firefox` (5.5 GB repo) at `mobile/android/focus-android`. Sources (`git`):
  - `app/src/main` has about **22.7k lines of Kotlin** in 213 files. The app also uses **≈50 in-tree Android Components** as `project(':components:…')`.
  - It depends on the in-tree Gradle plugins `conventions`, `nimbus-gradle-plugin`, `publicsuffixlist`, `dependencies` and `config`, and on `../../../gradle/libs.versions.toml`.
  - `settings.gradle` loads `../gradle/mozconfig.gradle`, which **shells out to `./mach environment`**.
  - Mozilla's docs require `./mach --no-interactive bootstrap --application-choice="GeckoView/Firefox for Android"`, with an **artifact build** (prebuilt Gecko C++ downloaded from Mozilla CI) or a full Gecko compile.
- **Churn:** 371 commits to `focus-android/` in 2026 (many are l10n/automation). `fragment/BrowserFragment.kt` (1,152 lines) had **19**. UI patches would rarely conflict.
- **Cadence:** the Firefox 4-week train, about 13 releases a year.
- **Fit:** the real Focus. It has a gradient home (`home_background.xml`), single-session, erase, ETP blocking (Disconnect lists from Mozilla Remote Settings, also NC-licensed) and Klar/Focus flavors.
  - Today's Focus erase is a **toolbar action** (`BrowserToolbarIntegration`), *not* the 2018 floating FAB. "Exact old UI" still needs a small patch.
- **Things to strip:**
  - `play-review` (Google Play Core, proprietary);
  - Sentry (`lib-crash-sentry`, `.sentry_token`);
  - Glean telemetry and Nimbus experiments;
  - the `com.google.android.gms.oss-licenses-plugin`;
  - all Mozilla branding (the Mozilla trademark policy requires renaming, and "Focus" is risky anyway, see [01](01-firefox-focus-history.md)).
- **Can it be built standalone against Maven?** **Probably yes, with effort.**
  - Mozilla still publishes **Android Components** (`org.mozilla.components:*`, latest 159.0b2 on 2026-10-14) and **GeckoView** (`org.mozilla.geckoview:geckoview`, 158.0.20261007…) to `maven.mozilla.org`.
  - Mozilla's own **`mozilla-mobile/reference-browser`** is a *standalone* AC + GeckoView app updated daily by bot. It proves the pattern.
  - Pre-2022 Focus itself built from Maven AC.
  - Extraction means: copy `focus-android/app`, rewrite about 50 project deps to Maven coordinates pinned to the matching release, vendor the small in-tree Gradle plugins, and drop the mach/mozconfig glue.
  - F-Droid's Klar build has been stuck at **8.4.0 (2020)**, but that is because F-Droid insists on compiling Gecko from source. We would use Mozilla's binaries.
  - **No maintained third-party Focus fork could be found**, so we would be first.
- **APK:** GeckoView adds about 50–70 MB per ABI (estimate; Focus grew from about 4 MB to about 38 MB in 2018 and Gecko has grown since). Use per-ABI splits.
- **Android Auto:**
  - A `CAR_LAUNCHER` activity hosting `GeckoView` works the same as with WebView.
  - GeckoView can **also render into any `Surface`**: `GeckoSession.acquireDisplay()` returns a `GeckoDisplay`, and `surfaceChanged(GeckoDisplay.SurfaceInfo)` / `surfaceDestroyed()` drive it, plus `capturePixels()` ([GeckoDisplay javadoc](https://mozilla.github.io/geckoview/javadoc/mozilla-central/org/mozilla/geckoview/GeckoDisplay.html)). So it could draw into a Car App Library `SurfaceContainer` without `VirtualDisplay`. That is technically nicer than WebView, which needs `VirtualDisplay` + `Presentation`. It doesn't change the Play-policy picture.
- **Maintenance estimate:**
  - UI and branding patch: about 0–1 conflicts a year.
  - **Build plumbing:** a standalone extraction will need adjustment whenever Mozilla changes AC module names, Gradle plugins or the version catalog. Estimate a fix every 2–4 releases, 0.5–3 h each.
  - Initial spike: 1–3 days.
  - The mach/artifact-mode-in-CI alternative is the most "upstream-faithful". It needs a full partial clone of the monorepo plus about 10 GB of bootstrap toolchains, which fits on `ubuntu-latest` after disk cleanup. It is slower (estimate 45–90 min) and brittle when bootstrap changes.

**Is Focus/GeckoView a better fit if maintainability comes first?** For **product fit and patch size, yes**: the UI already is Focus, there are few unwanted features (telemetry only, no Sync/VPN/AI/subscriptions), and cadence is 4-weekly instead of weekly. For **build maintainability, no, at least until proven**: DDG builds today with one Gradle command on a stock runner, while Focus needs either the monorepo plus mach or a home-made extraction nobody else maintains. The proposed 1–2-day spike settles this.

### 8.2 IronFox (successor to Mull; Mull was discontinued when DivestOS shut down)
- Active on GitLab (`ironfox-oss/IronFox`, activity 2026-10-15; v152.x). It is hardened **Fenix** (full Firefox): tabs, extensions, uBlock Origin.
- It builds Gecko, AC, Glean and application-services **from source** (Rust, NDK, hours).
- Fit: wrong product (not minimal). Maintenance: high. A fork of a fork means two upstreams. **Not recommended.** Useful only as a *reference* for de-Mozilla-ing patches (telemetry, Sentry, Nimbus removal).

### 8.3 Cromite (Chromium)
- `uazo/cromite` has **333 patches** on Chromium. Recent releases: v153.0.8010.37 (2026-09-15) and v148 (2026-05-21), so even the upstream lags months behind at times.
- Building Chromium needs about 100 GB+ disk, a high-RAM machine and hours. It will not fit GitHub-hosted runners (about 14 GB free and a 6 h limit), so a self-hosted runner is required.
- It bundles its own engine (contrary to the original ask). **Not recommended.**

### 8.4 Jelly, Lightning, Fulguris (see [01](01-firefox-focus-history.md) §3 for details)
- **Jelly** (LineageOS, Apache-2.0, about 57 Kotlin files, active 2026-10): a tiny WebView browser with **no ad blocking**. Rebase cost is tiny, but we would *write and own* blocking, erase and the Focus UI. That is "maintaining a browser". It is the right **base for a from-scratch app** (current PLAN.md), not for "fork and forget".
- **Lightning** (MPL-2.0): `main` is active (Kotlin 2.4, Gradle 9, 2026-10-13), but there has been **no tagged release since v5.1.0 (2019)**, so there is no stable rebase point. It has hosts-file blocking (Bloom filter). It is full-featured and far from Focus. Medium cost.
- **Fulguris**: an active Lightning fork (v2.x, 2026-10-12) with a real ABP/uBO filter engine. New files are **CPAL-1.0** (attribution badgeware), and the Play build has Firebase and a nag. It is large. Not recommended as a base.

---

## 9. Recommended DDG overlay architecture (if chosen)

```
minifocus-ddg/                      (our repo; upstream is NOT vendored)
  upstream.lock                     DDG tag to build, e.g. 5.298.1
  overlay/
    minifocus-core/                 new Gradle module (auto-included by DDG settings.gradle)
      ConfigPatchInterceptor.kt     ApiInterceptorPlugin: JSON-patch android-config.json (disable aiChat, sync,
                                    privacyPro, networkProtection, appTrackerProtection, duckPlayer,
                                    incontextSignup, remoteMessaging, pir, …)
      PixelKillSwitch.kt            PixelInterceptorPlugin: return 200 for everything
      AtbBlocker.kt                 ApiInterceptorPlugin for /atb.js, /exti/, surveys
      FocusHomePage.kt              NewTabPagePlugin priority -1 (gradient + field + Erase)
      EraseFab.kt                   lifecycle-callback overlay calling FireDialogProvider
      Defaults.kt                   Anvil `replaces` bindings (clear-on-exit default, skip onboarding, search URL rewriter)
      AndroidManifest.xml           <activity-alias … CAR_LAUNCHER> (option A)
    app-src/                        (option B) CarBrowserActivity using RequestInterceptor
    branding/                       icons, names
  scripts/
    apply.sh                        1) copy overlay into checkout  2) sed applicationId/appName/icons
                                    3) add `implementation project(':minifocus-core')` (+ srcDirs line)
                                    4) optional F-Droid-style de-Google seds
                                    every step asserts its anchor exists → fails loudly
    check-config-keys.py            diff remote-config feature keys vs. our allow/deny list
  .github/workflows/
    track-upstream.yml              daily: new DDG release tag? → apply.sh → ./gradlew assembleFdroidRelease
                                    → sign with our key → GitHub Release; on failure open an issue for Claude Code
```

**Expected maintenance (estimate):**
- Release-to-release textual conflicts: **about 0**, because we edit no upstream file. We only append 1–2 lines to `app/build.gradle` and set values by script.
- Compile breaks from internal API churn: **about 3–6 a year** (plugin interfaces are stable; Metro migration, `RequestInterceptor`, and the NTP plugin signature are the likely sources). Each is 15–60 min with Claude Code.
- Script anchors broken by resource renames: **about 1–3 a year**.
- New DDG features slipping through the denylist: **about 1 a month** to review (automated detection). Usually a one-line patch addition.
- **Total:** about 1–3 h a month of supervised Claude Code time.
- Avoid **any** hunk in `BrowserTabFragment`, `BrowserTabViewModel` or `omnibar/*`. Each such hunk adds about 5–15 conflicts a year.

---

## Sources

- DuckDuckGo Android repo: https://github.com/duckduckgo/Android (files cited: `settings.gradle`, `build.gradle`, `app/build.gradle`, `NOTICE`, `.github/workflows/build-fdroid-apk.yml`, `privacy-config/.../PrivacyFeatureName.kt`, `privacy-config-internal/.../DevPrivacyConfigPatchApiInterceptor.kt`, `app/.../di/NetworkModule.kt`, `statistics-impl/.../api/PixelService.kt`, `new-tab-page-api/.../NewTabPagePlugin.kt`, `app/.../newtab/NewTabPageProvider.kt`, `browser-mode/*`, `data-clearing-api/*`, `malicious-site-protection-impl/build.gradle`)
- DDG releases API: https://github.com/duckduckgo/Android/releases
- F-Droid metadata (DDG): https://gitlab.com/fdroid/fdroiddata/-/blob/master/metadata/com.duckduckgo.mobile.android.yml
- F-Droid metadata (Klar): https://gitlab.com/fdroid/fdroiddata/-/blob/master/metadata/org.mozilla.klar.yml
- DDG privacy remote config: https://staticcdn.duckduckgo.com/trackerblocking/config/v6/android-config.json
- DDG licences: https://github.com/duckduckgo/privacy-configuration (Apache-2.0), https://github.com/duckduckgo/tracker-blocklists (CC BY-NC-SA 4.0), https://github.com/duckduckgo/tracker-radar (CC BY-NC-SA 4.0), https://github.com/duckduckgo/autoconsent (MPL-2.0)
- DDG terms and brand guidance: https://duckduckgo.com/terms, https://duckduckgo.com/duckduckgo-help-pages/company/partnerships
- Android Auto parked apps: https://developer.android.com/training/cars/parked/auto
- Firefox monorepo, Focus: https://github.com/mozilla-firefox/firefox/tree/main/mobile/android/focus-android
- Firefox for Android build docs: https://firefox-source-docs.mozilla.org/mobile/android/index.html
- GeckoDisplay API: https://mozilla.github.io/geckoview/javadoc/mozilla-central/org/mozilla/geckoview/GeckoDisplay.html
- Maven: https://maven.mozilla.org/maven2/org/mozilla/components/browser-engine-gecko/maven-metadata.xml, https://maven.mozilla.org/maven2/org/mozilla/geckoview/geckoview/maven-metadata.xml
- Mozilla reference-browser (standalone AC + GeckoView): https://github.com/mozilla-mobile/reference-browser
- IronFox: https://gitlab.com/ironfox-oss/IronFox, https://ironfoxoss.org/
- Cromite: https://github.com/uazo/cromite, update-lag discussion https://discuss.privacyguides.net/t/cromite-add-a-note-about-update-lag/37604
- Jelly / Lightning / Fulguris: see [01-firefox-focus-history.md](01-firefox-focus-history.md)
