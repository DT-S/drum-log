# Drum Log — LCARS Teaching Console

An English-language, local-first drum student manager inspired by Voyager's LCARS interface. Plain HTML, CSS and JavaScript. No runtime packages, accounts, analytics, fonts from CDNs or cloud database.

## Start on your Arch Linux PC

Extract this folder, open a terminal inside it and run:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080` in Firefox. Keep using the same address and port: browser data belongs to that origin. Do not double-click index.html: ES modules, IndexedDB and the service worker require a proper web origin. Localhost works for local testing; your iPhone needs HTTPS hosting.

## Host over HTTPS / install on iPhone

Upload the contents of this folder to a static HTTPS host. No build step is needed. For GitHub Pages, place the files at the root of a repository, enable Pages for that branch in the repository settings and use its generated HTTPS address. The repository contains only program files: never upload student backups or personal records. All paths are relative, including the service worker, so a project subdirectory works.

On the iPhone:

1. Open your HTTPS address in Safari.
2. Share → Add to Home Screen → Add.
3. Launch the home-screen app online and wait for **OFFLINE READY** in the footer.
4. Enable airplane mode, fully close and reopen the app, then test a disposable student and note.
5. Export and re-import a test backup before entering valuable records.

The installed app and browser may have different storage contexts. Create or import your real data in the context you intend to use. Opening a different hostname, protocol, port, or browser will not automatically transfer your data. PC and iPhone are deliberately independent.

## Daily use

- Add a student under **Students**, including weekday, start time and duration.
- On a fresh app load, the current lesson is selected; otherwise the next scheduled lesson is shown with its scheduled date. **Today / new entry** opens today's date instead.
- **Follow schedule** recalculates the selection. Manual selection remains in place while editing; the application never changes the student underneath a note.
- Overlapping scheduled lessons are explicitly listed; choose the intended student.
- Every note input triggers an IndexedDB transaction, with a visible save state. Wait for **Saved on this device** before closing. The operating system can terminate any app before pending writes finish; no app can promise recovery of uncommitted keystrokes.
- Shortcuts insert at the current cursor/selection. Edit their labels and text and move them up/down in **Data systems**.
- The previous chronological lesson appears beside/below the editor and can be appended. History entries open for editing.
- Changing the lesson date/time opens the entry for that date/time; it does not move or overwrite the previously open entry. This supports backdated entries and multiple lessons per day.
- A lesson is uniquely identified by student, date and start time. Reopening it updates the same record. Blank lessons are not created merely by viewing a student.
- Archive preserves all notes and excludes the student from automatic scheduling. Permanent deletion requires confirmation and deletes that student's lessons too.

## Backups and transfers

**Export JSON backup** includes every profile, lesson, shortcut and setting. Store it outside browser storage. The reminder is based on the last initiated download, not proof that the file was actually saved; verify the downloaded file yourself.

**Import backup** validates schema, fields, dates, times, identifiers, links and duplicate records before any write. It shows incoming counts and current counts, offers a backup of current data, and requires a checked acknowledgment plus typing `REPLACE`. Replacement is one atomic transaction. A failure aborts the transaction. Imports replace the entire device database; there is no merge or synchronization. Close other app tabs before importing. The import limit is 20 MB.

The CSV exports are UTF-8 with BOM, semicolon-separated, CRLF rows and quoted fields including multiline notes. Lessons use DD.MM.YYYY. If a spreadsheet does not detect separators, choose UTF-8 and semicolon in its import dialog. Potential spreadsheet formulas are prefixed with an apostrophe for safety; JSON preserves the original text exactly.

## Privacy and protection

Student records live in IndexedDB in this browser/device. The app only fetches its own static files; it does not upload records or contact third-party services. A web host can still see ordinary requests for the program files.

Storage persistence can be requested under **Data systems**, subject to browser support and permission policy. Storage is never a substitute for backups. Clearing website data, deleting browser profiles, private browsing, device loss or browser eviction can remove data.

Use an iPhone passcode/Face ID and full-disk encryption plus a locked user session on Linux. There is no cosmetic PIN screen pretending to encrypt data. Local records and JSON/CSV exports are unencrypted. Keep backups in protected storage, especially on shared computers.

## Updates and future development

Before updating, export a backup. Keep the hosting origin and path stable. Replace application assets together, and increment the cache version (currently `v8`) in `sw.js` for each release. The new service worker caches all required assets before installation completes, then waits for old app tabs/windows to close. Reopen online to activate it, verify **OFFLINE READY**, and test offline again. App-shell cache cleanup does not touch IndexedDB.

Database: `drum-log-lcars`, IndexedDB version 1, object store `state`, key `main`. The stored JSON has `schemaVersion: 4` and collections `students`, `lessons`, `snippets`, plus `settings`. Database transactions always read the latest state before applying a mutation, avoiding stale full-state writes across tabs. Editing the same lesson from two tabs detects differing note text and stops rather than silently replacing it. Reconcile conflicting notes manually. Do not use simultaneous editing as a synchronization feature.

The IndexedDB store remains at version 1. Application schemas 1, 2 and 3 upgrade additively to schema 4; unknown newer backup schema versions are rejected. Future releases must add explicit migrations in `db.js` and compatible import transformations in `core.js`; do not delete/recreate the database during upgrades. The simple snapshot store is appropriate for a private teaching journal; very large collections may eventually justify indexed per-record stores with a tested migration.

## Files

- `index.html`, `style.css`: responsive English LCARS interface.
- `app.js`: journal, profiles, shortcuts, backup UI and autosave.
- `core.js`: scheduling, backup validation, unique lesson keys, CSV.
- `db.js`: IndexedDB creation and atomic mutations.
- `sw.js`: versioned offline app shell.
- `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`: installation assets.
- `tests/core.test.js`: dependency-free Node tests.
- `TESTING.md`: executed checks and device acceptance checklist.

Run automated checks with Node.js:

```sh
node --test tests/*.test.js
```

No npm installation is required. The ZIP contains no student data. This is an independent fan-inspired interface, not an official Star Trek product.

## Interface revision 1.1

Continuous LCARS framing, connected bands, black working surfaces, a locally bundled condensed display font and console-style controls throughout all views and dialogs. Notes and form text retain a readable normal-width font. Header counters show actual student/lesson totals when a view renders. Database name, schema, record keys and export formats are unchanged. The font is a renamed condensed Latin subset of DejaVu Sans Bold; its license is included in `fonts/LICENSE.txt`.

Before updating, export JSON. Replace the program files at the same hosting address, close all app windows, then reopen online. If the old cached interface is still visible, close and reopen once more after the update has downloaded. Do not clear website data to force a visual update.

## Audio revision 1.2

All six supplied recordings are bundled unchanged and cached offline. `sound.js` handles gesture activation, Web Audio decoding, throttled hover playback and interruption of stale sounds. No external audio requests.

- `hoversound.mp3`: mouse entry over controls / finger contact; quieter than other sounds.
- `buttonpress.mp3`: ordinary control activation.
- `switchingmenus.mp3`: main navigation changes.
- `Acceptsound.mp3`: successful form operations and JSON backup initiation/restoration.
- `Warningsound.mp3`: destructive/import review dialogs and warning notices.
- `invalidsound.mp3`: validation and operation errors.

Data systems → Audio interface controls mute, volume and test playback. Default output is 35%; hover is further reduced. Audio settings are part of JSON backups. Older backups remain compatible and receive default audio settings. Autosave and normal typing are silent. Browser audio starts after a click, tap or key press; hover alone cannot initially unlock it. Touch uses contact because there is no real finger hover. Device audio routing, volume and browser policy may affect audibility.

Update the full folder, including `sounds/` and `sound.js`, at the same address. Close all app windows, reopen online to download the new cache, then test offline. Do not clear site data.

## Schedule revision 1.3

In Students → Edit → Lesson schedule, choose:

- **Weekly**: fixed weekday and start time. Existing profiles without a schedule field continue to behave as weekly.
- **Every 2 weeks**: choose the first lesson / cycle start date and start time. The date defines both weekday and alternating weeks; there are no generated appointments before it. Choose a different start date to switch weeks.
- **Flexible / no fixed schedule**: no recurring day or time. Open the student log, set the actual date/time and enter notes. These profiles appear separately in Schedule and do not participate in automatic recurring selection. If there are no recurring profiles, the first active flexible profile is shown as a manual selection.

Opening a flexible profile reuses its most recent existing lesson today, or defaults to the current time if none exists. For an additional lesson that day, choose a different start time. Enter a note to save the record. For planned one-off lessons, use Schedule → Add appointment (added in 1.4).

Changing a student's recurring schedule only updates that profile. Historical lesson dates, start times, durations and notes are separate records and are never rewritten by that change. The history remains manually editable.

JSON schema 2 preserves schedule type and fortnightly anchor date. Version 1 backups remain importable; use app 1.3 or later for new backups. Student CSV adds Schedule and Cycle start columns. No IndexedDB deletion or object-store recreation is needed. Close all old app windows during updates.

## Extra appointments — version 1.4

Schedule → Add appointment books an individual student on a specific date and time, with a duration and optional label such as Make-up lesson. Available for weekly, fortnightly and flexible profiles. Extra appointments appear in a chronological dated section above the recurring timetable; past appointments are available in an expandable section. Open log loads the exact date, start and duration.

Automatic selection combines dated appointments with recurring lessons. An explicit booking at exactly the same student/date/time as a regular occurrence is selected once, using the booking duration. Overlaps are shown in the journal's automatic selection warning; they are not prohibited at booking time. Extra appointments do not cancel or reschedule recurring lessons.

Editing or removing an appointment only changes planning. Existing lesson records remain at their original date/time. Opening an appointment does not create a journal record until notes or duration are saved. Deleting a student removes their appointments as well as their lesson history; archiving excludes them from automatic selection while retaining the records.

All appointments are included in JSON backups and import previews. Data systems also offers Export appointments CSV. Schema 3 adds an appointments collection; schemas 1 and 2 remain importable. Use app 1.4 or later for new backups.

## Trial lessons — version 1.5

Schedule → Add trial lesson requires only name, date, start time and duration (default 45 minutes). Contact and remarks are optional. No student profile is created. Trial lessons participate in automatic next/current selection and have their own autosaving journal with the same text shortcuts. They appear above extra appointments in Schedule.

Trials move out of the upcoming section once their end time has passed, when the schedule is next rendered. Find them under Past trials / archive. Archive trial removes one from active scheduling immediately; Restore trial reverses this. No trial records are deleted automatically.

Convert to student opens the regular student form so you can choose weekly, fortnightly or flexible scheduling. One transaction creates the profile, transfers contact and remarks into student remarks, preserves trial notes at their original date/time/duration, adds the dated trial booking, then removes the standalone trial record. If notes are empty, only the booking is created, avoiding an invented completed lesson. A conversion error leaves the original trial intact. Existing notes are taken from the latest committed trial record. A second conversion of the same trial is rejected.

Trials are included in schema 4 JSON backups/import previews and a dedicated trial CSV export. Schemas 1–3 remain importable. The IndexedDB object store/version is retained. Only the application data schema changes.

See GITHUB-IPHONE.md for German GitHub Pages and iPhone setup instructions and the distinction between public program files and private local data.

## Audio patch 1.5.1

Waits for asynchronous AudioContext activation before playing. Touch-end and click gestures retry audio activation, including interrupted contexts after returning to the app. Test sound displays audio state and asset failures. iPhone Silent Mode is still respected; disable it and check media volume/Bluetooth if audio is active but inaudible. Device playback has not been tested in this development environment. No changes to database schema or license selection.


## Date / time patch 1.5.2
All application dates use YYYY-MM-DD. Time uses HH:mm (24-hour).
Date/time entry uses explicit text fields instead of locale-dependent native pickers.
Real calendar dates and 00:00–23:59 times are validated before use.
English UI, stored records, schema and existing backup compatibility are unchanged.
CSV lesson dates remain DD.MM.YYYY.


## Phone compact workspace — 1.5.3 (pending device acceptance)

On phones up to 600 CSS pixels wide, Drum Log runs within one viewport: LCARS header and navigation stay visible while the active content area uses the remaining height. Lists and long notes can still scroll **inside** their own panels. The lesson journal defaults to **Notes**; **History / details** switches to previous records, the record index or trial details without scrolling through an entire page. No information is deleted when switching panes.

**Data systems → Mobile display → Phone UI size** offers 65–100% density (default **80%**, 75% is another suggested choice). The setting is saved in the existing JSON backup/settings object and has no effect on tablet/desktop sizing. Text editing fields remain at least 16 CSS pixels to avoid iOS autofocus zoom. The value is optional when importing older backups; those use 80%. No database version change or migration is required.

The viewport-only layout is a **phone UI preference**, not an accessibility prohibition against scrolling: tall student lists, settings, long histories, very small landscape screens and the open iPhone keyboard may still require internal scrolling. Do not cut off access to any content to force a "no scrolling" claim. Desktop and tablet behavior is unchanged. Native Safari/PWA device verification is still required. Before replacing the published files, export and verify a JSON backup. Update the full asset folder at the same address including mobile.css; v9 precaches the new file. After update, fully close/reopen the app online, check OFFLINE READY, and confirm airplane-mode reopening works without clearing browser storage.


## Schedule planner 1.6.0: cancellations, replacements and availability

Schedule now offers **Day** and **Week** views. Colors: **red = trial lesson** (including converted trial-labeled appointments), LCARS peach = regular, violet = extra/replacement, muted salmon = cancellation, baby blue = verified available period.

- **Cancel** a specific student's occurrence once, giving a short reason (sick, cancelled, vacation, other). Only that exact student/date/start-time occurrence is suppressed from automatic future/current selection. The recurring weekly/biweekly rule, older lesson notes and other dates are unchanged. **Restore** reverses the cancellation, but refuses an occupied slot.
- **Replace** a student in one transaction: cancel A on this date and create a dated B replacement appointment with the source's duration. Existing appointments and trials are checked for collisions (including overlapping times and overnight lessons). Failed replacement attempts cannot leave a partial cancellation; transactional IndexedDB mutation rolls back.
- **Available** time windows are generated from configured daily teaching hours, subtracting regular, fortnightly, extra and trial bookings plus overnight spillover. A cancelled hour counts as free. Click **Book** to reserve a one-off make-up appointment; that action rechecks availability against the current committed database. Without defined teaching hours, **only explicitly cancelled slots** can be advertised as free, not arbitrary assumptions about working time.
- Set **Data systems → Teaching hours / availability** for each weekday. This is a local, personal schedule planner, not a calendar-sync or online availability API. Working windows are currently same-day only, without split shifts; normal appointments outside a configured window still appear, but that time is never shown available.
- The **Full records** disclosure retains the original trial archive, upcoming/past extra appointments, recurring roster and flexible students. The daily journal and records are unchanged.

### Backup and upgrade warning (important)
Version **1.6.0** raises the **application JSON data schema from 4 to 5** to preserve cancellations and teaching-hours settings. The IndexedDB object store/database version stays 1, and existing schema-1/2/3/4 records migrate additively on the next write. Old JSON backups remain importable. New backups contain a required \`cancellations\` collection and \`settings.teachingHours\`, and are **deliberately rejected by versions 1.5.x and older** rather than silently dropping the new appointment state.

**Before installing**, export a complete JSON backup and verify it exists somewhere outside the PWA. Deploy all files including \`schedule.js\` and \`schedule.css\` to the same HTTPS origin. Service-worker shell version **v10** updates program assets without clearing IndexedDB. Close/reopen the PWA online for the new cache; confirm OFFLINE READY, check a disposable cancellation and booking, test offline, then rely on real data. Never clear website data during an update.

**Known limits**: no public calendar sync; no automatic rescheduling of B's other weekly lesson; no whole-day holiday/closure editor; no split-shift teaching windows; no proof yet of actual iPhone Safari UI/keyboard/scroll behavior until user device testing.


## Rolling weeks and holiday breaks — version 1.7.0

**Rolling week navigator:** The Schedule **Week** view is now a seven-day window beginning on the selected day, not Monday by default. Select Wednesday, 21 October → see Wednesday through Tuesday; the Next/Previous buttons jump by exactly seven days to Wednesday, 28 October / Wednesday, 14 October. Date selection and the Today button keep this same anchor. Day view still advances one day at a time.

**Holiday breaks:** Open **Schedule → Holiday break** (or expand the Holiday breaks section in Schedule). Create and edit a label plus **From**/**To** dates, **inclusive**; each break is saved locally. You can create multiple periods and remove one independently. On closed dates:
- Regular weekly and every-two-weeks lessons are suppressed in the live planner and automatic upcoming/current lesson selection, without changing student profiles, cancellation records or historical journal notes. When a break ends or is removed, the recurring timetable resumes automatically.
- One-off extra appointments, make-up lessons, previously booked trials and trial-to-student appointments remain visible and selectable. **Book make-up** on the holiday banner opens an explicit appointment for that date, even though routine lessons are paused.
- A closed day is **not** advertised as a generally available/free teaching window merely because teaching hours exist. You choose individually when to teach in a break. Independently booked lessons still participate in time collision detection.
- The calendar banner indicates a school break and retains red trial-lesson highlighting. Break labels may overlap; overlapping ranges still mean regular lessons remain suspended until every covering period ends.

### Safe data updates
This release upgrades the **application JSON schema to v6** (from v5) with a \`holidays\` collection. It does **not** change IndexedDB database version 1, delete browser storage or rewrite lesson history. Existing backups from schemas 1–5 import with an empty holiday list. Version-6 backups include the periods and are intentionally rejected by old applications. Service-worker cache **v11** includes the updated JS/CSS.

**Before updating:** Export a complete JSON backup outside the browser/PWA, keep it available, then update all app files together at the existing HTTPS origin. Close and reopen the installed app online to load the new offline shell; confirm OFFLINE READY, then test a throwaway holiday and an explicit make-up appointment in airplane mode. Never clear browser data just to refresh the UI.

**Limits:** This is a manual, date-range teaching closure, not a German school-holiday importer, official holiday calendar, or automatic rescheduler. An entire break does not create make-up appointments or cancel already explicitly booked sessions. Existing overlapping appointments may need manual adjustment when a break is removed.


## LCARS schedule polish 1.7.1
Schedule action buttons now sit immediately **under the SCHEDULE heading**, with a coherent LCARS four-color segmented toolbar (two double segments on phones) and individually appropriate end-cap shapes. The generic grey feature-summary sentence is removed. The date selector uses hand-coded inline vector/SVG control graphics rather than Unicode/emoji arrows, with labelled previous/next controls and unchanged Day/Week/Today behavior.

Modal validation errors (including **"Holiday end date must be on or after the start date"**) appear **only in the dialog**. They vanish when you edit a form field, dismiss the warning, close or cancel the dialog, or after ten seconds. Errors outside a dialog are explicitly dismissible by clicking/tapping their banner or navigating to another view. These changes do not alter any student, holiday, booking or backup records.

Offline asset cache advances to **v12**, still the same schema-v6 local data. Before any upgrade keep an external JSON backup; close/reopen online to let the service worker cache the modified JS/CSS and test offline again.


## Make-up lesson credit balances and LCARS phone end caps — v1.8.0

- **Cancelled by** is explicit when cancelling a dated lesson, and when replacing student A with B: **Student cancelled** (default, no credit) or **Me / teacher** (+1 owed make-up lesson). This is independent of the reason (sick, cancelled, vacation, other).
- Only teacher-initiated cancellations add one make-up lesson credit to the **original student**. Each specific lesson can be cancelled only once. A replacement lesson for B never debits A's balance. Restoring a teacher-cancelled lesson removes one credit, stopping at zero if an intervening manual correction already cleared it. Restoring student-cancelled lessons has no effect.
- **Edit student → MAKE-UP LESSONS OWED** provides an integer input from 0 to 9999. A displayed zero is a valid balance. The count appears in Student records and the Lesson log. A regular cancellation automatically credits the balance only once; adding or booking an appointment does **not** automatically deduct a credit (booking is not proof of delivery). Adjust the count in Edit student when a makeup lesson has actually been completed.
- When editing an existing student, an unchanged credit field preserves the current stored count even if another open tab has since credited a teacher cancellation. An explicitly edited balance sets the new value on save.
- School-wide holiday breaks do not themselves create student-level cancellation credits.
- Updated in v1.8.1: the Schedule command strip now has exactly **three buttons in one horizontal row on all devices**: **Add appointment** (left outer cap rounded), **Add trial lesson** (both edges straight), **Holiday break** (right outer cap rounded). The redundant Add student action is no longer in Schedule; **Students → Add student** remains available.

### Data migration and backups
The app JSON format is now **schema 7**. Existing schema 1–6 local records and backups remain importable; student balances default to **0** where no count existed, and old cancellations without an origin are treated as **student/unknown** for accounting (never retroactively credited). Once saved in v1.8.0, JSON backups preserve explicit origin plus every balance. New schema-7 backups intentionally cannot be imported into old app versions, preventing them silently discarding credits. IndexedDB's database version remains unchanged; historical notes and existing lessons are not modified. Cache v13 updates the offline shell.

**Before installing:** Export an external JSON backup. Merge/ship all changed files together on the same HTTPS origin, reopen once online, confirm OFFLINE READY and test offline; never clear Safari/Firefox website data.


## Make-up credit booking semantics (v1.8.1)

**An explicitly booked Make-up lesson consumes one owed credit immediately.** In Schedule → Add appointment or Book an available slot, choose **LESSON TYPE → Make-up lesson**. The student must have at least one owed credit, otherwise the booking is rejected with a clear message (use **Extra lesson** for a booking that does not redeem credit, or correct the student's balance under Edit). Scheduling the lesson is considered fulfilling the outstanding obligation; this is the instructor's chosen accounting rule.

- Teacher cancels the booked make-up lesson: credit returns **+1**. Student cancels: credit is **forfeited**, no refund. Both cancellation types are already available in the existing Schedule cancellation dialog.
- Restoring a teacher cancellation removes that reissued credit again; restoring a student cancellation changes nothing.
- Changing the date/time of the same booked make-up lesson does not debit again. Changing the booked make-up into an extra lesson returns the credit; changing an extra into a make-up spends one. Moving the booking to a different student refunds one to the old student and consumes one from the new student, atomically.
- Deleting a still-active credited booking returns one credit. Deleting a teacher-cancelled booking does **not** add a second refund. Deleting a student-cancelled booking does **not** return their forfeited credit. Cancelled bookings must be restored before editing.
- The native appointment stores **\`redeemedCredit: true\`** to remember the precise booking for which the credit was already consumed. Existing schema-7 appointments that happen to have a free-text label \`Make-up lesson\` remain **unchanged and are not retroactively debited**. Booking or editing another lesson cannot silently settle old unknown entries.
- Backup format moves **v7 → v8**, without wiping the existing IndexedDB database. Old v1–v7 backups can still be imported. New v8 backups cannot be read by releases before 1.8.1. Offline app-shell cache v14.

This deliberately supersedes the v1.8.0 manual-after-completion assumption in the earlier documentation. **Before updating, export an external JSON backup**, then reopen the app online so the service worker can cache updated files; confirm OFFLINE READY, then test in airplane mode. Never clear browser website data.


## Standalone recording, jam and other calendar events — v1.9.0

**Schedule → Add appointment → Recording / Jam / Other (no student)** opens a separate event editor. You can also expand **Other events · Recording / Jam / More** in Schedule to add or edit an event, even with no student profiles in the database. Each event has a **title**, type (**Recording session**, **Jam / Making music together**, or **Other event**), date, 24-hour start time, duration in minutes, and optional people/band and notes. Records can be edited, moved or deleted.

These events have unique identifiers independent of their text: **the same person or identical session title may appear on any number of different dates**. They are never trials or student lessons, cannot be converted into students, and never change make-up credit balances or student lesson logs. Existing trial functionality stays intact: trial record names are not used as IDs, but trials are meant for potential students rather than ordinary music sessions.

Calendar entries display as **cyan LCARS blocks** in the Day and rolling Week schedule and remain visible during holiday breaks. Their occupied time reduces free availability. New events and student appointments are checked for conflicts with an already booked recording/jam (including events crossing midnight); saving a conflict is rejected without modifying student balances or previous records. The **Other events** section lists upcoming and past entries for editing.

**Database schema 9** adds an independent \`calendarEvents[]\` collection. Existing schema 1–8 backups import safely with an empty collection, while new backups contain every event, attendee description and note. IndexedDB's internal version remains 1. Old application releases cannot import new schema-9 backups. App v1.9.0 updates the offline cache to **v15**.

Before upgrading, store a full external JSON backup. Reopen once online after publishing, verify the Schedule editor and backup export/import, and test offline on iPhone/iPad without clearing browser data. General events are single-date appointments, not recurring bookings or notification alerts.


## v1.10.0 — edit one scheduled lesson without changing the weekly schedule
Schedule → a **regular weekly or fortnightly lesson** → **Edit lesson** edits its date, start time or duration **only for the chosen occurrence**. For a spontaneous double lesson set **90 minutes**, for example. The following weeks retain their original 45-minute duration. Explicit extra / make-up appointments already have their own Edit appointment workflow, which remains unchanged.

Each one-off change is stored as a distinct **lessonOverrides[]** entry keyed by **student ID + original date + original time**, recording the new date, start and duration. The old weekly slot is *suppressed rather than cancelled*, and the new slot is displayed exactly once in the Schedule (Day and Week) and automatic journal selection. A changed lesson can later be edited again. **Reset to regular schedule** removes the one-time adjustment if the original slot is still free. Reset and edit are blocked while that adjusted booking is cancelled; first restore it.

All target slots are checked for conflicts with lessons, trials, recording/jam events and other overrides, including bookings crossing midnight. Conflict rejection leaves original data untouched. **Edits, moves and resets do not create cancellations, appointments or make-up credit changes.** A separately initiated genuine cancellation of an adjusted lesson follows the usual teacher/student credit policy.

Existing journal notes are **left intact at their original record date and time**, rather than moved or overwritten. Opening the moved occurrence in Lesson log reads/writes that original note record, with a label explaining the link. This preserves historical note IDs and data; the history index retains the original record date/time.

Backups now use **schema 10**; old schema 1–9 JSON backups migrate with an empty overrides collection, and original student history, trials, appointments, holidays, external events and credit balances are retained. New schema-10 backups cannot be imported into older app releases. IndexedDB internal version remains unchanged; the offline cache bumps to **v16**.

**Upgrade:** Keep an external JSON backup before merging, reload online once for PWA cache v16, and verify 45→90→reset on a real phone. Never clear browser data.


## v1.10.1 — automatic notice dismissal

**All ordinary status/info banners** generated through the shared \`notice()\` function (persistent-storage outcome, backup exported/download started, backup reminder, teaching hours saved, cross-tab notification and nonblocking planner hints) now clear automatically after **8.5 seconds**. Tap/click the displayed banner or focus it and press Enter, Space or Escape to dismiss immediately. Replacing a notice cancels its prior timeout so no stale callback dismisses a newer message. Opening an editing modal or switching sections clears the old banner too.

**Critical data-safety errors** (especially unsaved lesson or trial notes, storage transaction failures and import failures) remain on their independent \`#error\` channel and require explicit acknowledgement; inline modal validation errors retain their existing 10-second fallback. Permanent operation/status fields such as "OFFLINE READY", persistence info and save status are not transient notifications and remain displayed.

App version **1.10.1** uses PWA shell cache **v17**. No database or backup schema changes. Existing IndexedDB data is untouched. Reload once online after merge so the updated offline JavaScript is cached; never clear browser website data.
