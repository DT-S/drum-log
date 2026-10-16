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
