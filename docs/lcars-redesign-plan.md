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

### M2. Responsive component polish
Map metronome's color segmentation, bracket/edge treatments, high-contrast labels, pressed states and consistent text sizing into Drum Log's *existing* sections: Journal, Students, Schedule and Data Systems. Pay particular attention to the one-window iPhone journal, Schedule action trio and touch/keyboard safe areas. Do not copy layout breakpoints blindly.

### M3. Navigation and screen-assembly motion
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
