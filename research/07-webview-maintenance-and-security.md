# 07 — WebView browser: who maintains what, and what security stays with us

Researched 2026-10-15. The claim being tested: *"WebView is updated by Play Store / the OS, so we only maintain the UI. No engine maintenance, and security is handled for us."*

## Verdict in one paragraph

**Half true.** The **rendering engine** (Blink, V8, the network stack, TLS, sandbox, Safe Browsing lookups) is maintained and patched by Google, or by the ROM vendor, and the patches reach our sideloaded app automatically. We never ship or rebuild Chromium. That is a big saving compared with a GeckoView or Chromium fork. **But** Chromium's own WebView security model says the host app is *"ultimately trusted"* and that insecure settings or API use are *"an app bug rather than a vulnerability in the WebView library."* Everything that makes an app a *browser* sits outside the engine: address bar, tabs, popups, intents, downloads, permission prompts, SSL-error UI, clearing data, JS bridges. That layer is ours, and it is the layer where most real-world WebView-browser CVEs live. On top of that come yearly Android platform changes, Google's new developer-verification regime, and signing-key custody. Engine maintenance really is zero. Security and platform maintenance is small but not zero.

---

## 1. How Android System WebView gets updated (2026)

| Android version | WebView provider | Who updates it | Status in Oct 2026 |
|---|---|---|---|
| 4.4 and older | Built into the OS | OS updates only | **No updates at all** ([Chromium prerelease doc](https://chromium.googlesource.com/chromium/src/+/404ca6f/android_webview/docs/prerelease.md)) |
| 5.0–6.0 (L–M) | Standalone `com.google.android.webview` APK | Play Store | Dead. Chrome/WebView dropped these OS versions years ago |
| 7.0–9.0 (N–P) | **Chrome is the provider by default** (Chrome and WebView are mutually exclusive, with fallback logic) ([Chromium webview-providers.md](https://chromium.googlesource.com/chromium/src/+/47cd4f581fdc93cbca03bc94de084cd418c8c59e/android_webview/docs/webview-providers.md)) | Play Store (through Chrome) | **Frozen.** Android 7: last Chrome was **119** (Nov 2023) ([9to5Google](https://9to5google.com/2023/11/27/google-chrome-calendar-older-android-version-support/)). Android 8/9: last Chrome was **138**, and 139+ requires Android 10 (Aug 2025) ([9to5Google](https://9to5google.com/2025/06/26/google-chrome-android-versions-no-longer-supported-2025/)). WebView 139 APKs list min API 29 ([APKMirror listing](https://www.apkmirror.com/?p=10506499), third-party). |
| 10+ (Q+) | Standalone WebView again (Trichrome build that shares a library with Chrome) | Play Store, independent of Chrome | **Actively patched** |

**Cadence.** WebView is built from the same Chromium milestones as Chrome. Chrome shipped a milestone every 4 weeks from 2021, added **weekly security updates in 2023**, and moved to a **2-week stable cycle starting with Chrome 153 on 2026-09-08** ([Chrome for Developers blog](https://developer.chrome.com/blog/chrome-two-week-release?hl=en)). Google's post doesn't mention WebView explicitly. That WebView follows the same 2-week cadence is our inference, though a very likely one. Release posts: [Chrome Releases, WebView label](https://chromereleases.googleblog.com/search/label/Android%20WebView).

**Caveats on "the Play Store handles it":**
- Users can turn off Play auto-update, and some OEM or enterprise setups pin versions. Chromium's security doc also notes that **users can downgrade WebView**, which brings old bugs back ([android_webview/SECURITY.md](https://chromium.googlesource.com/chromium/src/+/da170c2267b2201954efe1c8fa5d2d89ab09f7bf/android_webview/SECURITY.md)). So our app should **check the WebView version at runtime** (`WebViewCompat.getCurrentWebViewPackage()`) and warn the user if it is badly out of date.
- WebView is **not as hardened as Chrome**. WebView's own security doc says there is *"generally only one renderer process per browser context"*, so *"little process-level site isolation in WebView today"*. It also says WebView *"does not use third-party storage or network state partitioning"* ([SECURITY.md](https://chromium.googlesource.com/chromium/src/+/da170c2267b2201954efe1c8fa5d2d89ab09f7bf/android_webview/SECURITY.md); see also [Hermit known issues](https://hermit.chimbori.com/help/known-issues)). A WebView browser is therefore structurally weaker than Chrome against a compromised renderer, and weaker for privacy against cross-site trackers in iframes. We can't fix either of these.
- **Safe Browsing** is on by default since WebView 66 ([Chromium blog 2018](https://blog.chromium.org/2018/04/protecting-webview-with-safe-browsing.html)) but **needs Google Play Services** to do lookups ([WebView Safe Browsing README](https://chromium.googlesource.com/chromium/src/+/1eb995ae863d08fbdb7fda170d678129bdcfff2a/android_webview/browser/safe_browsing/README.md)). On de-Googled phones it is effectively off.

### Phones without Google Play
- **GrapheneOS:** the system WebView is **Vanadium**, GrapheneOS's hardened Chromium. It is updated through GrapheneOS's own app repository and also bundled into OS releases. Tags track upstream closely, for example 151.x ([Vanadium on GitHub](https://github.com/GrapheneOS/Vanadium)). This is fine for us, and arguably better.
- **LineageOS:** ships a prebuilt Chromium WebView (`android_external_chromium-webview`) that is refreshed **with OS builds or targeted commits, not on a fixed schedule**. Examples: LineageOS 22.1 shipped Chromium 131, and LineageOS 23 shipped Chromium 140 ([AlternativeTo on LOS 23](https://alternativeto.net/news/2025/10/lineageos-23-launches-with-android-16-application-updates-improved-vm-support-and-more)). Patch lag can be weeks to months. Users with Play can install Google WebView instead, but only on signed builds that allow it.
- **Huawei (EMUI on HMS, no GMS):** I could not confirm officially which package provides WebView or how it is updated. Huawei reportedly ships its own provider, updated through AppGallery or system updates. **HarmonyOS NEXT / 5+ can't run APKs at all**, so it is out of scope. Treat Huawei as "patch level unknown."
- **General rule:** on non-Google ROMs **the ROM maintainer is our engine vendor**, and their patch latency is our patch latency.

### Does a sideloaded app benefit equally? **Yes.**
The WebView provider is a system-wide shared package that the framework loads into any app's process (`WebViewFactory` through the WebView Update Service), whatever the install source. A GitHub-sideloaded APK gets exactly the same engine build as a Play-installed app. One nuance: some WebView defaults depend on **our** `targetSdk` (file-access defaults, mixed content, ECH, cleartext), so keeping `targetSdk` current is part of "getting the security."

### Recommended `minSdk`
- **`minSdk 29` (Android 10)** is the honest choice. It is the oldest version that still receives WebView security patches in Oct 2026. Android 8/9 devices have been stuck on WebView/Chrome 138 since mid-2025, which is more than a year of unpatched engine CVEs.
- Hard floors anyway: **androidx.webkit 1.16.0 requires minSdk 24** ([androidx.webkit release notes](https://developer.android.com/jetpack/androidx/releases/webkit)). Android 15 and later refuse to install apps that target below API 24 ([bayton.org matrix](https://bayton.org/android/android-minimum-targetsdk-matrix/)).
- If we want to allow 24–28 for reach, show a persistent "your browser engine is outdated" banner.

---

## 2. Security that stays with the app developer (the "browser shell")

Chromium's WebView threat model ([SECURITY.md](https://chromium.googlesource.com/chromium/src/+/da170c2267b2201954efe1c8fa5d2d89ab09f7bf/android_webview/SECURITY.md)) says this directly. Paraphrased with key quotes:
- The app and its SDKs are *"ultimately trusted."* An app that weakens protections is *"not considered a WebView bug."*
- *"Apps generally assume the responsibility for using APIs with documented negative security properties."*
- Security controls built on URL callbacks are error-prone. **`onPageStarted` is the most reliable signal that a navigation has committed.** *"Relying on shouldInterceptRequest to implement security controls is discouraged."*
- Permission grants flow through app callbacks, and some permissions are auto-granted.

Google's app-security guidance pages cover the same ground: [unsafe URI loading](https://developer.android.com/privacy-and-security/risks/unsafe-uri-loading), [native bridges](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges), [unsafe file inclusion](https://developer.android.com/privacy-and-security/risks/webview-unsafe-file-inclusion), and [intent redirection](https://developer.android.com/privacy-and-security/risks/intent-redirection).

### Vulnerability classes, with real examples

| # | Class | What goes wrong in the shell | Real-world examples |
|---|---|---|---|
| 1 | **Address-bar (omnibox) URL spoofing.** This is the most common CVE class for WebView browsers. | The URL bar is updated at the wrong moment: on `shouldOverrideUrlLoading` (before the navigation commits), from a pending slow navigation, after `window.open` into about:blank, or after a JS-driven reload loop. The bar then shows site A while the page renders site B. | **UC Browser** CVE-2020-7363 and CVE-2020-7364, **Opera Mini** CVE-2020-6158, **Yandex** CVE-2020-7369, **RITS Browser** CVE-2020-7371. All of these are Android browsers, abused through load/refresh timing ([Rapid7, Rafay Baloch research](https://www.rapid7.com/blog/post/2020/10/20/vulntober-multiple-mobile-browser-address-bar-spoofing-vulnerabilities/)). **DuckDuckGo Android** CVE-2019-12329, an omnibar spoof via a `setInterval` reload; DDG closed it as "informative" ([Security Affairs](https://securityaffairs.com/86250/hacking/duckduckgo-address-bar-spoofing.html)). **DuckDuckGo iOS** CVE-2021-44683, via `window.open` ([NVD](https://nvd.nist.gov/vuln/detail/CVE-2021-44683)). **Firefox Focus Android** CVE-2025-9186, fixed in Focus 142 ([Tenable](https://www.tenable.com/cve/CVE-2025-9186)). **Firefox Android** CVE-2025-8364, where a `blob:` URL hid the true origin ([SentinelOne](https://www.sentinelone.com/vulnerability-database/cve-2025-8364/)). Background: [Cyber Citadel on mobile address-bar spoofing](https://cybercitadel.com/resources/address-bar-spoofing-mobile-browsers/). |
| 2 | **JS ↔ native bridges** (`addJavascriptInterface`, `evaluateJavascript`) | The bridge is injected into **every frame, including cross-origin iframes**. Data from a frame gets relayed into `evaluateJavascript`, which runs in the **top** document, giving universal XSS. | **DuckDuckGo Android, 2026:** the `AutoconsentAndroid` bridge accepted messages from any frame and passed them to `evaluateJavascript`. This was a uXSS bug rated CVSS 8.6, fixed by adding origin checks ([CybersecurityNews](https://cybersecuritynews.com/duckduckgo-browser-uxss-vulnerability/amp/)). Historical: CVE-2012-6636 (reflection RCE on API < 17) and CVE-2014-1939 (`searchBoxJavaBridge_`) ([NVD](https://nvd.nist.gov/vuln/detail/CVE-2014-1939)). |
| 3 | **`intent://` and custom schemes** (launching other apps) | Web pages build intents that open **non-exported or unintended activities** in our app or in other apps, grant URI permissions, or silently jump the user out of the browser. | **Opera Android** CVE-2014-0815: an intent URL could leak the cookie file ([JVN](https://jvn.jp/en/jp/JVN23256725/index.html)). **Dolphin** CVE-2017-17553: private activities reachable by intent ([Tenable](https://www.tenable.com/cve/CVE-2017-17553)). **Chrome Android** CVE-2016-5197 ([Tenable](https://tenable.com/cve/CVE-2016-5197)). The canonical whitepaper is [Terada/MBSD, "Attacking Android browsers via intent scheme URLs"](https://www.mbsd.jp/Whitepaper/IntentScheme.pdf). |
| 4 | **Incoming VIEW intents** (other apps → our browser) | A browser is a public entry point. A malicious app sends a `javascript:` or `file:` URL into an existing tab, which is cross-app scripting. | Terada's Chrome-for-Android "javascript: intent" cross-application scripting bug (same whitepaper). |
| 5 | **file:// and content:// access** | `allowFileAccess`, `allowContentAccess`, `allowFileAccessFromFileURLs` or `allowUniversalAccessFromFileURLs` let web content read app-private files or a provider's files. | Google's guidance: [unsafe file inclusion](https://developer.android.com/privacy-and-security/risks/webview-unsafe-file-inclusion). **Chrome Android** CVE-2016-1671: directory traversal via file scheme ([Red Hat BZ](https://bugzilla.redhat.com/show_bug.cgi?id=1335451)). |
| 6 | **`onReceivedSslError` mishandling** | `handler.proceed()` on any error gives full MITM. A softer version: a "continue anyway" option that persists across sessions or hosts. | Google Play flags this pattern and can remove apps that use it ([Google Help 7071387](https://support.google.com/faqs/answer/7071387)). **Outlook.com Android** CVE-2014-5239 ([Securify](https://www.securify.nl/advisory/outlookcom-for-android-fails-to-validate-server-certificates/)). CodeQL has a rule for it ([CodeQL](https://codeql.github.com/codeql-query-help/java/java-improper-webview-certificate-validation)). |
| 7 | **Downloads** (`DownloadListener`) | The `Content-Disposition` filename isn't sanitised, allowing `../` traversal, RTL-override extension spoofing, newline tricks, a fake origin in the UI, and silent APK downloads or auto-open. | **TECNO Hi Browser (Android)** CVE-2026-18907: Content-Disposition path traversal ([NVD](https://nvd.nist.gov/vuln/detail/cve-2026-18907)). **Chrome Android** CVE-2016-1656: unsanitised filename ([Tenable](https://www.tenable.com/plugins/nnm/9374)). **Chrome Android** CVE-2025-9867: downloads UI spoofing. **Firefox** CVE-2025-4086: newline pushes the extension out of view ([SentinelOne](https://www.sentinelone.com/vulnerability-database/cve-2025-4086/)). A related supply-chain example: **UC Browser** fetched code and APKs over plain HTTP, which allowed MITM ([Dr.Web](https://news.drweb.com/show/?i=13176), [Zscaler](https://www.zscaler.com/de/blogs/security-research/uc-browser-app-abuses-may-have-exposed-500-million-users)). |
| 8 | **Permission prompts** (`onPermissionRequest`, `onGeolocationPermissionsShowPrompt`) | The app calls `grant(request.resources)` without checking `getOrigin()`, so a cross-origin iframe gets camera or mic. Other mistakes: remembering a grant per app instead of per origin, or granting resources nobody asked about. | The Android API reference warns against granting `getResources()` wholesale ([PermissionRequest](https://developer.android.com/reference/android/webkit/PermissionRequest.html)). osec.io found that common wrappers (including the AOSP `webview_shell` and react-native-webview) grant with **no origin check** ([osec.io 2026](https://osec.io/blog/2026-06-18-goldmine-of-insecure-webview-integrations)). A GeckoView analogue is [Mozilla bug 2049804](https://bugzilla.mozilla.org/show_bug.cgi?id=2049804). |
| 9 | **Fullscreen spoofing** (`onShowCustomView`) | A page goes fullscreen with no visible notice, then draws a fake URL bar or system UI. | **Firefox Android/Focus**: CVE-2017-7817, CVE-2023-25748, CVE-2023-28159, CVE-2023-29534, CVE-2024-4766, CVE-2024-8388 ([NVD CVE-2024-4766](https://nvd.nist.gov/vuln/detail/cve-2024-4766)). The fixes moved the notice into an Android Toast. |
| 10 | **JS dialog origin spoofing** (`onJsAlert`, `onJsConfirm`, `onJsPrompt`, `onJsBeforeUnload`) | A dialog appears over a *different* site or tab, with no origin shown. | **Firefox Android** CVE-2022-22762 ([Tenable](https://tenable.com/cve/CVE-2022-22762)). The stock Android browser routed alerts to the wrong tab ([Rafay Baloch](https://www.rafaybaloch.com/2017/06/android-browser-kitkat-content-spoofing.html)). |
| 11 | **Popups / `window.open` / `onCreateWindow`** | Popups without a user gesture. A new window shows the opener's URL. With multiple windows off, `window.open` hijacks the current tab. | The DDG iOS CVE-2021-44683 and Rapid7 popup-based spoofs above. |
| 12 | **"Erase" or clear-data correctness** | The "burn" button misses something: HTTP cache, Code Cache, Service Workers, IndexedDB, HTTP-auth credentials, geolocation grants, our own history/tab DB, tab thumbnails in `cacheDir`, the recents screenshot, or the download list. | I found no CVE-grade public report for Focus or DDG. Users repeatedly ask what Focus actually clears ([Mozilla support thread](https://support.mozilla.org/ca/questions/1354092)). Desktop Firefox had a long-running "Clear Private Data leaves site prefs" bug ([Launchpad 288236](https://bugs.launchpad.net/bugs/288236)). Treat this as a correctness risk that we must **test**, not assume. |
| 13 | **Cookie and storage isolation** | By default all WebViews in an app share one cookie jar and storage. WebView has **no third-party storage partitioning** (SECURITY.md). "Private tabs" therefore leak into normal tabs unless we isolate them. | Fix: the androidx.webkit **multi-profile API** (`ProfileStore` / `Profile`, 1.9.0+). Each profile has its own CookieManager, WebStorage, geolocation and service workers ([release notes](https://developer.android.com/jetpack/androidx/releases/webkit)). |
| 14 | **Safe Browsing toggles** | Turning it off "for performance," or not handling `onSafeBrowsingHit`. | Default is on ([managing WebView](https://developer.android.com/guide/webapps/managing-webview)). There are no lookups without GMS. |
| 15 | **Autofill and passwords** | Building our own password store, or exposing saved credentials to a cross-origin iframe. | `setSavePassword`/`setSaveFormData` are deprecated. Rely on the Android Autofill framework and the user's password manager. Passkeys/WebAuthn in WebView need androidx.webkit ≥ 1.12 plus `setWebAuthenticationSupport` ([Credential Manager + WebView](https://developer.android.com/identity/sign-in/credential-manager-webview?hl=en)). Browser-mode passkeys may require Google's privileged-browser allowlist (unverified). |

**A functional limitation, not a vulnerability:** Google **blocks Google-account OAuth sign-in inside Android WebView** (`403 disallowed_useragent`, enforced since 2021) ([Google Developers blog](https://developers.googleblog.com/2021/06/upcoming-security-changes-to-googles-oauth-2.0-authorization-endpoint.html)). Removing `; wv` from the user-agent to get around it breaks Google's policy. Plan an "Open in default browser / Custom Tab" escape hatch for "Sign in with Google" flows.

---

## 3. Other maintenance that isn't UI

### Yearly Android platform changes (roughly 1–3 days per year)
- **Install floor for low `targetSdk`** (applies to sideloads too, with error `INSTALL_FAILED_DEPRECATED_SDK_VERSION`; existing installs are untouched): Android 14 = 23, **Android 15 = 24, Android 16 = 24, Android 17 = 24 (unchanged)** ([bayton.org matrix](https://bayton.org/android/android-minimum-targetsdk-matrix/), [Android 15 advisory](https://bayton.org/android/advisories/android-15-app-install/)). This won't bite a new app, but don't let `targetSdk` rot.
- Play's yearly targetSdk deadline **does not apply** to us (we're not on Play). Bumping each year is still how we pick up WebView and platform security defaults.
- **Android 16 (API 36)** ([behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16)): edge-to-edge opt-out removed; predictive back is on and `onBackPressed()` / `KEYCODE_BACK` are no longer delivered, so the browser back-button logic must use `OnBackPressedCallback`; orientation and resizability restrictions are ignored on screens ≥600dp; intent-redirection hardening.
- **Android 17 (API 37)** ([behavior changes](https://developer.android.com/about/versions/17/behavior-changes-17?hl=en)): **Certificate Transparency on by default**; **ECH** used where the stack (including WebView) supports it; `ACCESS_LOCAL_NETWORK` runtime permission; background activity launch tightened for `IntentSender`; the large-screen orientation opt-out goes away; `setContentCaptureEnabled(false)` no longer works, so use `FLAG_SECURE` for private tabs. **`usesCleartextTraffic` is being deprecated** ([all-apps changes](https://developer.android.com/about/versions/17/behavior-changes-all)). A browser must load arbitrary `http://` sites, so we need a **Network Security Config with `<base-config cleartextTrafficPermitted="true">`**, plus a "Not secure" indicator and ideally HTTPS-first upgrading.
- **16 KB page size:** only matters if we ship native `.so` files, for example a Rust ad-block engine. Pure Kotlin is unaffected ([guide](https://developer.android.com/16kb-page-size)).

### Libraries
- **androidx.webkit**: about 2–4 releases a year. It raised minSdk 21→23 in 1.15 and 23→24 in 1.16 (May 2026). Always feature-detect with `WebViewFeature.isFeatureSupported()`, because users run many WebView versions.
- **Car App Library**: browsers are *not* a Car App Library category. **Android Automotive OS** allows browsers only while parked, it's in beta, and Play testing tracks only ([AAOS browsers](https://developer.android.com/training/cars/parked/browser?hl=en)). Android Auto browser support was announced at I/O 2025 ([Android Authority](https://www.androidauthority.com/android-auto-weather-browser-app-support-3559888/)), and I couldn't confirm a GA status. See research 03/04 for the car-mode details.
- The usual Kotlin, AGP and Gradle bumps.

### Ad/tracker blocking (only if we include it)
- Filter lists change constantly. EasyList-style headers declare `Expires: N days/hours` ([eyeo docs](https://developers.eyeo.com/create-a-filter-list)). Fetch and update lists **at runtime over HTTPS with integrity checks**, not by app release.
- `shouldInterceptRequest` only does **network-level** blocking. It can't see the referrer chain or method, and it misses WebSockets ([Aleph/Cordova advisory](https://www.alephsecurity.com/vulns/aleph-2014001)). Cosmetic filtering needs CSS/JS injection, which is a bridge-security risk (see row 2). Chromium also says not to use `shouldInterceptRequest` for security controls.
- **Site breakage triage** is the hidden ongoing cost. It needs a per-site "disable blocking" toggle and someone to look at reports.

### Google developer verification (applies to sideloaded/GitHub apps)
Sources: [official page](https://developer.android.com/developer-verification), [FAQ](https://developer.android.com/developer-verification/guides/faq), [Android Developer Console guide](https://developer.android.com/developer-verification/guides/android-developer-console), [Help Net Security](https://www.helpnetsecurity.com/2026/06/19/android-developer-verification-rollout-markets/).
- **2026-09-30:** enforcement starts in **Brazil, Indonesia, Singapore and Thailand only**, for installs from *participating stores* (Play, Galaxy Store, OPPO, vivo, Xiaomi GetApps, HONOR, Transsion Palm Store), on certified devices running Android 7+.
- **India: no India-specific date has been published.** It falls under the **"global rollout in 2027."** Today, an APK from GitHub installs in India as before.
- **From 2027 globally:** apps from unregistered developers can only be installed or updated via **ADB** or the **"advanced flow."** The advanced flow is a one-time setup: developer mode, an anti-coercion check, restart and re-auth, a **24-hour wait**, then biometric/PIN confirmation, after which installs are allowed for 7 days or indefinitely, with an "Install anyway" warning. That is a big hurdle for normal users. **Register before 2027.**
- **What registering takes:** an Android Developer Console *Full Distribution* account (**US$25**, identity verification), then per package: register the package name and the **SHA-256 of the signing cert**, and for existing packages **prove key ownership** by uploading an APK signed with the key that contains a challenge snippet. Multiple keys per package are allowed.
- **Limited Distribution account:** free and needs no ID, but only **up to 20 devices**. Fine for family/friends testing, not for public GitHub distribution. It can be upgraded to Full later, but not the other way round.

### Signing-key management (one-time setup, permanent risk)
- **Losing the key means you can never update existing installs**, and per the FAQ *"a lost signing key means you can't register those packages."* Keep at least two offline encrypted backups and use a password manager. Consider APK Signature Scheme v3 key rotation (`apksigner rotate`) as a recovery path.
- CI signing: keep the keystore out of the repo (GitHub Actions secrets). Publish the SHA-256 cert fingerprint in the README so users and Obtainium can verify it.

---

## 4. Conclusion

### What's TRUE and what's NOT
| Claim | Verdict |
|---|---|
| "WebView is updated by Play Store / the OS" | **TRUE on Android 10+ with Play**, every 2–4 weeks plus security respins. **FALSE on Android ≤9**, which has been frozen since 2023/2025. On de-Googled ROMs the ROM vendor decides (GrapheneOS: fast; LineageOS: per OS build; Huawei: unknown). |
| "Our sideloaded app gets those updates too" | **TRUE**, because the provider is system-shared. |
| "No engine maintenance" | **TRUE.** We never build or patch Chromium. |
| "Security is handled for us" | **FALSE for everything in §2.** Google's own WebView threat model puts embedder misconfiguration and browser-UI logic on the app. Address-bar spoofing alone has CVEs in UC, Opera Mini, Yandex, DDG and Firefox Focus. WebView also lacks Chrome's site isolation and storage partitioning, which we can't fix. |
| "We only maintain the UI" | **Mostly**, but add: yearly targetSdk bumps, androidx.webkit, developer verification (2027) and key custody, filter lists and site breakage if we block ads, and security-bug triage. |

### Realistic ongoing effort (one maintainer, small browser, no sync and no extensions)
| Item | Hours |
|---|---|
| One-time secure-by-default hardening (checklist below) plus a test page suite | **40–80 h** up front |
| Routine: dependency bumps, reading Chrome/WebView release notes, a quick smoke test on WebView Beta, issue triage | **3–6 h/month** |
| Yearly Android release (targetSdk bump, behavior-change fixes, testing) | **10–25 h/year**, roughly 1–2 h/month amortised |
| Ad/tracker blocking: list pipeline upkeep plus site-breakage triage | **+2–8 h/month** (0 if we skip blocking) |
| Security reports and fixes (sporadic, but must ship within days) | **~1–3 h/month** averaged, in bursts |
| Developer verification and signing (2027 registration, then near zero) | **~4 h once** |
| **Total** | **≈ 5–10 h/month without ad blocking, ≈ 8–18 h/month with it.** Compare roughly 20–40+ h/month for a GeckoView or Chromium fork. |

### Secure-by-default checklist (implement once, add regression tests)

**WebSettings**
- [ ] `allowFileAccess = false`, `allowContentAccess = false`. Never enable `allowFileAccessFromFileURLs` or `allowUniversalAccessFromFileURLs`. Serve any bundled pages through `WebViewAssetLoader` (`https://appassets.androidplatform.net`).
- [ ] `mixedContentMode = MIXED_CONTENT_NEVER_ALLOW`.
- [ ] Safe Browsing left ON. Handle `onSafeBrowsingHit` with the default interstitial.
- [ ] `setSupportMultipleWindows(true)` with our own `onCreateWindow`. Set `javaScriptCanOpenWindowsAutomatically = false`.
- [ ] `setGeolocationEnabled` only if we implement a per-origin prompt.
- [ ] Network Security Config: cleartext allowed in `base-config` (it's a browser), **no user CAs trusted in release builds**.

**Navigation and address bar**
- [ ] Update the URL bar and lock icon **only when a navigation commits** (`onPageStarted` / `doUpdateVisitedHistory`). **Never** from `shouldOverrideUrlLoading` or a typed URL.
- [ ] Show the origin with eTLD+1 emphasised, and never the page title in place of the URL.
- [ ] A new popup shows `about:blank` until it commits. A user-initiated pending navigation keeps the old URL with a loading indicator, or clears the bar. It must never show the target as already loaded.
- [ ] Hide the bar during fullscreen **only** with a mandatory "<origin> is fullscreen" overlay or toast, and keep the exit gesture available.
- [ ] Keep spoofing test pages from the Rapid7/Baloch PoCs in a local test suite.

**Schemes and intents**
- [ ] Allowlist for web-initiated navigation: `http`, `https`, `about:blank`, `data:` (top-level `data:` blocked), `blob:` (same-origin).
- [ ] `intent://` and unknown schemes: `Intent.parseUri(URI_INTENT_SCHEME)` → `addCategory(BROWSABLE)`, `component = null`, `selector = null`, strip `FLAG_GRANT_*` flags. Require a **user gesture plus a confirm dialog** ("Open in <app>?"). Use `browser_fallback_url` only if it is http(s). Never resolve to our own package.
- [ ] Incoming VIEW intents accept **only http/https**. Reject `javascript:`, `file:`, `content:` and `intent:`. Always open them in a **new tab**, never inject into an existing tab.

**JS bridges**
- [ ] No `addJavascriptInterface` on tabs that load web content. If a bridge is unavoidable, use `WebViewCompat.addWebMessageListener` with explicit `allowedOriginRules`, check `sourceOrigin` and `isMainFrame`, and never pass frame-supplied data into `evaluateJavascript` (the DDG 2026 lesson).

**TLS**
- [ ] `onReceivedSslError` → `cancel()` and show a full-page error. If there's a bypass at all, make it per-host, per-session and hidden behind "Advanced," and never allow it for HSTS hosts.

**Permissions**
- [ ] `onPermissionRequest`: show a prompt that names `request.origin`. Grant **only the specific requested resources** that the user approved. Store grants per origin. Deny cross-origin iframes by default. Also request the Android runtime permission. Revoke on clear-data. Handle `onPermissionRequestCanceled`.
- [ ] Geolocation via `onGeolocationPermissionsShowPrompt` with an origin-named prompt. Never default to `retain = true`.

**Dialogs**
- [ ] Custom `onJsAlert`, `onJsConfirm`, `onJsPrompt` and `onJsBeforeUnload`: tab-modal, titled with the **frame's origin**, dismissed on tab switch, with a "block further dialogs from this page" option.

**Downloads**
- [ ] Sanitise the filename: strip path separators and `..`, control chars, bidi overrides (U+202A–202E, U+2066–2069) and newlines, and cap the length.
- [ ] Save through MediaStore Downloads. Show the source origin and the real extension.
- [ ] Never auto-open, and add an extra warning for `.apk`.
- [ ] Handle `blob:`/`data:` downloads explicitly.

**Isolation and clearing**
- [ ] A separate androidx.webkit `Profile` for private tabs, deleted on exit. Feature-detect `MULTI_PROFILE`, and fall back to an "incognito = wipe everything" approach.
- [ ] "Clear data" covers all of: `CookieManager.removeAllCookies` + `flush`, `WebStorage.deleteAllData`, `clearCache(true)` on every WebView, `clearHistory`, `clearFormData`, `WebViewDatabase.clearHttpAuthUsernamePassword`, `GeolocationPermissions.clearAll`, our stored permission grants, our history/tab DB, thumbnails and favicons in `cacheDir`, and the download list. For a "nuclear" clear, destroy all WebViews and delete `app_webview/` and `cache/`, then restart the process.
- [ ] **Write an instrumented test** that seeds every storage type and asserts it's gone afterwards.
- [ ] `FLAG_SECURE` (or `setRecentsScreenshotEnabled(false)`) for private tabs.
- [ ] Third-party cookies off by default (the WebView default for targetSdk ≥ 21).

**Platform and process**
- [ ] `minSdk 29`. Check the WebView version at runtime and warn if it is more than about 3 milestones behind current stable.
- [ ] `targetSdk` = latest within about 3 months of each Android release.
- [ ] Don't spoof the UA to get around Google OAuth. Offer an "Open in default browser" action.
- [ ] Release signing key backed up twice offline, its fingerprint published, and the app registered in the Android Developer Console before 2027.
- [ ] Add `SECURITY.md` with a contact and a target fix time, and subscribe to [Chrome Releases](https://chromereleases.googleblog.com/) and the [androidx.webkit release notes](https://developer.android.com/jetpack/androidx/releases/webkit).

### Unverified or open items
- Whether WebView follows Chrome's 2-week cadence exactly. Very likely, but Google's post names only Desktop, Android Chrome and iOS.
- Who provides and updates WebView on Huawei EMUI/HMS devices.
- Whether `WEB_AUTHENTICATION_SUPPORT_FOR_BROWSER` (passkeys for browser apps) needs a Google allowlist.
- Some 2026 CVE IDs above (for example CVE-2026-18907) come from aggregators. Check NVD before quoting them externally.
