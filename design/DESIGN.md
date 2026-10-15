# MiniFocus — Design system (v1)

Spirit: the 2017–2019 "focus" browser. You see a gradient, one search field, and nothing else. While you browse there is a slim bar on top and one big button that erases everything. The identity is our own: a violet/indigo gradient, an orchid glow, and a coral-to-violet **Erase** button.

Mockups: `mockups/00-overview.png` (start here) through `11-car-auto-template.png`. Sources: `src/*.html` + `src/mf.css` + `src/icons.js`. Re-render with `src/render.sh` (headless Chrome, 2x).

## Logo — "Focus ring"
An open aperture ring (stroke width 5/48 of the mark) with a 90° gap at top-right. A small dot sits in the gap, and the core is a solid dot. On dark: white ring, `#FF8AB0` core. On light: `#5B3FE6` ring, `#E2489E` core. App icon: the mark on the brand gradient, in a rounded square. No fox and no third-party marks.

## Color
| Token | Hex | Use |
|---|---|---|
| night | `#140A33` | gradient start, top-left |
| violet | `#3A1A9E` | gradient mid, top bar |
| indigo | `#4F3BE0` | gradient end |
| orchid glow | `#B04DE0` @55% | radial glow, bottom-right of home |
| iris (primary) | `#7C5CFF` / text `#5B3FE6` | switches, links, selected states |
| iris-soft | `#EEE9FF` | accent containers |
| coral (erase) | `#FF5C8A` | tracker badge, destructive |
| Erase FAB gradient | `#FF6A8E → #E2489E → #A43BF0` | the only "loud" element |
| mint (secure) | `#2BD9A0` (on light: `#138A62`) | lock, "parked", success toast |
| ink / ink-2 / ink-3 | `#17132A` / `#4A4560` / `#8A86A0` | text (light) |
| bg / bg-2 / line | `#FFFFFF` / `#F6F4FB` / `#E7E4F0` | surfaces (light) |
| d-bg / d-surface / d-surface-2 / d-line | `#0E0B18` / `#1A1529` / `#251F38` / `#2E2844` | surfaces (dark) |
| d-ink / d-ink-2 / d-ink-3 | `#F1EEFA` / `#B9B3CF` / `#7F7896` | text (dark) |

Tracker categories: Ads `#FF5C8A`, Analytics `#7C5CFF`, Social `#2FA8FF`, Content `#FFB020`.

Home gradient: `linear-gradient(162deg, #140A33 0%, #2A1279 38%, #3F22C2 72%, #5A3BE6 100%)` plus an orchid radial glow at the bottom-right and a darkening radial at the top-left. Top bar: `linear-gradient(100deg, #24106B, #3A1A9E 55%, #4F3BE0)`.

## Type
Inter (fallback: system UI / Roboto). Tabular figures for counts.
| Role | Size / line | Weight |
|---|---|---|
| Display number (shield count) | 48 / 50, −2 tracking | 800 |
| Title (app bar) | 22 / 28 | 700 |
| Wordmark | 17 | 700 |
| Body / list primary | 15–16.5 / 22 | 400–600 |
| URL text | 15.5 | 600 for the registrable domain only |
| Secondary | 12.5–13.5 / 18 | 500 |
| Section label | 12, +0.9 tracking, uppercase | 700, iris |
Car: primary 20–24, secondary ≥ 14 (phone) / ≥ 17 (head unit).

## Spacing & shape
4-pt grid. Screen gutters are 16–24 dp. List rows are 54 dp (66 dp with an icon tile). Radii: field 18, cards 20–22, sheets 28 (top), tiles in car mode 24–26, chips 8–12, Erase FAB fully round. Elevation uses soft, tinted shadows (violet-black, not grey).

## Components
- **Home search field**: 58 dp tall and white at 97%. It holds an iris search icon and a placeholder ("Search or enter address", `#7A7591`), and sits at about 40% of screen height. One line of hint text below it, at 62% white. A ⋮ in the top-right is the only other control.
- **Typing state**: the field docks to the top with a 3 dp pink focus ring. Inline autocomplete is highlighted in `#D5C8FF`. The first row is "Search for '…'" in a tinted pill that names the engine. Suggestions come next, each with a ↖ "fill" affordance.
- **URL bar** (browsing): 56 dp bar on the gradient, made of a pill (12 radius, white at 12%) with a mint lock and the domain only (no scheme or path), the **shield** button, and ⋮. The shield carries a coral count badge (16 dp, 2 dp ring in the bar color). The page goes edge-to-edge, with a soft scrim behind the gesture bar.
- **Erase FAB**: 60 dp, 20 dp from the right edge and 52 dp from the bottom (clear of the gesture bar). Trash icon, 2 dp stroke, Erase gradient fill. It is always visible while browsing and never hides on scroll.
- **Shield sheet**: modal bottom sheet over a 48% scrim. Contents, top to bottom:
  - site row (favicon, domain, "Connection is secure")
  - stats card: big count with a gradient fill, a stacked category bar, and a 2×2 category grid
  - per-site switches: Block ads & trackers, Block cookies (3rd-party), JavaScript
  - "Site info & permissions" row
- **Overflow menu**: 268 dp card, 20 radius. A top icon row (back, forward, reload, bookmark), then Share, Open in…, Request desktop site (checkbox), Add to home screen, Find in page, a divider, then Car mode (badged NEW) and Settings.
- **Settings**: grouped cards on `bg-2` with iris section labels. The blocking level is a segmented control (Standard / Strict). Filter lists show "Updated 2 h ago · Update" in the section header, with one switch row per list. Appearance uses visual swatches (Light / Dark / Gradient).
- **Snackbar**: `#1F1934`, 16 radius, 16 dp side margins, sitting above the gesture bar, with a mint check badge.

## Motion
- **Erase** (about 650 ms total):
  1. The FAB pulses and scales to 0.9 (80 ms).
  2. A circular reveal of the home gradient expands from the FAB center with an emphasized-decelerate curve (350 ms).
  3. Behind it, two or three faint concentric rings and a few sparkles drift outward and fade.
  4. The page content fades and scales to 0.98 underneath.
  5. The snackbar "Your browsing history has been erased" slides up 16 dp and fades in (200 ms), holds for 2.5 s, then exits.
  6. Haptic: one light "confirm" tick when the reveal starts.
  Screen 06 shows this frozen at the midpoint.
- **Shield count**: the badge ticks up as blocks happen (number roll, 120 ms), with no bounce.
- **Sheets and menus**: standard Material 3 container transforms. The menu scales from its ⋮ anchor.
- Respect "Remove animations": the reveal becomes a 150 ms crossfade.

## Dark mode
Chrome switches to `#15111F` bars and `#241E35` pills. The Erase gradient and coral badge stay the same, since they are the brand. The mint lock lightens to `#6FE3B9`. When the site supports it, pages are asked for `prefers-color-scheme: dark`. An optional algorithmic darkening is available in settings. The "Gradient" theme is the default for home. Browsing chrome follows the system light/dark setting.

## Car-mode rules
- Touch targets are **at least 76 dp** (tiles 120+ dp, voice button 116 dp, Exit 56 dp tall × 100+ dp wide). Spacing between targets is at least 14 dp.
- High contrast: near-black `#07050D` background, white primary text (at least 7:1), and colored icons on 15% tinted tiles. No thin grey text.
- At most 6 shortcuts plus one voice button. No keyboard while moving.
- **Parked vs driving**: the browser is usable only while parked (green "Parked — browsing available" chip / banner). When the car moves, web content is blocked and replaced by a Listen / Read-aloud screen, and audio continues.
- **Android Automotive (head unit)**: full browser while parked (left rail, 76 dp URL field, parked banner). It follows the platform's distraction-optimization: the activity is not marked as distraction-optimized, so it is paused while driving.
- **Android Auto**: browsing isn't allowed there, so MiniFocus appears only as a media/template app ("Read aloud"). Saved articles are read by TTS, shown with a list template, large play buttons and a now-playing bar.
- Voice first: the mic is always reachable, and typical commands are "read the news" and "open maps".
- Car mode is dark-only, with no gradient behind content (the gradient appears only on the voice tile).
