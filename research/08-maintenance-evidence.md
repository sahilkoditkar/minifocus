# 08: How much maintenance does a small system-WebView browser really need?

*Research date: 2026-10-15. Method: blobless clones (`git clone --filter=blob:none`) of five WebView browsers, with full history read for the last 2–3 years (subjects, touched files and, for key commits, the diffs). DuckDuckGo Android was sampled through the GitHub API: release notes, commit search and individual commits. Security advisories came from `gh api /repos/{o}/{r}/security-advisories` and web search. Nothing was built or run. Category shares come from a keyword and file-path heuristic, so treat them as ±10 points. Labels: **(git)** means I read it in the repo, **(estimate)** means it is my judgement.*

---

## TL;DR

- **Forced maintenance for a small WebView browser is small and lumpy.** It is mostly **one Android target-SDK bump a year** (Play deadline is 31 Aug), plus **one or two toolchain bumps** (Gradle/AGP/Kotlin). Everything else in these repos (50–75 % of commits) is optional feature work, refactoring, README edits or translations.
- **The engine maintains itself.** None of the five repos has a commit forced by a *runtime* WebView update in 3 years. Chromium security fixes reach users through the Play-updated *Android System WebView*, so the app does not ship them. WebView API removals (`setAppCacheEnabled`, `databaseEnabled`) only bite when you raise `compileSdk`, and the fix is to delete a line.
- **Browser-shell security bugs are self-inflicted by features.** The only published advisories across the five small repos are two in **EinkBro** (Aug 2026: CVE-2026-94614 *critical*, CVE-2026-94560 *medium*). Both come from a userscript JS bridge exposed to every page, combined with `allowUniversalAccessFromFileURLs=true`. DuckDuckGo's recent shell fixes follow the same pattern: an `intent://` fallback URL running `javascript:`, a blob-download bridge that silently drops files, and `about:blank` omnibar spoofing.
- **Estimate (Claude Code does the work, a human reviews and tests on a phone):** **about 6–20 h/year, roughly 0.5–1.7 h/month on average, typical ~1 h/month.** About 60 % of it falls between June and September, around the targetSdk deadline. For a sideload-only personal build with no Play deadline, it drops to **about 2–6 h/year**.
- **Compared with a DuckDuckGo overlay fork (~1–3 h/month = 12–36 h/year):** our own browser is **about the same or cheaper in hours** and much less steady. The fork's cost recurs every week: DDG shipped 99 releases in about 14 months, and its commit rate went from **1,518/yr to 2,746/yr** (+81 %). The fork's advantage is that DDG's security and targetSdk work is inherited for free. Its disadvantage is that you rebase onto it, including DDG's ~130 edge-to-edge commits for targetSdk 36.

---

## 1. Activity per repo

Non-merge commits, by author date. "Last 24 mo" means 2024-10-15 to 2026-10-15.

| Repo | Profile | Last 24 mo | Avg/mo | Shape | targetSdk at HEAD |
|---|---|---|---|---|---|
| **LineageOS Jelly** | Minimal WebView browser, Kotlin, ships in LineageOS (not Play) | 104 (54 are bot translation imports) | ~4 (~2 human) | Bursts: Jan 2025 (25, PWA/features), Sep 2025 (15, SDK 36 + Gradle) | 36 |
| **woheller69/browser** | FOSS-Browser fork with adblock, Java, F-Droid only | 21 | **<1** | Big burst at fork time (Oct–Dec 2023: 97), then near-dormant | 35 |
| **Lightning** | Mature WebView browser, single dev | 828 (197 Renovate bot) | ~35 | **Dormant Sep 2023 to Dec 2024 (0 commits)**, then a v6 rewrite in 2026 (May–Aug: 610) | 37 |
| **AABrowser** | Android Auto WebView browser, started Oct 2025 | 71 (40 README/sponsor-only) | ~6 | Feature releases v1.2–v3.0 | 37 |
| **EinkBro** | Feature-heavy (AI, EPUB, userscripts, native adblock) | 741 (≥459 co-authored by Claude since Mar 2026) | ~31 | Mar–Aug 2026 burst driven by Claude | 36 |
| *DuckDuckGo Android* | *Large company browser* | *~4,260 (1,518 → 2,746 per year)* | *~180* | *Weekly releases* | *36 (Aug 2026)* |

Monthly series (git): Jelly 2025: `25 7 7 2 2 1 2 1 15 – 1 1`. woheller69 2025: `3 2 2 1 2 – 2 2 1 1 – –`. Raw commit counts mostly measure ambition, not need. woheller69 and Jelly show that a WebView browser can stay current on **about 0–2 human commits a month**.

### Category shares (heuristic, since 2023-10)

| Repo | UI/feature | Build/SDK/deps | WebView API | Bug/site fix | Adblock | Security | Translations |
|---|---|---|---|---|---|---|---|
| Jelly | 37 % | 21 % | 5 % | 1 % | – | 1 % | 34 % |
| woheller69 | 57 % | 3 % | 4 % | 18 % | 7 % | 1 % | 10 % |
| Lightning | 51 % | 34 % (mostly Renovate) | 3 % | 12 % | 1 % | 1 % | – |
| AABrowser | 75 % | 9 % | – | 13 % | – | 4 % | – |
| EinkBro | 47 % | 10 % | 3 % | 29 % | 1 % | 0.5 % | 9 % |

---

## 2. Forced changes: concrete catalogue

"Forced" means that without the change the app could not ship on Play, would visibly break, or would be insecure. "Deferrable" means it was forced in principle but the app kept working for months or years without it.

### 2.1 Target/compile SDK bumps (the main recurring cost)

| When | Repo | Change | Size | Notes |
|---|---|---|---|---|
| 2024-03 | Jelly `564b570` | SDK 33→34 | 9 lines, build files only | No code change needed |
| 2024-01 | EinkBro `d6b7ca0e` | SDK 34: `registerReceiver` needs an export flag | ~18 lines | Classic A14 break |
| 2024-06 | woheller69 `626f9788` | SDK 33→34 plus material/webkit bumps | 9 files, ±31 lines | |
| 2024-09 | Jelly `c64b4dc` | SDK 34→35 | 14 lines, one nullability fix (`Bitmap.config`) | |
| 2024-11 | Jelly `4644d2b` | **Edge-to-edge** ("Refactor immersive mode… supports insets") | 2 files, ±60 lines | SDK 35 enforces edge-to-edge |
| 2025-01 | Lightning `9c32e07d` + `bb33fec0` + `310c5767` | SDK **33→35 in one jump** (minSdk 21→26), dead-code cleanup, one-line settings insets fix | ~200 lines, mostly deletions | Lightning sat on targetSdk 33 for **23 months** and kept working (Play visibility limits only) |
| 2025-07 | woheller69 `4ef365bc` | SDK 34→35: status-bar appearance helper called in 10 activities, insets listeners nulled | ~20 files, small | Follow-up `e50fb8fa` fixed day/night switching |
| 2025-09 | Jelly `b0d6afb` | SDK 35→36 | **3 lines** | Already edge-to-edge and dispatcher-based back |
| 2026-04 | Lightning `cd1218b3` | SDK 35→36 | 1 line | Its v6 rewrite was already insets-aware |
| 2026-08 | EinkBro `c1248172`, `61c56800`, `bf6a5f01`, `18e075a3`, `17d6d9f0` | SDK **34→36** over 5 days, all with Claude: **predictive-back opt-out** (`enableOnBackInvokedCallback=false`, because KEYCODE_BACK stopped reaching `onKeyDown`), **edge-to-edge** (content under the status bar, bottom toolbar untappable under the 3-button navbar), Android 16 ignoring `setRequestedOrientation` on large screens, `screenWidthDp` now including system bars, `intent://` sanitising for Android 16 intent hardening, an Android 17 IME-inset bounce | ~6 commits, a few hundred lines | **The best real-world sample of a "heavy year", and Claude did it** |
| 2026-07/08 | DDG `cb0d8b7be`, `06c894fbf` | Predictive-back opt-out, then targetSdk 36 | 1 line + 6 files | The real cost was **~128 edge-to-edge commits** in the year before (13 the year before that) |

**Lesson:** if the app is built edge-to-edge with `OnBackPressedDispatcher` from day 1 (Jelly, Lightning v6), a yearly bump costs **minutes to about an hour** plus device testing. Apps that inherited old window and back handling (woheller69, EinkBro, DDG) pay once, heavily.

### 2.2 Toolchain (forced when a new compileSdk needs a newer AGP)

- Gradle 8: Jelly `6acf56a` (2023-10), Lightning `fd1b7df3` (2023-09, ±30 lines).
- AGP/Gradle bumps in Jelly: ~3–5 a year, each 1–5 lines (git). EinkBro `527f657d` (2026-06): Gradle 8.9→8.14.5, AGP 8.7→8.13, Kotlin 2.0→2.1.20 in one commit.
- **AGP 9.0**: Lightning `684f671a` (2026-02), −32/+8 lines (the Kotlin plugin is built in, so classpath entries are dropped).
- **Kotlin 2 / K2**: EinkBro `393ebe2d` (2024-05). A version bump only.
- Lightning's Gradle plugin-repo flapping (2026-09, 6 commits of rate-limit and plugin-portal reverts) shows the "CI broke for external reasons" tax.
- Current HEADs: Lightning and AABrowser are on Gradle 9.8.1, AGP 9.4.1, Kotlin 2.4.21, compileSdk 37. Jelly and EinkBro are on AGP 8.13. Older toolchains keep building fine until you need a newer compileSdk.

### 2.3 WebView API adaptation

- **Compile-time only:** `setAppCacheEnabled` was removed from the SDK at API 33 (see [01](01-firefox-focus-history.md)). Jelly `8cc065b` removed `databaseEnabled` (2025-01), an optional cleanup. Jelly `4cc1225` and Lightning `9b736ae3`/`f58afbf5` cleaned up deprecations (optional).
- **Opt-in hardening:** woheller69 `6602716d` disabled `WebViewMediaIntegrityApi` (2024-08, 6 lines).
- **Renderer crashes:** woheller69 `1b30b09b` (2024) and EinkBro `94e69450` (2026) added `onRenderProcessGone`. Without it, Chromium kills the whole app when the renderer dies. This is a must-have from day 1, not maintenance.
- **Package visibility (API 30):** Lightning `ec33a4cb` "Fix intent handling on API 30+" landed in **2026-07**, years after targeting 30+. It was degraded behaviour, not a crash, so it was *deferrable*.
- **No runtime-WebView-update breakage commit found in any repo** (git).

### 2.4 External drift (soft-forced: features rot without it)

- User-agent strings: Jelly `ab14dab` (2024-12), AABrowser `092954e` (Chrome 149→154, 2026-09) and `f28003f`.
- Search and suggestion endpoints: Jelly `38bebfc` (Google suggestions JSON format), `a621293` (Yahoo URL), Lightning `9967c09f`/`72d9f893` (Baidu endpoint).
- Filter-list hosting: woheller69 `85a50997` (new cookie-banner list URL, 2025-03), and `b6f59748` cut list refresh from 3–7 days to 30 days. Lists are **downloaded at runtime** in woheller69, EinkBro and Lightning, so list updates cost **zero commits**.
- Native adblock engine (EinkBro `adblock-client` .so): `eb82f186` 16 KB page-size support (Play requirement for native code, 2025), and `02c711de`/`93e57c69` JNI hardening (2026-09). This is a cost **only if we ship native code** (adblock-rust in v2).

### 2.5 Translations

Optional. In Jelly they are bot imports (54 commits, zero human effort). In woheller69 they are contributor PRs.

---

## 3. Security: what has actually been fixed in WebView browser shells

| Product | ID / commit | Date | Issue | Root cause |
|---|---|---|---|---|
| EinkBro | **CVE-2026-94614 / GHSA-rcv7-662w-4gvr (critical)** | 2026-08 | Any page calls `window.einkbroGM.gmOpenInTab("file:///…")`, then file-to-file XHR reads the app's SharedPreferences (an API key was leaked in the PoC). Fixed in 16.3.2 + `25d81785`. | JS bridge on every page, plus `allowFileAccessFromFileURLs`/`allowUniversalAccessFromFileURLs = true` |
| EinkBro | **CVE-2026-94560 / GHSA-24mr-vq4f-xpc9 (medium)** | 2026-08 | Untrusted pages call native `gmSetClipboard` | Same bridge, no origin or token gate |
| EinkBro | `20507045` | 2026-08 | Broken-TLS subresource navigated the whole tab (https→http retry without `isForMainFrame`) | Custom error-retry logic |
| EinkBro | `73c3699d` | 2023-12 | SSL errors were not shown by default | Config default |
| DuckDuckGo | `175ebb0b0` (#8117) | 2026-03 | `intent://…;S.browser_fallback_url=javascript:…` executed JS ("UXSS-like") | `loadUrl(fallback)` without scheme check |
| DuckDuckGo | `9dab931a8` (#8080) | 2026-03 | Any page could silently drop files into Downloads through the `BlobConverter` JS interface with `data:` URLs | JS bridge on every page |
| DuckDuckGo | `a7eebc887` (#7581) | 2026-01 | Filename sanitisation for downloads | Download path handling |
| DuckDuckGo | `5f552efad`, `6d2b4a379`, `1baf7afa2`, `c5d1c449a` … | 2025-11 to 2026-02 | **Omnibar spoofing via `about:blank`/empty-URL windows** (has an "AddressBarSpoof" Maestro test) | URL-display logic around `window.open` |
| DuckDuckGo | CVE-2019-12329 | 2018/19 | Omnibar spoofing through rapid `setInterval` reloads (v5.26.0); DDG closed it as informative | URL-display logic |
| DuckDuckGo iOS | CVE-2021-44683 | 2021 | Address-bar spoofing via `window.open` (iOS, for comparison) | URL-display logic |
| Jelly | `04ca7ef`, `2ebff33` | 2024-03 | Proper `onReceivedSslError` UI, user CA support | Feature gap |
| Lightning, woheller69, Jelly, AABrowser | `security-advisories` API | – | **None published** | – |

The GitHub advisory API returns nothing for DDG Android. It runs its bug bounty through HackerOne, so DDG shell fixes show up as commits, not GHSAs.

**Pattern:** every shell vulnerability comes from (a) a `@JavascriptInterface` reachable from untrusted pages, (b) permissive file-access settings, (c) loading a page-controlled URL without a scheme allowlist (`intent:` fallbacks, `javascript:`), or (d) custom URL-bar display logic. Designing these out from the start (no JS bridges on web content, or ones gated by origin and token; file access off; a strict http/https allowlist on every `loadUrl` from page input; omnibar shows `about:blank` until the first committed navigation) leaves **little recurring security work**. What remains is reacting to new Android hardening (Android 16 intent rules) and the occasional report.

---

## 4. Estimate for our own small WebView browser (minifocus)

Assumptions: Kotlin + Compose + `androidx.webkit`, edge-to-edge and `OnBackPressedDispatcher` from day 1, `onRenderProcessGone` handled, filter lists fetched at runtime, Renovate on, CI builds the APK. Claude Code writes the changes. The human reviews and smoke-tests on one or two phones (3-button and gesture nav) and the car head unit.

| Item | Frequency | Hours/yr (estimate) | Evidence |
|---|---|---|---|
| targetSdk/compileSdk bump + behaviour audit | 1×/yr (before 31 Aug) | **1–2 light year, 4–8 heavy year** | Jelly SDK 36 = 3 lines; EinkBro 34→36 = 6 commits in 5 days with Claude |
| Gradle/AGP/Kotlin bumps | 1–3×/yr | 1–3 | Lightning AGP 9 = 40 lines; Jelly 1–5-line bumps |
| Renovate PR review (webkit, material, compose) | Monthly, batched | 1–2 | Lightning: 87–110 bot PRs/yr, nearly all auto-mergeable |
| External drift (UA, suggestion endpoints, list URLs) | 1–3×/yr | 1–2 | AABrowser UA, Jelly Yahoo/Google, woheller69 list URL |
| New Android release smoke test and fixes | 1×/yr | 1–3 | EinkBro Android 17 IME bounce, A14 download broadcast |
| Security reports / hardening | Rare | 0–4 | None in the four minimal repos; EinkBro's came from features we won't build |
| *If v2 adds adblock-rust via JNI* | 1–2×/yr | *+1–3* | EinkBro 16 KB pages, JNI hardening |
| **Total** | | **≈ 6–20 h/yr (≈ 0.5–1.7 h/mo avg; typical ≈ 10–12 h/yr)** | |

- **Sideload-only personal build:** Play's targetSdk deadline does not apply. Lightning ran on targetSdk 33 for 23 months, and woheller69 is still on 35. Forced work then falls to toolchain rot and drift, about **2–6 h/yr**. The cost is that you fall behind on platform behaviours, and Android slowly raises its install floor for old targetSdk values.
- **Feature work is not maintenance.** Lightning's 600-commit 2026 and EinkBro's Claude-driven 2026 are optional ambition. Do not mistake them for the floor.

### vs DuckDuckGo overlay fork (from [05](05-fork-base-evaluation.md): ~1–3 h/month)

| | Own minimal browser | DDG overlay fork |
|---|---|---|
| Forced hours | **≈ 6–20 h/yr**, lumpy (mostly Jun–Sep) | **≈ 12–36 h/yr**, steady (weekly upstream releases, 2,746 commits/yr and rising) |
| targetSdk work | We do it (small if designed in) | DDG does it (~130 edge-to-edge commits for SDK 36); we only rebase |
| Shell security | We own it; small attack surface if hardened by design | Inherited (#8117, #8080, omnibar spoof fixes) |
| Tracker list licence | Our choice (EasyList/HaGeZi) | DDG TDS is CC BY-NC-SA |
| Failure mode if neglected | Keeps working on old targetSdk; Play visibility lost | Overlay rots fast; upstream diverges weekly |

**Verdict (estimate):** maintenance hours are **not** a reason to prefer the fork. A disciplined minimal browser needs about **1 h/month on average**, concentrated in one 4–8 h window a year. That is at or below the fork's 1–3 h/month. The fork's real value is inherited security and blocking quality, not saved hours.

---

## Sources

- Git histories (blobless clones): [LineageOS/android_packages_apps_Jelly](https://github.com/LineageOS/android_packages_apps_Jelly), [woheller69/browser](https://github.com/woheller69/browser), [anthonycr/Lightning-Browser](https://github.com/anthonycr/Lightning-Browser), [kododake/AABrowser](https://github.com/kododake/AABrowser), [plateaukao/einkbro](https://github.com/plateaukao/einkbro). Commit hashes are cited inline.
- EinkBro advisories: [GHSA-rcv7-662w-4gvr](https://github.com/plateaukao/einkbro/security/advisories/GHSA-rcv7-662w-4gvr), [GHSA-24mr-vq4f-xpc9](https://github.com/plateaukao/einkbro/security/advisories/GHSA-24mr-vq4f-xpc9)
- DuckDuckGo Android commits: [#8117](https://github.com/duckduckgo/Android/commit/175ebb0b0), [#8080](https://github.com/duckduckgo/Android/commit/9dab931a8), [#7315](https://github.com/duckduckgo/Android/commit/5f552efad), [#8788](https://github.com/duckduckgo/Android/commit/cb0d8b7be), [#9283](https://github.com/duckduckgo/Android/commit/06c894fbf); [releases](https://github.com/duckduckgo/Android/releases) (notes are mostly "Bug fixes and other improvements", so they are useless for categorisation)
- CVE-2019-12329 (DDG Android omnibar spoof): [Security Affairs](https://securityaffairs.com/86250/hacking/duckduckgo-address-bar-spoofing.html), [Cyware](https://social.cyware.com/news/vulnerability-in-duckduckgo-allows-attackers-to-launch-url-spoofing-attacks-192f1285). CVE-2021-44683 (iOS): [NVD](https://nvd.nist.gov/vuln/detail/CVE-2021-44683)
- Play target API policy (API 36 by 31 Aug 2026, extension to 1 Nov 2026): [developer.android.com/google/play/requirements/target-sdk](https://developer.android.com/google/play/requirements/target-sdk), [Play Console Help](https://support.google.com/googleplay/android-developer/answer/11926878)
