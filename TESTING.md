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
