# 04 — Putting a sideloaded WebView browser on the Android Auto screen (state as of 2026-10-15)

## Method

- I read the source, git history and issue threads of AA Browser (kododake), Fermata, fcaronte/AABrowser, KingInstaller and aa-proxy-rs. I cloned them into a scratch directory, but nothing was built or run.
- I checked the official Android for Cars docs: the parked-apps, Android Auto overview, testing, map-drawing and map-interaction pages.
- I used news coverage only to fill gaps.
- "AA" means Android Auto, the phone-projection product. Android Automotive OS is out of scope.

---

## TL;DR

1. **Android Auto 17.x checks every app at connect time, and there is no single technique that is both "sideload-only" and "works while driving".**
   - **What "Unknown sources" covers.** The setting applies only to media apps, messaging-notification apps and **parked apps** (a plain Activity marked with the `CAR_LAUNCHER` category).
   - **What it does not cover.** Google's own testing page says it **"doesn't apply to apps built using the Android for Cars App Library"** ([docs](https://developer.android.com/training/cars/testing)). Car App Library and legacy-SDK apps only appear on a real car when one of these holds:
     - AA confirms the app was **installed by the Play Store**;
     - the app is on Google's allowlist;
     - the head unit identifies itself as a Google developer unit.
2. **The parked-app path is what AA Browser (kododake) uses today.**
   - **How it works.** The app is a normal `Activity` with `android.intent.category.CAR_LAUNCHER` and `android:appCategory="game"`, on a phone running Android 15 or later. AA runs it full-screen on the car display. You get real touch, a real WebView and a real soft keyboard.
   - **Install.** Only AA's "Unknown sources" toggle is needed. No special installer.
   - **Limits.**
     - **AA closes the app as soon as the car moves.**
     - It only works on cars with a touchscreen.
     - It needs Android 15 or later on the phone.
3. **The driving-capable path is a Car App Library app plus a VirtualDisplay.**
   - **How it works.** A `CarAppService` in the NAVIGATION category (or POI with `MapWithContentTemplate`) receives the map `Surface` through `AppManager.setSurfaceCallback`. You create a `VirtualDisplay` on that surface and show a `Presentation` holding the `WebView`. Gestures are replayed as synthetic `MotionEvent`s.
   - **What works.** It keeps working while moving and also on rotary-controller cars.
   - **The catch.** It must pass AA's "installed by Play" check. Three routes do this:
     - Play Console **Internal App Sharing or an internal test track**. This is official, private, needs no review and costs a one-time $25 developer account.
     - **KingInstaller** spoofing the installer. This depends on the device: Samsung and Pixel work directly; other phones need Shizuku or root.
     - A proxy dongle (**aa-proxy-rs** or **AAWireless**) that makes the car look like Google's Desktop Head Unit.
   - **Input limits.**
     - The app only gets tap, drag, fling and pinch events. There is no raw touch and no long-press.
     - No IME (input method, i.e. soft keyboard) works on the virtual display, so typing has to come from voice, a keyboard you draw yourself, or the phone.
4. **The legacy Gearhead SDK (`com.google.android.apps.auto.sdk.CarActivity`, `aauto.aar`) still works in 2026.** Fermata 2.0.2 (Aug 2026) still ships it, but it has the same Play-installed requirement. It is unofficial, a proprietary binary, and Google can break it at any time. Avoid it.
5. **A media app (`MediaBrowserService`) gets no drawing surface.** You only get templated browse lists and playback controls. It is useful only as a companion, for example for audio-only playback of web media.
6. **Recommendation.** Ship one APK with both entry points:
   - **(A)** a `CAR_LAUNCHER` parked activity, which needs zero friction and gives the best UX;
   - **(B)** a `CarAppService` surface mode for use while moving, installed through **Play Internal App Sharing**, or through KingInstaller as a GitHub-only fallback.

   Details are in section 5.

> **Conflict with `06-existing-aa-browser-repos.md`.** That file says technique B only needs "Unknown sources", plus KingInstaller on some phones. The official docs and 2026 evidence say otherwise:
> - [developer.android.com/training/cars/testing](https://developer.android.com/training/cars/testing): unknown sources "doesn't apply to apps built using the Android for Cars App Library".
> - [AABrowser#138](https://github.com/kododake/AABrowser/issues/138): a decompile of AA 17.6 validation shows `CAR.VALIDATOR: Package DENIED; failed all other checks` for a sideloaded template app.
> - [Fermata#829](https://github.com/AndreyPavlenko/Fermata/issues/829): the same failure on AA 17.7.
>
> Technique B works on the **DHU** (Desktop Head Unit emulator, which counts as a developer unit) for sideloaded builds, but **not on a real car** unless the app is Play-installed or spoofed.

---

## 1. Existing apps

| App | Author | Source? / licence | Last activity | Technique | Works while moving? | Install needs |
|---|---|---|---|---|---|---|
| **AA Browser** ([kododake/AABrowser](https://github.com/kododake/AABrowser)) | kododake (JP student). Contributors: cmacrowther, SaveEditors, gregorixG and others | **Open, GPL-3.0**, about 600★ | v3.3, **2026-10-13** (active) | Parked app: `CAR_LAUNCHER` activity, `appCategory="game"`, minSdk 35 | **No** ("Stationary Use Only" in the README; AA closes it) | Unknown sources only ("No need for a special installer"). Android 15+. Touch head unit |
| AABrowserCharles ([thiarley/AABrowserCharles](https://github.com/thiarley/AABrowserCharles)) | thiarley | GPL-3.0 fork of kododake | 2026-07-28 | Same as AA Browser | No | Same |
| **fcaronte/AABrowser** ([repo](https://github.com/fcaronte/AABrowser)) | fcaronte (also maintains KingInstaller) | **Open, MIT** | 2026-10-09 | Both of these: legacy `CarActivityService` (`CATEGORY_PROJECTION`, bundled gearhead/aauto AARs) and a Car App Library `NAVIGATION` service with VirtualDisplay + Presentation + WebView (`car/WideScreen.kt`) | **Yes** (the stated goal: "work while the car is in motion") | README: "only visible if you use … AAWireless, aa-proxy-rs … or if it's installed via KingInstaller" |
| slashmax/AABrowser ([repo](https://github.com/slashmax/AABrowser)) | slashmax | Source visible, **no licence** | 2020-02 (dead) | Legacy aauto-sdk CarActivity | Yes (historically) | Old root or patch tricks |
| maxteneff/aabrowser-drive, guitar-dev-io/autobridge | various | GPL-3.0 / MIT | 2026-10 | Car App Library NAVIGATION surface + VirtualDisplay (see file 06) | Yes, if it gets listed | aabrowser-drive's README suggests `adb install -i com.android.vending`. Other evidence (KingInstaller notes, #138) says this **fails** on current AA |
| **Fermata Auto** ([AndreyPavlenko/Fermata](https://github.com/AndreyPavlenko/Fermata)) | Andrey Pavlenko | **Open, GPL-3.0**, about 1.4k★ | 2.0.2 on 2026-08-18; pushed 2026-09-20 | Media player with a **web browser add-on** (`modules/web`: `FermataWebView`) and a YouTube add-on. Car UI uses the legacy SDK: `CarService extends CarActivityService`, `CATEGORY_PROJECTION`, `fermata/lib/auto/aauto.aar`. It also had "FS Mirror", a Car App Library NAVIGATION + MediaProjection mirror, **disabled in 2.0.2 because "since AA 17.3 it's conflicting with MediaService"**. It also ships Xposed hooks for AA | Yes | The media service shows with unknown sources. The **video/browser UI needs a Play-installed spoof**: KingInstaller, AAAD Pro, Play internal testing, or root/Xposed. It broke at AA 17.1 in June 2026 ([#773](https://github.com/AndreyPavlenko/Fermata/issues/773)) and a KingInstaller reinstall fixed it |
| **CarStream** ([old source](https://github.com/thekirankumar/carstream-android-auto)) | Kiran Kumar, later Eselter, krisstakos | The 2018–2021 source is public. Current builds are distributed through AAAD | Repo 2021; app still listed in AAAD | Legacy aauto-sdk CarActivity + WebView (YouTube) | Yes | AAAD. Reports conflict on Android 15–17 ([SlashGear](https://www.slashgear.com/1360881/how-to-watch-youtube-on-android-auto-guide), [Team-BHP Dec 2025: works on Android 16](https://www.team-bhp.com/forum/car-entertainment/268567-guide-install-view-youtube-android-auto-vehicles-no-root-modifications-pc-required-3.html)) |
| **Screen2Auto** ([marketing repo](https://github.com/androidautohacks/screen2auto)) | Annexhack | **Closed** (no licence; the repo only links to a website) | 2026-09 | Phone-screen mirror (MediaProjection) into the AA projection; legacy SDK | Yes | AAAD |
| **AAMirror** ([slashmax/aamirror](https://github.com/slashmax/aamirror)) | slashmax | Source visible, **no licence** | 2024-03 | Legacy SDK mirror; historically needed root | Yes | Root or AAAD |
| AAStream / AA Mirror Plus ([aahacks/AAStream](https://github.com/aahacks/AAStream)) | Annexhack | Closed | 2024 | Mirror; needs root | Yes | Root |
| **AA Anything** ([kododake/AAAnything](https://github.com/kododake/AAAnything)) | kododake | **Closed** (proprietary EULA) | v1.0.1, 2026-10-13 | "Patch & Install". It re-packages arbitrary apps (VLC, Firefox and others) so AA lists them as parked apps; most likely it injects `CAR_LAUNCHER` + `appCategory=game`. Android 15+ | No (parked) | Unknown sources |
| **TaaDa** | Sébastien Duboc | Closed, on Play (`fr.sd.taada`) | — | **Not relevant.** It is the opposite direction: it streams Android Auto *into a Tesla's browser* through a VPN | — | — |
| "AA Web" | — | No such app found. Searches return AA Browser | — | — | — | — |

**Installers and unlock tools:**

- **AAAD** ([shmykelsa/AAAD](https://github.com/shmykelsa/AAAD))
  - Partial source under a restrictive EULA; MIT label on GitHub.
  - Latest release v2.8.5 (2026-06-17).
  - It only installs its **curated list** (Fermata, CarStream, Screen2Auto, AAMirror, AA Browser and others) "in the correct way". It cannot install your own APK. The free tier allows one download every 30 days; PRO costs €3.99.
- **KingInstaller** ([fcaronte/KingInstaller](https://github.com/fcaronte/KingInstaller), about 560★, pushed 2026-10-03) installs **any** APK so that `installingPackageName = com.android.vending`. There are three methods, covered in section 3.
- **aa-proxy-rs** ([aa-proxy/aa-proxy-rs](https://github.com/aa-proxy/aa-proxy-rs), GPL-2.0, pushed 2026-10-15) and **AAWireless**. These are Raspberry Pi or dongle man-in-the-middle proxies.
  - `developer_mode` rewrites the head unit make/model to `"Google"` / `"Desktop Head Unit"`, so AA treats the car as a developer unit and lists any sideloaded app.
  - `video_in_motion` spoofs the sensors: driving status 0, gear PARK, parking brake on, speed 0.
  - Code: `src/mitm.rs` lines ~155, 2286–2310 and 3341–3395.

---

## 2. Techniques in detail

### 2.0 (Official since Android 15) Parked app with a `CAR_LAUNCHER` Activity — what AA Browser uses

The [Android Auto overview](https://developer.android.com/training/cars/platforms/android-auto) and [parked apps on Android Auto](https://developer.android.com/training/cars/parked/auto) say:

- *"On devices running Android 15 or higher, Android Auto supports running activities directly on the head unit while parked. This capability is limited to apps in the supported parked app categories."*
- *"Games are the only parked app category supported by Android Auto at this time."* Browsers and video are announced for AA but are not yet open (video is expected in beta by end of 2026).
- To mark the app as a game, set `android:appCategory="game"` on `<application>` ([games page](https://developer.android.com/training/cars/parked/games)).
- *"For safety purposes, Android Auto automatically exits an app when vehicle motion is detected."*
- Activities always run full screen. The user swipes from the edge to get back/exit controls.
- Intents to other apps are blocked. Web or Play links open **on the phone**.
- On Android 15, runtime-permission prompts are redirected to the phone.
- To detect that the app is on AA, check `CarConnection` type `CONNECTION_TYPE_PROJECTION` together with `context.display.displayId != DEFAULT_DISPLAY`.
- The test profiles are 800×480@160dpi, 1920×1080 wide, and portrait. An anchor aspect ratio of 16:9 is recommended.

AA Browser v3.3's manifest (`app/src/main/AndroidManifest.xml`) does exactly this:

- `<application android:appCategory="game">` with `meta-data distractionOptimized=true`.
- `MainActivity` declares the intent filters `MAIN` + `LAUNCHER` + `CAR_LAUNCHER`. It also adds `androidx.car.app.category.NAVIGATION` and `APP_MAPS` categories; these are cosmetic for this path.
- It still declares `com.google.android.gms.car.application` → `<uses name="media"/>` and depends on `androidx.car.app:app:1.7.0`, but there is **no** CarAppService and no car code in the Java sources.

**History.** The first beta (commit `9b7559d`, 2025-10-09) used a Car App Library `CarAppService` in the **POI** category with `MapWithContentTemplate` + `setSurfaceCallback` + `VirtualDisplay(OWN_CONTENT_ONLY)` + `Presentation(WebView)`, with no touch forwarding. That code was **removed on 2026-01-20** (commit `171f7a5`) in favour of the pure parked-activity approach.

**Input and UX.**

- It is a real Android window on a real display, so touch, multi-touch, long-press, text selection, Compose and Views all work normally.
- AA Browser uses the standard `InputMethodManager.showSoftInput` and Compose `KeyboardOptions(keyboardType = Uri)`. Coverage reports the on-screen keyboard appearing on the car display for URL and password entry ([Yahoo/Tech](https://tech.yahoo.com/apps/articles/android-auto-lets-install-browser-150000597.html)).
- It also offers microphone input through a Web Speech API polyfill (`web/SpeechPolyfill.kt`).

**Hard limits found in the source and issue tracker.**

- **Closes on motion.** Issues [#5](https://github.com/kododake/AABrowser/issues/5), [#14](https://github.com/kododake/AABrowser/issues/14), [#56](https://github.com/kododake/AABrowser/issues/56), [#83](https://github.com/kododake/AABrowser/issues/83) and [#129](https://github.com/kododake/AABrowser/issues/129) all report it. The maintainer says "Currently, Android Auto locks the app when the car is moving."
  - Some cars and head units do not report motion, so the app keeps running ([#66](https://github.com/kododake/AABrowser/issues/66): it worked on an aftermarket BMW head unit, then stopped after a car firmware update).
  - One user reports that **turning phone location off** keeps it running while driving ([#83](https://github.com/kododake/AABrowser/issues/83)), but it breaks Maps. Unreliable.
- **Touchscreen required.** On a rotary-only Mazda: `GH.ParkedNativeAppCheck: Car allowed: true Has touch: false` → `Cannot launch on currently connected car` ([#138](https://github.com/kododake/AABrowser/issues/138)). No app-side fix exists.
- Android 15+ only. On Android 17 it still works, with the same parking requirement.
- README tip: "If the app fails to launch, try opening a non-Google Maps navigation app (such as Waze) first."

### 2.a Official Car App Library + `SurfaceCallback` + `VirtualDisplay` + `Presentation`

**Mechanism.** This follows the official [draw-maps docs](https://developer.android.com/training/cars/apps/library/draw-maps), which explicitly document VirtualDisplay + Presentation and a ComposeView inside a Presentation.

- **Manifest.**
  - Declare a `<service>` with action `androidx.car.app.CarAppService` and one of these categories:
    - `androidx.car.app.category.NAVIGATION`: you get `NavigationTemplate` and permission `androidx.car.app.NAVIGATION_TEMPLATES`. The app becomes a nav app, which can displace Google Maps or Waze as the active navigator.
    - `androidx.car.app.category.POI`: you use `MapWithContentTemplate` with `androidx.car.app.MAP_TEMPLATES`. This needs car API level 7.
  - Add `androidx.car.app.ACCESS_SURFACE` and `androidx.car.app.minCarApiLevel`.
  - `res/xml/automotive_app_desc.xml` must contain `<uses name="template"/>`. Fermata issue #829 shows AA logging `Uses for TEMPLATE not defined` per capability.
- **Code.**
  1. In the `Screen` init, call `carContext.getCarService(AppManager::class.java).setSurfaceCallback(cb)`.
  2. In `onSurfaceAvailable(SurfaceContainer)`, call `DisplayManager.createVirtualDisplay(name, w, h, dpi, surface, VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY or VIRTUAL_DISPLAY_FLAG_PRESENTATION)`.
  3. Show a `Presentation(carContext, vd.display)` whose content view holds the `WebView`.
  4. In `onSurfaceDestroyed`, dismiss the presentation and release the virtual display.
  5. Respect `onVisibleAreaChanged` / `onStableAreaChanged`, because the host draws the action strip and other UI over the map.
  6. Use `CarContext.isDarkMode` for dark mode.
- **Reference code.**
  - Fermata `fermata/src/auto/java/me/aap/fermata/auto/MirrorServiceFS.java` + `MirrorDisplay.java`.
  - fcaronte `browser/src/main/java/com/fcaronte/aabrowser/car/WideScreen.kt` (~1300 lines).
  - Original AA Browser beta `AABrowserScreen.kt` (commit `9b7559d`).
  - Google Navigation SDK sample ([Android Auto guide](https://developers.google.com/maps/documentation/navigation/android-sdk/android-auto)).

**Touch** ([Let users interact with your map](https://developer.android.com/training/cars/apps/library/interact-map)):

- **Callbacks.**

  | Gesture | Callback | Car API level |
  |---|---|---|
  | Tap | `onClick(x, y)` | 5 |
  | Single-finger drag | `onScroll(dx, dy)` | 2 |
  | Single-finger fling | `onFling(vx, vy)` | 2 |
  | Pinch, or double-tap (host-chosen factor) | `onScale(fx, fy, factor)` | 2 |

  - The reference notes that onClick and onFling "may not be called in some car systems".
- **Pan action required.** You must put `Action.PAN` in the map action strip. Without it, *no* SurfaceCallback input arrives. On touchscreens the PAN button is hidden. In pan mode, rotary and touchpad input is converted to `onScroll`, which makes this path work on rotary cars.
- **No raw MotionEvents.** There is no down/up stream, no long-press, no multi-finger input beyond pinch, and no hover. Implementations synthesize events:
  - **fcaronte.** `onClick` dispatches `ACTION_DOWN` then `ACTION_UP` to the presentation's views. `onScroll` calls `webView.scrollBy`. `onFling` calls `webView.flingScroll`. `onScale` filters host double-tap factors (|factor−1| > 0.35) out of real pinches.
  - **Fermata.** `onScroll` fakes a drag: it sends `ACTION_DOWN` at the start, `ACTION_MOVE`s, and a scheduled `ACTION_UP` 500 ms after the last move.
  - Because the VirtualDisplay belongs to your own process, `presentation.window.decorView.dispatchTouchEvent()` is enough. No INJECT_EVENTS or accessibility permission is needed. Fermata needs accessibility only because it mirrors *other* apps.
- **Verdict.** Taps, scrolling and flinging work reasonably. Text selection, long-press menus, drag-and-drop, hover menus and precise sliders don't.

**Keyboard / URL entry.**

- **No IME works on the VirtualDisplay.**
  - fcaronte's code: *"Disable keyboard for now, I can't manage it correctly"* (`WideScreen.kt` ~line 893). It falls back to a 🎤 button with speech recognition.
  - aabrowser-drive sets `FLAG_ALT_FOCUSABLE_IM` and draws its own `CarKeyboardView` (see file 06).
- **Options, best first:**
  1. **Voice.** Use `CarAudioRecord` (car mic, car API 5) or the phone mic plus `SpeechRecognizer`. Works while driving.
  2. **Your own in-Presentation keyboard.** A View or Compose grid driven by `onClick`. It works while driving because AA doesn't know it is a keyboard. That is ethically and legally your responsibility.
  3. **Host keyboard through `SearchTemplate`** (push a Screen returning `SearchTemplate`, read text in `SearchCallback.onSearchSubmitted`). It is **parked-only**: *"the keyboard is unavailable during the driving state"* ([design docs](https://developers.google.com/cars/design/create-apps/apps-for-drivers/templates/search-template)). `SignInTemplate` + `InputSignInMethod` behaves the same way.
  4. Type on the phone (a phone activity or QR/share intent) and push the URL to the car session.
- **Template limits while driving.** List-size limits come from `ConstraintManager`; there are task-step/refresh quotas and no keyboard. These apply to the *templates*, not to pixels you draw on the surface.

**Does AA accept a sideloaded Car App Library app with "Unknown sources"? On a real car: no.**

- **Official.** The testing page says: *"Android Auto has a developer option that lets you run apps that aren't installed from a trusted source. This setting applies to media, messaging notifications, and parked apps but doesn't apply to apps built using the Android for Cars App Library."* For real-car testing, Google says to use **Internal App Sharing or an Internal Test Track** ([testing](https://developer.android.com/training/cars/testing)).
- **Decompile.** In AABrowser#138 (Mazda CX-30, AA 17.6.663454, `CarProjectionValidator#isPackageAllowed3p`), a third-party app is allowed only if one of these holds:
  1. the Play Store confirms it installed the package. AA asks Play directly, and a faked `adb install -i com.android.vending` does **not** pass;
  2. the package is on the hard-coded allowlist with signature checks;
  3. the head unit is a developer unit (DHU make/model);
  4. Unknown sources is on **and** the category is one of `MEDIA, NAVIGATION (legacy projected), NOTIFICATION, OEM, NATIVE_APP, SERVICE, SMS`.

  **Every Car App Library app is validated as `TEMPLATE`**, whatever `androidx.car.app.category.*` it declares. The author confirmed this on the car: a dummy `MediaBrowserService` in the same APK appeared, the template entry stayed hidden, and AA logged `CAR.VALIDATOR: Package DENIED; failed all other checks`. Internal app sharing / internal testing was enough to make it appear.
- **Independent confirmation.** Fermata#829 (OnePlus 12, Android 16, AA 17.7): `CAR.VALIDATOR: isPackageInstalledByPlayCheck service not connected` / `Package DENIED; failed all other checks`, both for a package-installer install and for a shell install.
- **DHU.** Sideloaded template apps **do** show on the DHU, because the DHU is a developer unit. Developers therefore get fooled into thinking it works.

### 2.b Legacy unofficial Gearhead SDK (`com.google.android.apps.auto.sdk`, "aauto-sdk")

- **Origin.** Google's internal projection SDK, extracted around 2017–18 ([martoreto/aauto-sdk](https://github.com/martoreto/aauto-sdk), last commit 2018, no licence). It is now carried as binary `aauto.aar` / `gearhead-sdk*.aar` inside Fermata (`fermata/lib/auto/aauto.aar`) and fcaronte/AABrowser (`browser/libs/v2|v4|v5`).
- **Usage.** Subclass `CarActivityService` (return your `CarActivity`) and register with `<category android:name="com.google.android.gms.car.category.CATEGORY_PROJECTION"/>` (+ `CATEGORY_PROJECTION_OEM`). `CarActivity` is a real View hierarchy on the car display with real touch. The car IME comes through `CarRestrictedEditText` / `CarEditable` (Fermata `CarEditText.java`), and AA disables it while driving through the driving-status "no keyboard" bit.
- **Status in 2026.**
  - It **still works**. Fermata 2.0.x (Aug 2026) and fcaronte/AABrowser (Oct 2026) use it, and it runs while moving.
  - It needs the Play-installed check to pass. Since around 2018, custom apps outside the allowed categories are blocked. AA 17.1 (June 2026) hid Fermata's main UI for many users until they reinstalled with KingInstaller ([Fermata#773](https://github.com/AndreyPavlenko/Fermata/issues/773)).
  - The maintainer's verdict: *"Until AA allows sideloaded apps on car head units, there is no solution, but only workarounds."*
  - Fermata also uses Xposed hooks into `com.google.android.projection.gearhead` for rooted users.
- **Risks.**
  - The binary is proprietary Google code with no licence, so it is legally dubious to redistribute under GPL.
  - It is undocumented and can break with any AA update.
- **Not recommended** for a new app.

### 2.c Media app (`MediaBrowserServiceCompat` / Media3 `MediaLibraryService`)

- **What it gives.** Only host-rendered browse trees, the now-playing card and transport controls. **There is no Surface, Canvas or View on the car screen.** The Car App Library has no media category exposing a surface; media apps declare `<uses name="media"/>`.
- **What it's good for.** It **is** whitelisted for Unknown sources (see the list above), which is why "Fermata Media Service" stays visible when the rest of Fermata is hidden.
- **Use for us.** At most a companion: play a web page's audio in a background WebView/MediaSession and expose it as a media source while driving. See [IngridMorstrad/AndroidAutoBrowser](https://github.com/IngridMorstrad/AndroidAutoBrowser), `auto-media/`, which does exactly this (`WebAudioBrowserService`).

---

## 3. Practical requirements for a sideloaded AA app in 2026

1. **Android Auto developer mode.** In AA settings, tap **Version** 10× → OK. Then open the ⋮ menu → **Developer settings** → enable **Unknown sources**.
   - Users report that AA updates sometimes reset this setting.
   - Clearing AA cache/data and re-enabling it is a common fix ([Fermata#773](https://github.com/AndreyPavlenko/Fermata/issues/773)).
2. **Phone Android version.** Parked apps need Android 15+. Car App Library apps need Android 9+, the AA minimum.
3. **Install-source checks (the 2026 crackdown).**
   - **Parked (NATIVE_APP), media, messaging.** Unknown sources is enough, and any install method works, including `adb install`.
   - **Car App Library (TEMPLATE) and legacy projection.** The app must be "installed by Play". The routes ranked by robustness:
     1. **Google Play Console Internal App Sharing or an internal test track.**
        - Google's documented path. No review and no public listing.
        - Needs a $25 developer account. Android developer verification of that account is required anyway from 2026–27.
        - Updates go by uploading each build; the share link installs through Play.
     2. **KingInstaller.**
        - *Classic method:* `Intent.ACTION_INSTALL_PACKAGE` with `EXTRA_INSTALLER_PACKAGE_NAME=com.android.vending`, `EXTRA_NOT_UNKNOWN_SOURCE=true`, referrer/originating extras and `REQUEST_UPDATE_OWNERSHIP` (`InstallationUtils.kt`). It works on Samsung and Pixel up to Android 16.
        - *Shizuku method:* runs `cmd package set-installer[-package] --user 0 <pkg> com.android.vending`. Recommended on Android 17 and on other OEMs.
        - *Root method:* the same command through `su`. Required on Xiaomi/POCO/Redmi.
        - The rule KingInstaller found: **installing package must be `com.android.vending`, and the initiating package must be the package installer, never `com.android.shell`.** This is why `adb install -i com.android.vending` fails on current AA.
        - The GrapheneOS forum reported it broken on Android 14 at one point ([thread](https://discuss.grapheneos.org/d/10599-android-auto-implement-a-workaround-for-apps-not-installed-via-google-play)), so it is fragile.
     3. **AAAD.** Same idea, but only for its curated list. Useless for our own APK.
     4. **aa-proxy-rs / AAWireless `developer_mode`.** Makes the car look like the DHU, so everything sideloaded is listed. It needs hardware (a Pi Zero 2 W or the dongle) and works for wireless AA.
4. **Play Protect.** It flags AAAD/CarStream-type apps, but not a normally built personal app.
5. **Android developer verification** ([FAQ](https://developer.android.com/developer-verification/guides/faq)). Enforcement started on **2026-09-30 in Brazil, Indonesia, Singapore and Thailand**; global rollout is in 2027. ADB installs are exempt. A free hobbyist account covers up to 20 devices. India isn't in the first wave, but plan to register the package before 2027.

---

## 4. Throttling and limitations

- **Motion lockout.**
  - *Parked apps:* AA exits them when motion is detected. It uses car sensors (driving status, gear, parking brake, speed) and cross-checks them against phone location; that is why aa-proxy-rs also strips the accelerometer/gyro/dead-reckoning/speed sensors and forces `location_characterization = RAW_GPS_ONLY`.
  - *Car App Library surfaces (nav/POI):* stay visible and touchable while driving. The surface is how Maps and Waze draw. AA does not inspect what is drawn.
  - *Legacy CarActivity:* stays visible, but the car IME is blocked while driving.
  - *Driving-status bitmask* (from aa-proxy-rs comments): `0` = unrestricted, `1` = no video, `2` = no keyboard, and so on.
- **Keyboard.** Host keyboards are parked-only: SearchTemplate, SignInTemplate and the legacy car IME. Voice through the car mic is allowed while driving.
- **Lists and templates while driving.** `ConstraintManager` limits list lengths; there are template step/refresh quotas, and messages and text are truncated. None of this applies to surface pixels.
- **Frame rate and resolution.**
  - The whole AA session is a hardware-encoded video stream (H.264/H.265), typically 800×480, 1280×720 or 1920×1080 at 30 fps, with 60 fps on some head units and wireless setups. 2.4 GHz wireless may cap resolution ([aa-proxy-rs README](https://github.com/aa-proxy/aa-proxy-rs)).
  - Car App Library docs set no explicit FPS cap for the surface. The VirtualDisplay renders at whatever rate your WebView produces, and the host composites and encodes it.
  - Expect video in a WebView to be smooth enough but not native. No public measurements were found, so measure on the DHU with `adb shell dumpsys gfxinfo`.
- **DRM.** WebView gets Widevine **L3** only, so some services cap at SD/HD. Netflix playback is blocked in third-party WebViews ([AABrowserCharles README](https://github.com/thiarley/AABrowserCharles)).
- **Touchscreen vs rotary.**
  - Parked apps require "Has touch".
  - Car App Library surfaces work with rotary through pan mode (`onScroll`).
  - The legacy SDK gets the rotary as D-pad key events.
- **Audio focus.** Nav-category apps must not hold media focus improperly. Fermata reports MediaService conflicts with a nav surface since AA 17.3.
- **Nav category side effect.** Declaring NAVIGATION makes AA treat the app as a navigator, so starting it can end Google Maps guidance. Prefer **POI + `MapWithContentTemplate`** (car API 7), as AA Browser's beta did, unless you need `NavigationTemplate`.

---

## 5. Recommendation for our browser

**Build one APK with two car entry points. Keep the WebView engine shared.**

### Mode P — "Parked" (default; zero install friction; best UX)

- **Manifest.** `<application android:appCategory="game">` and a `BrowserCarActivity` with `<intent-filter><action MAIN/><category LAUNCHER/><category CAR_LAUNCHER/></intent-filter>`. Set `resizeableActivity=true`, landscape-adaptive layout, minSdk 35 for this path, or gate it at runtime.
- **APIs.**
  - `android.webkit.WebView` / `androidx.webkit` and a normal `InputMethodManager` keyboard.
  - `androidx.car.app.connection.CarConnection` (`CONNECTION_TYPE_PROJECTION`) + `Context.getDisplay().displayId` to detect the car display.
  - `WindowInsetsController` for immersive mode.
- **Requirements.** Works with AA Unknown sources only, a touch head unit and Android 15+. **Auto-closes when moving.** Install by any method, including GitHub/Obtainium or adb.

### Mode D — "Drive/Surface" (works any time; needs a Play-installed build)

- **Manifest.**
  - `<service android:name=".car.BrowserCarAppService" android:exported="true">` with `<action android:name="androidx.car.app.CarAppService"/>` and `<category android:name="androidx.car.app.category.POI"/>` (or `NAVIGATION`).
  - `<uses-permission androidx.car.app.ACCESS_SURFACE>` + `androidx.car.app.MAP_TEMPLATES` (or `NAVIGATION_TEMPLATES`).
  - `meta-data androidx.car.app.minCarApiLevel=7` and `automotive_app_desc.xml` containing `<uses name="template"/>`.
  - Dependency `androidx.car.app:app:1.7.x` (+ `app-projected` for AA).
- **Classes.**
  - `CarAppService.createHostValidator()` returns `HostValidator.ALLOW_ALL_HOSTS_VALIDATOR` for a personal build (or a Google-hosts allowlist), and `onCreateSession()`.
  - `Session` (+ `SavedStateRegistryOwner` if you use Compose).
  - `Screen.onGetTemplate()` returns `MapWithContentTemplate` (or `NavigationTemplate`), with a map `ActionStrip` containing **`Action.PAN`** plus your own `Action`s (back, URL, mic, tabs).
  - `AppManager.setSurfaceCallback(SurfaceCallback)`:
    - `onSurfaceAvailable` → `DisplayManager.createVirtualDisplay(…, OWN_CONTENT_ONLY | PRESENTATION)` → `android.app.Presentation` holding the shared `WebView`. Keep the WebView alive across surface churn with a `MutableContextWrapper`.
    - `onVisibleAreaChanged` / `onStableAreaChanged` → pad the layout.
    - `onClick` → synthetic `MotionEvent` DOWN+UP through `presentation.window.decorView.dispatchTouchEvent`.
    - `onScroll` → `webView.scrollBy`, or a synthetic drag for in-page scrollers.
    - `onFling` → `webView.flingScroll`.
    - `onScale` → `webView.zoomBy` (filter double-tap factors).
  - **Text input.**
    - Primary: `androidx.car.app.media.CarAudioRecord` (car mic) + `SpeechRecognizer`.
    - Secondary: our own on-surface keyboard View.
    - Parked: `SearchTemplate` (host keyboard).
    - Also: a phone-side URL push.
  - `CarContext.isDarkMode` / `Session.onCarConfigurationChanged`.
  - `CarHardwareManager.getCarInfo().addSpeedListener` (needs `com.google.android.gms.permission.CAR_SPEED`) if we later add our own parked/driving policy.
- **Distribution.** Run development on the DHU (sideloaded works). For the real car, use **Play Console Internal App Sharing or an internal track (most robust)**. The fallback for GitHub-only users is KingInstaller (classic intent on Samsung/Pixel; Shizuku on Android 17), or aa-proxy-rs `developer_mode` if we use a Pi/AAWireless.
- **Licensing.** fcaronte (MIT) and autobridge (MIT) are safe to borrow from. Fermata, kododake and aabrowser-drive are GPL-3.0, so either clean-room the patterns or license our app GPL-3.0.

### Skip

- The legacy aauto-sdk: proprietary blob, same Play requirement, no benefit over Mode D.
- A media-only registration, except for an optional audio-continuation companion.

### Safety and legal note

A browser usable while moving is illegal for drivers in most places (in India, the Motor Vehicles Act §184 covers handheld and distracting device use). Keep Mode D behind an explicit "passenger use" setting, even for a personal build.

---

## Sources

**Official docs**
- https://developer.android.com/training/cars/parked/auto
- https://developer.android.com/training/cars/parked/games
- https://developer.android.com/training/cars/platforms/android-auto
- https://developer.android.com/training/cars/testing
- https://developer.android.com/training/cars/apps/library/draw-maps
- https://developer.android.com/training/cars/apps/library/interact-map
- https://developer.android.com/reference/androidx/car/app/SurfaceCallback
- https://developers.google.com/cars/design/create-apps/apps-for-drivers/templates/search-template
- https://developers.google.com/maps/documentation/navigation/android-sdk/android-auto
- https://developer.android.com/developer-verification/guides/faq

**Repos (source read)**
- https://github.com/kododake/AABrowser: manifest; commits `9b7559d` (beta, Car App Library POI + VirtualDisplay) and `171f7a5` (Car App Library removed); issues #5, #14, #39, #66, #83, #129, #138
- https://github.com/AndreyPavlenko/Fermata: `fermata/src/auto/*`; issues #717, #773, #829
- https://github.com/fcaronte/AABrowser: `car/WideScreen.kt`, `CarService.kt`, manifest
- https://github.com/fcaronte/KingInstaller: `InstallationUtils.kt`, `MyUserService.kt`, `RootUtils.kt`
- https://github.com/aa-proxy/aa-proxy-rs: `src/mitm.rs`
- https://github.com/shmykelsa/AAAD
- https://github.com/kododake/AAAnything
- https://github.com/thiarley/AABrowserCharles
- https://github.com/slashmax/aamirror
- https://github.com/slashmax/AABrowser
- https://github.com/martoreto/aauto-sdk
- https://github.com/thekirankumar/carstream-android-auto
- https://github.com/androidautohacks/screen2auto
- https://github.com/IngridMorstrad/AndroidAutoBrowser
- https://github.com/kishorecheerala/AAYBrowser: puts every category in its manifest and claims it is driving-safe; unverified

**Coverage**
- https://www.slashgear.com/1360881/how-to-watch-youtube-on-android-auto-guide
- https://www.team-bhp.com/forum/car-entertainment/268567-guide-install-view-youtube-android-auto-vehicles-no-root-modifications-pc-required-3.html
- https://tech.yahoo.com/apps/articles/android-auto-lets-install-browser-150000597.html
- https://www.androidauthority.com/android-auto-weather-browser-app-support-3559888/
- https://androidauthority.com/android-sideloading-developer-verification-first-wave-rollout-3717921
- https://discuss.grapheneos.org/d/10599-android-auto-implement-a-workaround-for-apps-not-installed-via-google-play
- https://cafebazaar.ir/app/fr.sd.taada?l=en (TaaDa)
