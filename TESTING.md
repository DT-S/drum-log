# Verification status

## Executed in the development environment

- JavaScript syntax checks: app, core, database and service worker.
- 12 automated Node tests passed: current lesson start/end boundaries; next-week rollover; Sunday/Monday transition; archived profiles; overlap reporting; midnight-spanning lessons; Unicode/multiline JSON round trip; duplicate and orphan lesson rejection; malformed dates, schedules and unsupported schemas; duplicate profile/shortcut rejection; CSV quoting/BOM/line endings/formula protection; collision-free lesson keys.
- Static check: all service worker asset paths and manifest icons exist; no external runtime URLs.

## Not executed here

A controllable browser was not available. Actual IndexedDB transactions, touch interaction, rendered layouts, file download behavior, service worker activation and iPhone Safari / Firefox offline operation have not been device-tested. No claim of full device certification is made. Complete these checks before relying on the app for the only copy of real records.

## Acceptance checklist — Firefox and iPhone home-screen app

Use disposable records and a separate test browser profile where possible.

1. Add Max for the current weekday, starting five minutes ago; duration 45 minutes. Reload: Max must be labeled **Lesson in progress**.
2. Add an overlapping lesson. Reload: both students must be listed in the overlap warning. Select either manually and verify the note belongs to that student.
3. Set all appointments into the future. **Follow schedule** must show the nearest appointment, its date and **Next scheduled lesson**.
4. Type Unicode, quotes and several lines. Wait for **Saved on this device**, close/reopen and check the exact text.
5. Switch students immediately after typing. The saved text must remain with the original student.
6. Reopen the same student/date/time several times. Export JSON: it must contain only one entry for that combination.
7. Enter a past lesson. Open a later date: the prior chronological note must appear. Open the historical entry and edit it.
8. Place the cursor inside existing text and tap a shortcut. Existing text outside the selection must remain intact. Check on iPhone as well as mouse/keyboard.
9. Create, edit, reorder and delete a long shortcut. Reload and verify persistence.
10. Archive a student. Verify it leaves automatic scheduling but its history remains accessible through Archived students. Restore it. Cancel permanent deletion and verify nothing changes.
11. Export JSON; save it outside the browser. Create a temporary extra student. Preview the earlier backup, cancel and verify the extra student remains. Import with explicit confirmation; verify only the backed-up data remains.
12. Attempt to import malformed JSON, a newer schema, an orphan lesson, a duplicate entry and an invalid date. Each must fail without changing stored data.
13. Open both CSV exports in LibreOffice or Excel. Verify umlauts, multiline notes, semicolons and quoted text. Formula-looking notes must stay text.
14. Wait for **OFFLINE READY**, enable airplane mode/disconnect network, fully close/reopen. Verify profiles, edits, history, exports and local import still work.
15. Open two tabs on the same lesson. Make different edits. The later conflicting editor must display an error and keep its text available to copy.
16. Test a fresh app version with a bumped cache version. Close all old app windows and reopen online. Existing student data must remain, followed by a successful offline reload.
17. Verify portrait layout at 390px (iPhone 13), keyboard-open scrolling, dialog scrolling and touch targets. Check desktop Firefox keyboard focus and 200% zoom.
18. Test denied/unavailable storage and storage quota failures in a disposable profile. The app must show an error, never a false saved indication. Copy unsaved text before leaving the page.

Keep a verified external JSON backup throughout real use.

## Interface revision 1.1

JavaScript syntax, the existing 12 core tests, CSS delimiter balance and offline asset presence checked again. Browser rendering remains unverified in this environment. Check all four views and the student/shortcut/import/delete dialogs on desktop and iPhone. The service worker cache is now v2 and includes the bundled display font.

## Audio revision 1.2

18 automated tests pass (12 core + 6 audio/settings tests). Audio tests use a mocked AudioContext: activation gating, click-to-warning priority, hover throttling, stale playback cancellation, mute, missing audio failure handling and backward-compatible backup settings. All six original MP3s passed ffprobe inspection and byte comparison. All service-worker assets exist. Actual browser playback remains untested here.

On Firefox and iPhone: click/tap once, verify hover/contact and press sounds; navigate between views; save a student; submit an invalid form; open and cancel deletion/import; test mute, zero volume and volume persistence after reload; reopen offline and repeat. Confirm notes/autosave remain silent.

## Schedule revision 1.3

25 automated tests pass with TZ=Europe/Berlin. New coverage: fortnightly on/off weeks; far-future start dates; DST/year boundaries; lessons crossing midnight; flexible profiles excluded from recurrence; reopening today's flexible entry; schema 1 upgrade; historical records preserved after schedule change; schedule validation and round trip.

Browser acceptance still pending: create each schedule type, switch between types, export/import, and verify profile forms and calendar grouping on iPhone/Firefox. Change a student's regular time after saving a lesson and verify that history still shows the original time.

## Extra appointments — version 1.4

31 automated tests pass under Europe/Berlin. New checks cover dated flexible selection, own duration and end boundary, overlap with recurring lessons, identical-slot deduplication, archived/past exclusion, midnight, appointment backup validation and round trip, schema upgrades, and preservation of historical notes.

Browser checks remain pending: add/edit/remove appointments for each profile type, open their journal, verify next/current selection, and export/import the resulting data. Confirm that moving a booking with saved notes leaves those notes at the original time.

## Trial lessons — version 1.5

39 automated tests pass. New coverage: automatic selection without students; trial/regular overlaps; archived exclusion; midnight; full conversion preserving contact, remarks, notes and historical timing; atomic failure behavior; double-conversion prevention; conversion before notes exist; validation and schema 1–3 migration. JavaScript syntax and all offline assets checked. No browser/iPhone execution was available here.

Before production use: create a trial with no students, write notes and insert shortcuts, reload; verify Schedule and automatic selection; archive/restore; convert with a different regular weekday/time and confirm the original trial note remains at its original time. Export/import trials including archived records. Repeat offline in the installed iPhone app.

## Audio patch 1.5.1

The 39 existing tests passed; an additional test passed for delayed activation of an interrupted AudioContext, bringing coverage to 40 tests. Real iPhone validation remains required.


## Mobile compact workspace — 1.5.3 acceptance (not device-tested yet)
- Automated: verify schema-4 backup keeps phone scale and legacy backup defaults; reject invalid values. Verify mobile.css is referenced and offline-cached.
- Browser/device: iPhone 13 Safari PWA at 390px width: verify 80% default, switch to 75%, close/reopen, export/import JSON, confirm scale persists. Tablet and desktop must remain unchanged.
- Confirm header, four navigation buttons, and offline-status footer stay visible without *outer page scrolling* in portrait orientation; Notes and History / details switch correctly for normal and trial lessons.
- Verify a long note uses the textarea's own scrolling without clipped text; history and settings can scroll internally; no previous-lesson buttons become inaccessible.
- Open the iOS software keyboard; verify text fields remain legible and usable, no focus-induced browser zoom, and save status remains reachable. Repeat with very short landscape viewport and 200% accessibility zoom.
- Verify existing autosave, manual selection, appointment navigation, trial conversion, and text-shortcut insertion. Do not clear website data when testing service-worker updates.


## Schedule planner — version 1.6.0 acceptance (new)
The repository CI now runs Node 22 syntax checks and all Node regression tests, including cancellation and replacement invariants. **Manual mobile/browser acceptance remains required.**
1. Export an old v1.5.3 JSON backup outside the PWA. After update, verify the same students, journal records, trial and extra appointments remain. Import a duplicate of the old backup into a disposable context and verify migration.
2. Set Monday teaching hours e.g. 12:00–17:00 under Data systems. In Schedule Day, confirm free windows exclude weekly, fortnightly (correct weeks), trial and dated extra bookings. Switch to Week; verify Monday–Sunday dates, previous/next week and Today buttons.
3. Cancel only student A's next Monday at 12:15. Verify that occurrence displays Cancelled and a blue Available window, while the following Monday stays scheduled. Existing historical notes must survive unchanged; auto-follow skips the cancelled event.
4. Replace A with B from the cancellation. Verify one dated B appointment exists, slot no longer shown Available, and A remains cancelled for that date alone. B's ordinary timetable remains untouched.
5. Attempt replacement with B already booked at an overlapping time; check an error is shown and **A is not cancelled**. Verify the same after leaving an unsaved note and attempting navigation.
6. Try restoring A while B still occupies the slot; confirm refusal. Remove or move B's replacement booking, then restore A.
7. Without configured hours, ensure there are no invented free periods, except cancellation-derived windows. Add weekend and biweekly examples, trials and overnight bookings to confirm collision handling.
8. Set different hours per weekday; export and reimport JSON and check persistence. Try malformed cancellation/hours backup in a disposable browser: no changes to live data.
9. iPhone PWA: verify red trial rows, legible mobile controls, daily/weekly scrolling within the existing one-window workspace, dialogs, keyboard zoom, offline mode, and reminder functionality.
10. Confirm published service-worker v10 fetches the new JS/CSS and that the app can still be reopened in airplane mode; never clear existing site storage to make a cache refresh.


## Rolling weekday weeks + holidays — version 1.7.0 acceptance
- Automated Node tests: selected Wednesday anchors a Wednesday–Tuesday seven-day window, and next/previous advances from the anchor by seven days across DST, month and year boundaries. Existing Monday-start expectation is intentionally superseded.
- Holiday boundaries: From and To are both included; regular weekly and fortnightly lessons resume immediately after the end date. Verify across 2+ weeks and that Follow schedule finds the next session after longer breaks.
- Preserve all regular student profiles, historical notes, cancellations, trials and appointments; manually book an extra lesson inside a break, verify it is visible while the ordinary recurring instance remains suppressed.
- Never list a closed day as AVAILABLE solely from teaching hours, but allow **Book make-up** on its holiday banner. Verify overlapping manual bookings remain subject to collision warning.
- Backup migration: old schema-5 JSON loads into schema 6 with \`holidays: []\`; new schema-6 backup roundtrips all periods. Invalid dates, duplicate IDs and missing holiday arrays are rejected. Older releases cannot safely import schema 6.
- iPhone PWA portrait: switch Day/Week after selecting Wednesday; navigate Next/Previous, add/edit/remove a holiday, create a make-up, check red trial colors, verify all text inputs/dialog controls visible and scrolling within the single-window layout. Reopen online after cache update, test offline in airplane mode.


## Schedule LCARS toolbar and validation cleanup — 1.7.1
- Schedule heading contains the 4 action buttons **directly beneath SCHEDULE** in a single desktop LCARS segmented strip; the former grey explanatory subtitle is removed. On phones it becomes two two-panel strips with position-specific outer rounded ends; no clipped controls at 75–80% mobile scale.
- Navigation arrows are SVG paths, not emoji glyphs or Unicode black triangles. Left/right controls are labeled for screen readers. Date text remains editable and Day/Week/Today behavior stays unchanged.
- Open Schedule → Holiday break and submit a reverse date range. Confirm the specific validation error is shown in the dialog only, not as a permanent main-page alert. Correct either date, cancel, press Escape or tap the warning; each action dismisses it. With no interaction, the dialog error disappears after 10 seconds.
- Check other error conditions: errors outside modals are still visible until dismissed by tapping the message or switching views. A critical unsaved-note warning must not be silently lost before it is handled.
- Automated UI source/isolated dialog simulation tests plus Node syntax checks. Native iPhone/Firefox LCARS CSS and input behavior still require real-device verification.


## v1.8.0 credits and LCARS mobile terminal caps
- Schedule → choose a lesson → Cancel → Cancelled by **Me / teacher** → count increments by exactly one in Student records and Lesson log. Attempting a second cancellation does not duplicate a credit.
- Cancel another lesson by **Student** → count does not change. Changing the reason from Sick to Vacation must not change this rule: the initiator, not the reason, determines the credit.
- Restore teacher cancellation → removes exactly one credit; restoring student cancellation has no effect. If count was manually corrected to zero, restoring cannot go negative.
- Replace student A with B, choose Teacher for original cancellation: A gains one credit, B gains none; double bookings are still rejected atomically. Existing cancellations maintain their previous origin.
- Edit student → MAKE-UP LESSONS OWED: set 2, 0, 7, save/reopen, JSON export/import roundtrip, confirm exact value. Fractional/negative/out-of-range values are invalid. Booking a future makeup lesson does not deduct a credit. Manually reduce the count when a make-up has been delivered.
- Import a schema 6 backup with old cancellations lacking cancelledBy: credits default zero; no fabricated past teacher debt. Invalid origin/balance or schema 8 backup is rejected before replacing data.
- Updated v1.8.1 phone layout at 75–80% scale: exactly three Schedule command buttons remain side by side **on one row**. Left: Add appointment, **left cap rounded**; center: Add trial lesson, **both sides straight**; right: Holiday break, **right cap rounded**. Verify no text clipping on narrow iPhones. Ensure Students → Add student still opens the student editor and there are no duplicate visible `addStudent` IDs.
- All Node CI tests and syntax checks must pass; real iPhone/Firefox and offline reinstallation require manual acceptance. Keep external JSON backup before update.


## v1.8.1 make-up bookings redeem at scheduling
- Teacher cancels normal lesson → owes +1; open Schedule → Add appointment → type Make-up lesson → owed count immediately -1. Creating an Extra lesson does not change the count.
- A zero-credit student may receive an Extra lesson, but saving a Make-up lesson must show a clear error without creating a booking.
- Cancel a credited make-up as teacher → owed +1 (once); undo cancellation → owed -1. Cancel a credited make-up as student → no refund. Delete the student-cancelled appointment → still no refund.
- Delete an active make-up booking → owed +1; deleting a teacher-cancelled booking after the credit was returned → no second refund.
- Edit existing make-up time or date → no extra debit; change label to Extra → refund; change back to Make-up → spend. Change student: refund previous student's credit and spend from the new student or reject the change.
- Import schema-7 backup containing historical \`Make-up lesson\` appointments → no retroactive credit change. New v8 backups preserve \`redeemedCredit\` for every new credited appointment.
- Check iPhone Safari PWA modal options and error dismissal, service-worker v14 offline update, no changes to journal or regular timetable.


## v1.9.0 standalone external calendar events acceptance
- Schedule → **Add appointment** → **Recording / Jam / Other (no student)**: save a titled session with date, HH:mm start, duration, people and notes. Without any student records, Add appointment should open the independent-event editor directly.
- The event appears cyan in Day and rolling Week; edit date, type, title, participants and notes; delete only the selected event. Enter the same attendee and title on multiple different dates; each stays independent with a unique ID.
- Old trial lessons (red), converted trials, regular students, archived student records, journals, credits and holidays remain unchanged by event creation/edit/deletion. A standalone event has no student conversion or lesson-notes workflow.
- Verify time collisions against a regular student, a trial, another event and an overnight recording. Creating a conflicting event or a new student lesson over an event fails safely without partial writes or credit debit. Free time strips exclude event durations.
- During a holiday break an independent event stays visible, but regular recurring lessons remain suspended.
- Export a full JSON backup; confirm event collection/title/type/people/notes survive reimport. Import a schema-8 backup; event collection defaults empty and old lesson notes remain intact. Schema-9 backups should be refused by versions 1.8.x or lower.
- At iPhone scale 75–80% confirm no horizontal clipping in the new modal, Schedule events remain readable, and offline reopen after cache v15 displays saved events. Verify the original three LCARS Schedule buttons are unchanged.


## v1.10.0 single-occurrence lesson editing
- On a weekly 45-minute lesson, Schedule → **Edit lesson** → Minutes: 90 → Save this lesson only. The chosen date is now 90 min, next week's normal lesson stays 45 min. The student timetable and credit balance do not change.
- Edit the same adjusted lesson again, moving it to a new date and time. Its original weekly occurrence disappears (no duplicate); the moved event appears once in Day and rolling Week. **Follow schedule** may automatically select it at its new date/time.
- **Reset to regular schedule** restores the original date, start and current regular duration without losing existing journal notes. Open the changed lesson in Lesson log: the note editor must still display the original lesson record; the label states its original date/time.
- Try extension into the next student's lesson, a trial, an independently booked recording/jam, another one-off lesson or an overnight session. Save must fail without changing bookings, cancellation rows or make-up balances.
- If a moved lesson is explicitly cancelled, restore that cancellation before editing/resetting. Normal teacher/student cancellation credit policy must still work; a pure move or duration change does not add or consume credits.
- Reset after an unrelated recording or booking has occupied the original slot must be refused. Holiday closures still hide ordinary recurring lessons; explicit moved overrides stay visible until reset.
- JSON export/import must preserve lessonOverrides as well as all old notes and scheduled appointments. A v9 backup migrates to empty overrides; v10 backup is rejected by old releases.
- iPhone PWA: modal text/date/time controls, 90-min duration field, save/restore/reset flow, legible day/week rows, offline use after v16 update. Run Node unit suite and JS syntax checks; do not clear site data.


## v1.10.1 notification / banner dismissal
- In Data systems press **Request persistent storage**. Whether granted or refused, the top \`#notice\` banner must disappear after about **8.5 seconds**, without closing/reloading the PWA. Verify immediately dismissing by tapping it.
- Trigger **Export backup**, **Save teaching hours**, **Backup interval exceeded** and an info/warning such as a cross-tab change. Each uses the same timeout. Success (accept) and warning tones remain appropriate and are not replayed when the notice expires.
- Show notice A, then notice B before A's time expires. A's timer must be cleared; B stays visible for its entire 8.5-second duration.
- With an active notice, switch between Students, Schedule and Data systems or open a modal. The previous notice is dismissed without affecting the operation or any form input.
- With a hardware keyboard, focus the notice: Enter/Space/Escape dismiss it; Tab and other keys do not.
- Simulate invalid holiday form input: validation is dismissible and still expires after 10 seconds. Simulate a real unsaved-note/storage failure: the separate **#error** banner remains visible until acknowledged, so no unsaved data warning is lost.
- Verify both desktop Firefox and installed iPhone/iPad PWA; service worker v17 must be ready after online refresh, then test offline. No data schema migration for this patch.


## Experimental LCARS Metronome-inspired audio/design transfer (M1)
Branch: `feature/lcars-2-design-audio-foundations`, draft PR #11. **Do not deploy to production / merge without sign-off.** Current release `main` remains version 1.10.1, PWA cache v17.

M1 adds a safe visual override and semantic cue map using existing original `sounds/soundsv2/*.mp3` recordings. The two navigation sounds use one user interaction: keypress immediately, menu build at +55ms. New shell v18 adds their offline files, without changing any database schema. GitHub Actions 139/139 Node tests passed on the implementation as of 21 October 2026.

### Manual beta gate for this milestone
Use a **separate browser profile with fake students** and an isolated preview origin; do not overwrite the deployed app's origin or IndexedDB.

1. Firefox/Arch: confirm the Voyager palette, header rails, readable contrast, four navigation tabs, keyboard focus, dialogs, schedule actions and untouched journal layout.
2. Listen to menu navigation for two distinguishable overlapping samples, with no clipping or repeated sound on same-tab activation. Test rapid tab changes and alerts during playback.
3. Confirm hover, click, switch/toggle, warning, invalid form, success and Close samples. Ensure silent mode, app mute and zero app volume stop all playing UI sounds.
4. In settings, alter volume, reload, and verify same preference. Test first-interaction Web Audio unlock on Firefox and iOS; no autoplay guarantee before a gesture.
5. With an offline-ready PWA, disable network and reload; test every updated sound and all four views. Confirm the service worker installs cache v18 successfully and does not touch IndexedDB.
6. Use fake recurring, fortnightly and flexible students, trial lessons, makeups, holiday breaks and recording/jam entries. Verify schedule selection and date/time behavior matches the stable main build.
7. Edit a journal note, wait for Saved, reload, and compare the original contents. Export and preview JSON and CSV; confirm records and settings survive unchanged.
8. On iPhone 13/iPad check safe areas, no clipped controls, readable 16px editable text, software keyboard focus, scroll/one-window behavior, Safari silent mode and offline reopening.
9. Force Web Audio decode errors or denied playback and verify all storage, forms, schedule and export actions still work.
10. Test rapid switching with an unsaved note: the existing save gate, warning and cross-tab conflict protection must remain intact. Test `prefers-reduced-motion` and keyboard-only navigation.

Only after M1 manual approval should M2 reshape more elaborate page components. No automatic `main` merge is authorized.


## LCARS 1.11.0 / RC28: launcher → main-console assembly

Only the presentation layer changed. Database schema stays at 10; student records,
lesson notes, planner, backups and IndexedDB are untouched. Offline shell is
`v28-console-unfold`; `lcars-assembly.css` must be precached with the rest.

**Expected handoff:** On initial load, the launcher is visible. On one real tap
of INITIALIZE, launch audio starts inside that click and the launcher disappears
immediately. It must *not* replay or finish its own startup animation. The
main console then unfolds once over about 3 seconds: structural LCARS elbows,
rails and navigation, active page housing, controls, then actual record rows.
With the start screen disabled, the same full boot runs on load.

**Expected tab navigation:** A view switch is shorter (~1.48 seconds), and
animates only the destination view. The permanent header/sidebars/footer do not
restart. Same-view edits/saves and background autosaves must not replay the
boot. Schedule date/week changes still acknowledge their real updated content.

**Checks:** Launch with and without audio; verify the same visual handoff. Test
rapid tab switches, short and empty lists, reduced-motion, keyboard navigation,
and the note textarea with the iPhone software keyboard. Ensure no scroll-area,
hit-target, or safe-area clipping regressions. Check the 1.11.0 label is visible
in the desktop and iPhone footer; version must also appear on the launcher.
After first online activation, close and reopen the installed PWA offline and
confirm the new animations work without a network. Do not clear website data,
reset storage, or import real students into a disposable testing profile.


## Drum Log 1.11.1 / RC29: MP3-aligned choreography

This release supersedes **only the animation durations** documented under
RC28. No IndexedDB migration, no change to students, appointments, journal,
backup files or audio assets. New offline shell: `v29-audio-sync`.

Measured from the original bundled MPEG-1 Layer III frame counts:

- `launchsound_Staggered_Entrance_Animation.mp3`: **1,608 ms**. Clicking
  INITIALIZE hides the launcher immediately; the permanent LCARS shell
  and real active page unfold together in **~1,600 ms** (class removed after
  1,620 ms). The shell and page do *not* reconstruct twice.
- `menu_or_window_change.mp3`: **576 ms**. It follows a keypress at **+55 ms**,
  so the usual navigation choreography completes within **~630 ms**, with a
  640 ms class cleanup. Permanent shell remains steady; only destination view
  builds again.

Regression suite `tests/audio-animation-sync.test.js` parses the real bundled
MP3 frames and checks both choreography budgets. The complete Node suite and
Playwright layout tests must pass. On iPhone PWA, confirm version **1.11.1**
and test INITIALIZE once, then several quick page switches with sound enabled.
The two sound effects should end with the animations, without holding up app
interaction. Test muting and Reduce Motion. After an online update, verify
offline reopen without clearing Safari/website storage or importing any live
student data into a test profile.
