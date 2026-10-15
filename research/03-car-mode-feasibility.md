# 03 — Car Mode Feasibility (Android Auto / Android Automotive OS)

*Research date: 2026-10-15. The app is a Kotlin phone browser built on the system WebView. The owner asked for "Android CarPlay", which means **Android Auto** (the phone projects to the car screen) and/or **Android Automotive OS (AAOS / "Google built-in")** (an OS that runs inside the car).*

---

## TL;DR

- **Android Auto (phone projection): a third-party browser cannot ship on Google Play today.** Google's own docs (updated 2026-09-22) list Browsers as an **AAOS-only "labs" parked category**. The docs also say: "Games are the only parked app category supported by Android Auto at this time." At I/O 2025 Google said browsers were "coming soon" to Android Auto. By October 2026 that still hasn't shipped for developers. Video on Android Auto was re-announced at I/O 2026 for **Android 17+ phones, "later this year"**, and it is early-access only.
- **WebView on the Android Auto car screen:** the only non-sideloaded way is the parked-app route (`CAR_LAUNCHER`, Android 15+ phone), and that route is open only to **games**. Car App Library templates cannot host a WebView. The `Surface` is available only to navigation, POI and weather apps, for drawing maps. Putting a browser into a game or a map app would break quality rule **PC-1** and get rejected.
- **AAOS: browsers are allowed, but in beta.** Any developer can publish to **Internal testing only**. Closed, open and production tracks "will be permitted at a later date". Vivaldi and Chrome are in cars through partnerships. A second path is the invite-only **Car ready mobile apps program**, which covers browsers.
- **What an indie developer can ship on Play now:**
  1. A **car/dashboard-mode UI inside the phone app**, which needs no Google car approval.
  2. An **Android Auto media-category companion** that reads saved pages and articles aloud with TTS. Adobe Acrobat shipped this pattern for PDFs in 2026.
  3. An **AAOS parked-browser build** kept in internal testing, plus applying for early access and nominating the app to Car ready, so it's ready when the category opens.

---

## 1. Can a third-party browser run on Android Auto (phone projection)?

### Official category matrix (as of Oct 2026)

Source: [Android for Cars overview, developer.android.com/training/cars](https://developer.android.com/training/cars) (last updated 2026-09-22)

| Category | Built with | Platform | Driving/parked | Play tracks |
|---|---|---|---|---|
| Media (audio) | `MediaBrowserService`/`MediaSession` (templated media via Car App Library) | AA + AAOS | driving or parked | **All** (templated media: Internal/Closed only, Early Access) |
| Messaging (notifications) | `MessagingStyle` notifications | AA | driving or parked | All |
| Templated messaging / Calling (labs) | Car App Library / Telecom Jetpack | AA | driving or parked | Internal + Closed |
| Navigation | Car App Library | AA + AAOS | driving or parked | All |
| POI (parking, charging, fuel) | Car App Library | AA + AAOS | driving or parked | All |
| IoT | Car App Library | AA + AAOS | driving or parked | All |
| Weather | Car App Library | AA + AAOS | driving or parked | All |
| **Video** (parked) | Views/Compose | **AAOS** (AA "coming in beta") | parked; audio-only while driving (EAP) | All (AAOS) |
| **Games** (parked) | Views/Compose | AA + AAOS | parked only | All. GA since **2026-09-14** |
| **Browsers (labs)** (parked) | Views/Compose | **AAOS only** | parked only | **Internal testing only** |

[About parked apps](https://developer.android.com/training/cars/parked) lists the parked categories as Video → AAOS, Games → AA + AAOS, and Browsers → AAOS. [Add support for Android Auto to your parked app](https://developer.android.com/training/cars/parked/auto) states plainly: *"Games are the only parked app category supported by Android Auto at this time."* It also warns against promoting Android Auto builds to unsupported tracks, *"or your submission will be rejected during review."*

### Timeline of announcements

| Date | What happened | Source |
|---|---|---|
| Jan 2024 (CES) | Chrome comes to cars with Google built-in (AAOS), parked only. Beta started on Volvo/Polestar. | [Android Authority](https://androidauthority.com/google-chrome-cars-android-auto-ces-3400760), [CarAdvice](https://www.caradvice.com.au/news/google-chrome-added-to-select-volvo-polestar/) |
| Feb 2025 | Car ready mobile apps program begins: adaptive phone apps in the video, games and **browser** categories become downloadable on AAOS. Invite-only. | [Car ready mobile apps](https://developer.android.com/training/cars/car-ready-mobile-apps), [Android Authority](https://www.androidauthority.com/android-automotive-car-ready-mobile-apps-program-3516416/) |
| **May 20–22, 2025 (I/O 2025)** | Games on Android Auto in **beta** (Android 15+ phones, Internal/Closed tracks). *"Video apps will be supported on Android Auto, starting with phones running Android 16 on select compatible cars."* Browsers on Android Auto described as **"coming soon"**, with no date or details. On AAOS, video was open for submissions and browsers were in beta. Weather graduated to GA. | [Android Developers Blog, I/O 2025](https://android-developers.googleblog.com/2025/05/android-for-cars-google-io-2025.html), [9to5Google](https://9to5google.com/2025/05/20/android-auto-weather-video-browser-apps/), [TechRadar](https://www.techradar.com/vehicle-tech/car-infotainment/android-auto-is-getting-video-and-browser-apps-for-your-car-dashboard-and-more-weather-apps-too), [heise](https://heise.de/-10398062), [autoevolution](https://www.autoevolution.com/news/google-will-allow-android-auto-users-to-browse-the-web-without-their-phones-251682.html), [Tom's Guide](https://www.tomsguide.com/phones/android-phones/android-auto-is-getting-support-for-web-browsers-but-is-that-a-good-idea) |
| Oct 20, 2025 | Docs add a "Mark your app as a browser" section (AAOS). | [What's new](https://developer.android.com/training/cars/whats-new) |
| Mar 8, 2026 | XDA: official parked browsers (Vivaldi, Chrome) exist only on "some Android Automotive models", and Android Auto users have been "left behind". The workaround it describes is sideloading. | [XDA](https://www.xda-developers.com/yes-you-can-use-a-web-browser-in-android-auto-when-youre-parked/) |
| Apr 14, 2026 | Browser manifest requirements updated (AAOS). | [What's new](https://developer.android.com/training/cars/whats-new) |
| **May 19, 2026 (I/O 2026)** | Parked video on Android Auto *"for the first time"*: 60fps HD, *"start rolling out to compatible vehicles later this year"* for *"phones running Android 17 and higher"*. EAP form for video. Templated media comes to AAOS (Car App Library 1.9 alpha). Widgets come to Android Auto. Roadmap: a templated driving UI that switches to a native adaptive app when parked. **Browsers are not mentioned.** | [Android Developers Blog, May 2026](https://android-developers.googleblog.com/2026/05/android-for-cars-unifying-platforms-premium-experiences.html), [Engadget](https://engadget.com/2170136/android-auto-is-getting-a-big-makeover-for-2026) |
| Sep 14, 2026 | Games category **GA** on Android Auto and AAOS, publishable to any track. | [What's new](https://developer.android.com/training/cars/whats-new) |

**Status as of Oct 2026:**
- Browser on Android Auto: announced in 2025, but **not available to developers**. There is no manifest path, no track and no early-access form specific to Android Auto browsers. The early-access form at [forms.gle/VsXEdDEBidxw8q8u8](https://forms.gle/VsXEdDEBidxw8q8u8) is shared by video and AAOS browsers.
- The Car ready program page says *"At a later date, Android Auto will add support for these apps"*, and those apps include browsers.

### Requirements that will apply once browsers open (inferred from the AAOS browser rules, [car app quality, browser category](https://developer.android.com/docs/quality-guidelines/car-app-quality?category=browser))

- **DD-3 / DD-2:** must not be launchable or usable while driving. Audio must stop when driving starts. The audio-while-driving exception (DD-4) covers video apps only, not browsers.
- **SD-1 / SD-2:** no saved passwords or payment info unless a profile lock is set. Before syncing sensitive data, prompt the user to authenticate and tell them the data is going to the car.
- **UX-1..3 (Tier 1):** 64dp touch targets, 24dp spacing, 24sp fonts. **IN-2:** no heads-up notifications. **AN-1:** no navigation dead ends. **EP-2:** restore state on relaunch.
- **Review:** car apps get an *additional manual review* beyond standard Play review. *"Until the car review is approved, updates to the app are not distributed to any device"*, so Google recommends a separate car release.
- **Parked apps on Android Auto in general:** the phone must run Android 15+. Activities run full screen. *"Android Auto automatically exits an app when vehicle motion is detected."* Web-page intents open on the phone, not the head unit. Users can't grant runtime permissions on the head unit. Apps must not be pillarboxed on landscape screens (DO-2). See [Android Auto platform page](https://developer.android.com/training/cars/platforms/android-auto).

---

## 2. Can a WebView be shown on the Android Auto car screen at all?

| Route | Can it render a WebView? | Shippable on Play? |
|---|---|---|
| **Car App Library templates** (POI, IoT, weather, navigation, media) | **No.** The host renders fixed templates (lists, grids, panes, maps) built *"to meet driver distraction standards"*. No custom views. | Yes, but no web content |
| **Car App Library `Surface`** (`androidx.car.app.ACCESS_SURFACE`) | Technically you can draw Views or Compose through `VirtualDisplay` + `Presentation`. But access is only for *"Navigation, point of interest (POI), and weather apps"* using `NavigationTemplate` / `MapWithContentTemplate`, and the purpose is drawing maps. | A web page on that surface breaks **PC-1** ("must not include features outside the app types intended for cars") and would be rejected. [Draw maps](https://developer.android.com/training/cars/apps/library/draw-maps), [CarAppPermission](https://developer.android.com/reference/androidx/car/app/CarAppPermission) |
| **Parked app** (`android.intent.category.CAR_LAUNCHER` activity, Android 15+ phone) | **Yes.** It's a normal Activity on the head-unit display, so WebView works. This is how sideloaded "AA Browser" runs. | **Only for the Games category** today. A browser declared as a game breaks PC-1 / EP-1 and gets rejected. |
| **Sideloading** (Android Auto developer settings → "Unknown sources") | Yes (AA Browser, Fermata Auto, Screen2Auto) | **No.** Real cars only run apps from trusted sources (*"Google Play, ONE store"*). Unknown sources is a developer test setting, so you can't distribute this way. |

**Conclusion:** right now there is **no legal Play-distributed way** to show a WebView on an Android Auto screen. The route that will open is the parked `CAR_LAUNCHER` activity once Google adds browsers to Android Auto's parked categories. Building our parked UI to the AAOS browser guidelines prepares us for both platforms.

---

## 3. Android Automotive OS (Google built-in)

### Browsers that exist

| Browser | Status | Cars (self-reported) | Source |
|---|---|---|---|
| **Vivaldi** | First browser on AAOS (Polestar 2, Dec 2021). Later the first browser on Google Play for AAOS. Parked only, no file downloads. Video continues as audio-only once driving starts. | Polestar 2/3/4, Volvo, Renault (Megane E-Tech, Austral, Rafale, Scenic, R5), Mercedes E-Class/CLE, select Audi (Q6 e-tron), Ford Explorer 2025, Lincoln Nautilus/Aviator | [Vivaldi Automotive](https://vivaldi.com/android/automotive/), [Vivaldi help](https://help.vivaldi.com/android/android-install/vivaldi-in-android-automotive-os), [Ford/Lincoln post](https://vivaldi.com/blog/news/vivaldi-steers-in-car-browsing-now-available-in-the-all-new-ford-and-lincoln-infotainment-system/), [Android Central](https://androidcentral.com/android-automotive-adds-its-first-browser-vivaldi-polestar-cars) |
| **Google Chrome** | Launched CES 2024, beta on Volvo/Polestar first. Parked only. A profile lock is needed for sync and autofill (this is the SD-1 rule). | Volvo XC40/C40, XC60 MY22+, all Volvo MY23+, Polestar 2, then "more brands" | [autoevolution](https://www.autoevolution.com/news/google-launches-google-chrome-in-android-cars-only-available-when-parked-227399.html), [CarAdvice](https://www.caradvice.com.au/news/google-chrome-added-to-select-volvo-polestar/) |
| Firefox / Edge / Opera / Brave | No AAOS build found. | — | [autoevolution](https://www.autoevolution.com/news/google-will-allow-android-auto-users-to-browse-the-web-without-their-phones-251682.html) |

Google built-in covers more than 100 models from 16 brands. GM covers about 4M US vehicles (MY2022+). Subaru joins with the 2026 Outback. See [Google blog](https://blog.google/products-and-platforms/platforms/android/cars-with-google-built-in-google-play-updates/) and [9to5Google on Subaru](https://9to5google.com/2025/11/20/subaru-adopts-android-automotive-starting-in-the-2026-outback/).

### How a third party distributes a browser to AAOS

Source: [Build browsers for Android Automotive OS](https://developer.android.com/training/cars/parked/browser)

- *"The Browsers category is in beta. At this time, anyone can publish browsers to internal testing tracks on the Play Store. Publishing to closed testing, open testing, and production tracks will be permitted at a later date."* There is an early-access nomination form.
- Manifest: an exported activity with `MAIN` + `android.intent.category.APP_BROWSER`, plus the standard AAOS Play feature requirements (`android.hardware.type.automotive`, etc.).
- **Do not** set `distractionOptimized=true`. The OS covers the app when UX restrictions start. Pause media in `onPause`. Use `CarUxRestrictionsManager.isRequiresDistractionOptimization`, never gear or speed. See [AAOS parked apps](https://developer.android.com/training/cars/parked/automotive-os).
- Credentials: AAOS cars have no biometrics. Use `BiometricPrompt` with `DEVICE_CREDENTIAL` only, and `KeyguardManager.isDeviceSecure`.
- Car manual review against the browser quality guidelines applies to every track except internal.
- Play adds extra filtering. Parked apps aren't offered on head units that lack OEM fixes.
- Many cars run x86 CPUs, so include x86/x86_64 ABIs. WebView itself is supplied by the system.

**Second path: the [Car ready mobile apps program](https://developer.android.com/training/cars/car-ready-mobile-apps).** It covers video, games and **browsers**. It's *"by invite only. You can nominate your app"*. Selected apps are opted in automatically and run in the OS's [compatibility mode](https://developer.android.com/training/cars/platforms/automotive-os/compatibility-mode): the system supplies back navigation and a safe area, and the app is blocked while driving. The app must meet the Car ready (Tier 3) guidelines for its category. This is how a phone browser could reach AAOS production without waiting for the beta to open.

**Testing:** AAOS emulator system images in Android Studio, including the AAOS on Pixel Tablet image (GA since May 2025). Emulators can simulate driving.

---

## 4. Options for our "car mode", ranked by feasibility

| Rank | Option | Ships on Play now? | Effort | Value | Notes |
|---|---|---|---|---|---|
| **1** | **(c) In-app "Car / Dashboard mode"** on the phone: big touch targets (≥64dp), 24sp+ text, high contrast, a speed-dial grid of bookmarks, voice search, a "read aloud" button, landscape layout, auto-enable when connected to car Bluetooth or a dock | **Yes.** It's ordinary phone UI with no car review. | Low | Medium | Market it for **passengers and parked use**. Don't present it as a while-driving browser. Gate it with a "Passenger / parked only" confirmation. Optionally use Activity Recognition (`IN_VEHICLE`) to blur content while moving. Also works for people who mirror the phone with unofficial tools, but we must not market or depend on those. |
| **2** | **(b) Android Auto *media* companion: "Listen to pages"**. A `MediaBrowserServiceCompat`/`MediaSessionService` exposes a browse tree (Read-later queue, Bookmarks, Recent tabs). Each item is an article extracted from the page (Readability-style) and spoken with Android `TextToSpeech`, or synthesized to audio files. Includes chapters, skip, speed, and a voice "play my reading list". | **Yes.** Media (audio) is open on all tracks. Classic `MediaBrowserService` media isn't early access; *templated* media is EAP. | Medium | **High.** It's the only in-car integration available today, and it's usable while driving. | Precedent: **Adobe Acrobat Reader on Android Auto (June 2026)** reads PDFs aloud as a media player, and its visual tools are disabled ([droid.tools](https://droid.tools/adobe-acrobat-reader-is-now-on-android-auto)). Must meet [media quality rules](https://developer.android.com/docs/quality-guidelines/car-app-quality?category=media): no autoplay (MA-1), Assistant/Gemini voice commands (VC-1), no text ads (AD-1), no auto-scrolling text (ST-1), limited images (IU-1), load within 10s (DR-3). Ship the same APK. Declare `<uses name="media"/>` in `automotive_app_desc.xml`. The same service later works on AAOS. |
| ✗ | (b-alt) POI/bookmarks list on Android Auto that opens pages on the phone | **No** | — | — | POI is limited to parking, charging, fuel and similar. A bookmarks list isn't POI, so it breaks PC-1 and gets rejected. Web intents from the car open on the phone, which encourages phone use while driving. Skip this. |
| **3** | **(a) AAOS parked-browser build** (`APP_BROWSER`, parked-only, profile-lock rules, 64dp UI) | **Internal testing only.** Production waits for Google to open the category or for a Car ready invite. | Medium (mostly shares the phone app's large-screen UI) | Medium. The audience is small (AAOS cars) but growing (GM, Volvo, Polestar, Renault, Ford, Subaru). | Build it as **adaptive large-screen phone UI in the same APK**. Submit the early-access form and nominate for Car ready. The same parked UI should carry over to Android Auto when browsers open there (Android 15+ `CAR_LAUNCHER`). |
| **4** | **(d) DHU / emulator testing** | n/a (tooling) | Low | Required | DHU: SDK Manager → "Android Auto Desktop Head Unit Emulator" → enable AA developer mode → "Start head unit server" → `adb forward tcp:5277 tcp:5277` → `./desktop-head-unit` (or `--usb`). Supports touch, rotary, day/night, mic, and `restrict all` to simulate driving restrictions. Parked-app configs: 800x480, 1920x1080 wide, portrait. See [DHU docs](https://developer.android.com/training/cars/testing/dhu). AAOS: Android Studio AAOS emulator images. |
| ✗ | Sideload ecosystem: AA Browser ([GitHub](https://github.com/kododake/AABrowser), GPL-3, Android 15+), Fermata Auto, CarStream, Screen2Auto, installed via AAAD | **No** | — | — | These depend on Android Auto's developer-only "Unknown sources" toggle. Google keeps breaking them, and late-2026 developer verification applies to sideloading. Reliability varies by Android version. Can't be distributed on Play. Note: **AAWireless** is a legitimate wireless-AA dongle (hardware) and doesn't enable custom apps by itself. See [XDA](https://www.xda-developers.com/yes-you-can-use-a-web-browser-in-android-auto-when-youre-parked/), [Android Authority](https://www.androidauthority.com/sideload-apps-on-android-auto-3681820/), [Engadget](https://engadget.com/2246259/how-to-sideload-android-auto-apps), [SlashGear](https://www.slashgear.com/2253629/android-auto-best-sideloaded-apps/). |

### Recommendation for an indie developer

1. **Now (v1):** ship **Car/Dashboard mode** in the phone app. Then ship **"Listen in car"**, an Android Auto media integration that reads saved pages and the reading list aloud. Both pass Play today, and the media part is the only thing that actually appears on the Android Auto screen.
2. **Next:** make the phone UI **adaptive for large screens** (tablet, foldable, landscape), which we need anyway. Add an **AAOS parked-browser** variant (`APP_BROWSER`, no saved passwords without a profile lock) in the **same APK**. Publish it to the **internal testing** track, submit the **early-access form**, and **nominate for Car ready**.
3. **Watch:** the [Android for Cars What's new](https://developer.android.com/training/cars/whats-new) page. When "Browsers" appears for Android Auto parked apps, the same parked UI plus `CAR_LAUNCHER` lights it up for Android 15+ (likely 17+) phones.
4. **Avoid** anything that draws web content on a Car App Library surface or disguises the app as a game. Both get rejected and risk the developer account.

---

## 5. Safety and legal angle (brief)

- **Google policy:** distraction compliance *"is enforced during the Google Play review process"* ([AOSP driver distraction guidelines](https://source.android.com/docs/automotive/driver_distraction/guidelines)). Car apps get an extra manual review, and failing it blocks *all* updates to car devices. Browsers must be fully unusable while driving (DD-2/DD-3).
- **US (NHTSA visual-manual guidelines, voluntary):** glances of 2s or less, 12s total per task. They explicitly recommend disabling text entry, **web browsing** and video while the vehicle is moving. See [NHTSA](https://www.nhtsa.gov/sites/nhtsa.gov/files/strickland-distraction_guidelines_03122012.pdf) and [Autoblog](https://www.autoblog.com/2013/04/25/nhtsa-voluntary-guidelines-distracted-driving/).
- **India (owner is in Pune):** using a handheld phone while driving is prosecuted as dangerous driving under **Motor Vehicles Act s.184**. After the 2019 amendment the penalty is up to ₹5,000 or 1 year for a first offence, and up to ₹10,000 or 2 years for a repeat. Hands-free use is a grey area. See [Bajaj Allianz](https://bajajallianz.com/blog/motor-insurance-articles/know-about-section-184-of-the-motor-vehicle-act.html) and [iPleaders](https://blog.ipleaders.in/legality-talking-hands-free-bluetooth-driving/). These are secondary sources, so verify against India Code.
- **Product implications:**
  - Never market car mode as "browse while driving".
  - Keep visual browsing parked or passenger only, and keep in-motion features audio-only.
  - Don't store passwords in shared-car contexts.
  - Put a disclaimer on first use of car mode.
  - Don't promote or bundle sideload tools.

---

## Key sources

- [Android for Cars overview: category table](https://developer.android.com/training/cars)
- [What's new in Android for Cars](https://developer.android.com/training/cars/whats-new)
- [About parked apps](https://developer.android.com/training/cars/parked) · [Parked apps on Android Auto](https://developer.android.com/training/cars/parked/auto) · [Parked apps on AAOS](https://developer.android.com/training/cars/parked/automotive-os)
- [Build browsers for AAOS](https://developer.android.com/training/cars/parked/browser) · [Build video apps](https://developer.android.com/training/cars/parked/video) · [Build games](https://developer.android.com/training/cars/parked/games)
- [Car app quality guidelines: browser](https://developer.android.com/docs/quality-guidelines/car-app-quality?category=browser) · [media](https://developer.android.com/docs/quality-guidelines/car-app-quality?category=media)
- [Car ready mobile apps program](https://developer.android.com/training/cars/car-ready-mobile-apps) · [AAOS compatibility mode](https://developer.android.com/training/cars/platforms/automotive-os/compatibility-mode)
- [Android Auto platform page](https://developer.android.com/training/cars/platforms/android-auto) · [Car App Library](https://developer.android.com/training/cars/apps) · [Draw maps / Surface](https://developer.android.com/training/cars/apps/library/draw-maps)
- [Desktop Head Unit](https://developer.android.com/training/cars/testing/dhu) · [Car App Library releases](https://developer.android.com/jetpack/androidx/releases/car-app)
- [Android Developers Blog: I/O 2025 cars](https://android-developers.googleblog.com/2025/05/android-for-cars-google-io-2025.html) · [I/O 2026 cars](https://android-developers.googleblog.com/2026/05/android-for-cars-unifying-platforms-premium-experiences.html)
- Press: [9to5Google 2025](https://9to5google.com/2025/05/20/android-auto-weather-video-browser-apps/), [TechRadar](https://www.techradar.com/vehicle-tech/car-infotainment/android-auto-is-getting-video-and-browser-apps-for-your-car-dashboard-and-more-weather-apps-too), [XDA Mar 2026](https://www.xda-developers.com/yes-you-can-use-a-web-browser-in-android-auto-when-youre-parked/), [Engadget 2026](https://engadget.com/2170136/android-auto-is-getting-a-big-makeover-for-2026), [Vivaldi Automotive](https://vivaldi.com/android/automotive/)
