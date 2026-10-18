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
