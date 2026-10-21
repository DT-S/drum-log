# Drum Log × LCARS Metronome — Design & Audio Transfer
Status: implementation in isolated branch `feature/lcars-2-design-audio-foundations`. Base: `a99428f0845b7844e8dcc5e8f686f6b4c36830f1` (Drum Log v1.10.1, PWA cache v17).

## Goal and non-goals
Bring the successful **Voyager / RHYTHM PADD** visual language and original user-supplied LCARS UI sounds to Drum Log without losing the familiar single-window, offline-first teaching workflow. This is a skin, navigation and nonblocking auditory-feedback project, **not** a rewrite of scheduling, journal, backups or storage.

The two apps remain independent. Do not import the metronome's scheduler, chart engine, tempo logic, demo data, or app shell; map applicable UI concepts into Drum Log's own markup and events.

## Safeguards (required on every milestone)
- All work on a dedicated `feature/**` branch. Do not modify, force-push or merge `main` without explicit authorization.
- Preserve the current GitHub Pages URL/origin, IndexedDB database `drum-log-lcars`, store `state`, key `main`, and existing data/backup schema v10. Do not clear caches with website-data deletion, reset IndexedDB, or migrate student records for cosmetic changes.
- Preserve auto-save, cross-tab conflict checks, recurring and biweekly schedules, makeup credits, holiday breaks, one-off cancellations, trial lessons and standalone events.
- Do not commit real students, contacts, notes, or user backups. Synthetic test fixtures only.
- Keep critical save/storage errors visible; ordinary notification auto-dismiss behavior stays untouched.
- Preserve keyboard focus, 24-hour clock, mobile safe areas, iPhone compact view and touch target sizes.
- Motion is event-triggered and nonblocking; support `prefers-reduced-motion`. No moving overlay should cover editing fields.
- Sound failures and autoplay restrictions must **never block** access, save or offline startup. Respect existing mute/volume settings.
- Each new local static asset must be explicitly precached by service worker. Verify offline upgrade without clearing IndexedDB.

## Implementation plan

### M0. Audit and release baseline [complete]
Review `index.html`, `style.css`, `mobile.css`, `schedule.css`, `sound.js`, `app.js`, `core.js`, `db.js`, SW, current tests and metronome's LCARS cue registry. Record that `sounds/soundsv2/` already contains the new 15 supplied MP3s. Confirm `main` currently passes GitHub Actions.

### M1. Design tokens + sound foundation [code complete; device acceptance pending]
- Add `lcars-refresh.css` *after* existing styles to give the app the same lavender/orange/amber/peach/blue family and recognizable segmented LCARS surface, retaining established desktop/phone layout geometry.
- Connect original `sounds/soundsv2/*.mp3` files to semantic UI events. Keep legacy `Acceptsound.mp3` for success.
- Navigation: short `keypress_standart` plus the original menu/window-change sample, without cutting the first sound off. Other controls: hover, secondary toggle, modal dismiss, warnings, invalid input and confirmation where appropriate.
- Keep existing settings and format unchanged; pre-cache all used sound files and style. Unit-test layering, preemption, mute and offline asset list.
- Small visual change only, no page transitions or startup gate yet.

### M2. Responsive component polish [implemented; browser/device validation pending]
Map metronome's color segmentation, bracket/edge treatments, high-contrast labels, pressed states and consistent text sizing into Drum Log's *existing* sections: Journal, Students, Schedule and Data Systems. Pay particular attention to the one-window iPhone journal, Schedule action trio and touch/keyboard safe areas. Do not copy layout breakpoints blindly.

### M3. Navigation and screen-assembly motion [implemented; device validation pending]
Add the distinctive one-shot staged LCARS headers/rails/chips/panels on **view changes only**, not continuous animation. No clipping or moving clickable input regions. Navigation sounds remain appropriately sequenced. Include reduced-motion and rapid-tab-switch cancellation checks.

### M4. Optional initialize/launch console
Adapt the user's approved Voyager RHYTHM PADD start concept with Drum Log branding, adapted to a teaching database. Default enabled with a visible `INITIALIZE DRUM LOG` action for browser-safe audio unlock; provide an explicit opt-out setting and a bypass if audio is blocked. Implement only after M1–M3 prove stable. Storing the option in backup requires a tested additive, backward-compatible settings migration; do not casually bump the schema.

### M5. Beta safety gate / release
- Test `npm test`, JavaScript syntax, offline precache path existence, CSS/layout checks and GitHub Actions.
- Browser smoke with disposable records on Firefox Linux and, when available, Safari iPhone 13/iPad: startup, all four pages, modals, local autosave and cross-tab rejection, schedule and one-off edits, backups export/preview/import, offline reload, PWA service-worker update, blocked-audio case and mute.
- Compare before/after export and notes. Confirm previously saved students and lessons survive a new build on the **same origin**.
- Run with a disposable browser profile before exposing this branch through Pages. Avoid deploying the experimental branch to the live origin.
- Open PR for review. **No automatic merge.** Keep a backout path: branch can be discarded and `main` remains the stable version.

## Why first phase avoids the launch overlay
Drum Log is already used for real teaching records. A full-screen gate and new settings migration could interfere with the ability to get straight to urgent lesson notes. Build and verify the new look and basic sounds separately before adding any startup interaction.

## Milestone log
- Baseline GitHub Actions on `main`: success for commit `a99428f0845b7844e8dcc5e8f686f6b4c36830f1`.
- M1 branch commit before acceptance notes: `fec1d7afcdb4267d2c44e9c7b734c512ee4e71a0`. `npm test` in GitHub Actions: **139 of 139 passing** on both branch push and draft-PR, including original audio/data regressions and new layered-navigation/offline file tests. Check GitHub Actions for subsequent commits.
- M1 manual browser acceptance remains pending (see `TESTING.md`). The live `main` site has not changed and should not be used to test experimental code.

## M2 component review checklist

- LCARS component theme is a separate stylesheet `lcars-components.css` loaded **after** the base, mobile and schedule styles. It does not change or rebind application markup, events, scheduling or the data schema.
- All four surfaces get dedicated variants: Journal (editor/history/shortcuts), Students (roster/search), Schedule (three action segments, day rows, event status), Data Systems (settings and archive cards), plus modal confirmation hierarchy.
- The semantic schedule accent colors for trials, canceled, free, and independent calendar events are preserved. The CSS does not alter placement of the three schedule action buttons, the one-window mobile pane switching, or the minimum text-editor font size.
- Pointer-event-free decorations, visible focus rings, and reduced-motion preference are required. Check 320, 390, 768 and 1440 CSS px before release, plus iPhone landscape/safe-area and Firefox 200% zoom.
- Added/offline-cached CSS bumps shell cache to v19 on this **experimental** branch. Never clear the user's real IndexedDB data to force an update.

## M3 implementation checkpoint

- `lcars-motion.js` animates only after a real navigation to a different tab; it never reruns on render/autosave or at idle. Rapid navigation cancels the prior class/timer, while a same-tab click keeps the original press sound.
- `lcars-navigation-motion.css` staggers LCARS headings/rails, roster entries, the schedule and settings panels. Only opacity and brightness change; controls do not translate, scale, clip or lose hit targets. Navigation keeps the two original keypress/menu sounds from M1.
- Respects reduced motion. CSS and JS precached by experimental service worker v20.
- M2 Chromium layout checks previously passed at 320/390/768/1440 with synthetic data and save/reload; rerun after M3 before acceptance.

## Additional requested LCARS parity work (after M4)
- **M6 · Update installer / PWA updates [implemented; device validation pending]:** reuse the metronome's update detection, staged download/activation messaging, safe reload and a controlled "Check for updates" action. **Never** discard unsaved journal notes or replace the database when applying a shell update. Avoid unsolicited `skipWaiting` while text is unsaved.
- **M7 · LCARS slider components:** port the metronome's distinctive segmented track, bracket thumb, LED tick rail and numerical readout into Drum Log's *existing* Sound Volume and Mobile Scale sliders; preserve their current min/max/step, focus, keyboard and iOS accessibility.
- **M8 · Additional staggered interface effects:** refine buttons, notice banners, modal assembly, chart-free list and pane transitions. No continuously moving content, no focus-stealing effects; honor `prefers-reduced-motion`.
- **M9 · Quality-of-life parity:** review the metronome's settings clarity, toast expiration, backup/update status, responsive sizing, and input affordances individually. No accidental import of metronome-specific rhythm functions.
- Each milestone requires its own regression/browser/backup acceptance; M6–M9 are planned only, not quietly merged into M4.

## M4 implementation
- Optional `INITIALIZE DRUM LOG` launch console, enabled by default. Uses the approved Voyager frame, Drum Log logo and original stored launch MP3; real click unlocks Web Audio.
- Existing schema version 10 is retained. The optional `settings.launchScreen` boolean defaults to true in older backups, survives export/import, and may be disabled in Data Systems.
- If audio fails or times out the console opens anyway; no note/schedule transaction waits for audio. The app cannot guarantee autoplay without a click.
- The Startup CSS/JS and all MP3s are precached as an offline shell update; no custom sound uploads or remote fonts required.

## M10 · Mobile zoom guard and LCARS keyboard feasibility (2026-10-22)
### Implemented: accidental page zoom guard
- Touch devices only: `lcars-zoom.css` uses `touch-action: pan-x pan-y`, intentionally **not** `touch-action: none` or `manipulation`. Keep one-finger vertical/horizontal scrolling, normal taps, and input selection; remove double-tap page zoom and browser pinch-zoom.
- `lcars-zoom.js` adds a passive-false, touch-only fallback for WebKit `gesturestart`/`gesturechange` and multi-touch moves. Single-finger moves are never canceled. No global `dblclick` prevention, no disabling OS assistive zoom, and no change to the saved `uiScale` preference.
- Coarse-pointer text inputs/selects/textarea remain at least 16 CSS px to prevent iOS auto-focus zoom. Adds the files to offline precache (v22).
- Real iOS Safari/PWA acceptance still necessary. Browser engines/OS accessibility settings can override some zoom restrictions.

### Research: replacing the iOS software keyboard with an LCARS keyboard
- **Feasible in-page, not a system keyboard replacement.** Drum Log could render its own LCARS keypad as a DOM overlay and insert text into actual controls.
- iOS Safari does **not** implement `virtualkeyboardpolicy="manual"` or the Chromium VirtualKeyboard API. `inputmode="none"` is not dependable enough on iOS for production suppression, and blindly forcing every input `readonly` breaks selection, external keyboards, cut/copy/paste, dictation, shortcuts and native autofill.
- Safer incremental experiment: opt-in **LCARS date/time/numeric keypad** first, for simple bounded inputs (date, time, duration, makeup count). Use scoped `readonly` only while the custom keypad is active, preserve input value/selection semantics, and offer a visible **SYSTEM KEYBOARD** escape action.
- A full LCARS QWERTY keyboard for student names and multi-line lesson notes is possible but significantly larger: locale layouts (German umlauts, special characters), caret/selection, composition/IME, autocorrect, accessibility, clipboard, external-keyboard handling, software keyboard suppression and secure input all need tests. The native iOS keyboard remains the default for notes.
- Prototype on an **isolated test page**, not in the live note editor; test real iPhone 13/iPad Safari before any integration. No keyboard substitution is shipped in M10.

References:
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/virtualkeyboardpolicy
- https://caniuse.com/mdn-html_global_attributes_virtualkeyboardpolicy

## M6 checkpoint — explicit, editor-safe PWA update installer
- The `Data systems > Storage status` card has `CHECK FOR UPDATES`, `INSTALL UPDATE & RELOAD`, and `RELOAD UPDATED APP` states, plus non-disappearing status text.
- Updates use the existing PWA service worker via one shared registration; updates are **not** applied silently, and the page is never automatically reloaded. `skipWaiting` occurs only following an explicit request and after editor-save and open-tab checks.
- The update manager checks ongoing save transactions, save failures and open dialogs; it refuses to reload when notes may be unsaved. The active worker counts open scope clients before allowing forced activation. Unavailable counts are treated as unsafe.
- A just-installed update requires an explicit second click to reload. Tests must verify this two-phase flow and its failure modes. Service worker caches new update manager offline as `v23-update-console`.
- Existing indexedDB database, data records, schema v10, previous and current JSON backups are untouched.
