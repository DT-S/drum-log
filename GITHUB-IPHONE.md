# Drum Log auf GitHub Pages und dem iPhone

## Was ist öffentlich, was bleibt privat?

GitHub Pages stellt die Programmdateien öffentlich bereit. Bei GitHub Free nutzt du dafür ein öffentliches Repository. Ein unbekannter Link ist kein Zugriffsschutz.

Drum Log speichert Schüler, Probestunden, Kontakte, Termine und Notizen ausschließlich in der lokalen IndexedDB des jeweiligen Browsers. Die App enthält keine Funktion, die diese Daten auf GitHub hochlädt. Andere Besucher bekommen auf ihrem Gerät ihre eigene, anfangs leere Datenbank. Die ZIP enthält nur Programmdateien und künstliche Testdaten in den Entwicklertests, keine deiner Schülerdaten.

Keine pauschale 100-Prozent-Sicherheitsgarantie: Die Daten sind lokal unverschlüsselt; wer Zugriff auf dein entsperrtes Gerät/Browserprofil hat, kann sie sehen. Schütze dein Gerät und dein GitHub-Konto. Spiele nur vertrauenswürdigen Programmcode ein. Browserdaten sind nach Herkunftsadresse getrennt, nicht nach GitHub-Repository; andere Programme unter derselben Herkunftsadresse sind keine unabhängige Sicherheitsgrenze.

Lade ausschließlich die Programmdateien hoch. **JSON-Backups und CSV-Exporte gehören niemals ins Repository.** Die mitgelieferte .gitignore hilft beim lokalen Git-Workflow, schützt aber nicht vor einem manuellen Datei-Upload im GitHub-Webinterface.

## GitHub Pages einrichten

1. Exportiere zunächst deine vorhandenen Daten als JSON. Bewahre das Backup außerhalb des App-Ordners auf.
2. Entpacke Drum-Log-LCARS.zip.
3. Erstelle auf GitHub ein öffentliches Repository, beispielsweise `drum-log`.
4. Lade über **Add file → Upload files** den Inhalt des entpackten Ordners `drum-log` hoch. Wichtig: `index.html` muss direkt im Repository liegen, nicht noch eine Ordnerebene tiefer. Die Unterordner `fonts` und `sounds` müssen samt Inhalt mitkommen. Lade nicht bloß die ZIP hoch.
5. Speichere den Upload mit **Commit changes**.
6. Öffne **Settings → Pages**. Wähle unter **Build and deployment** die Quelle **Deploy from a branch**, dann **main** und **/(root)**. Speichern.
7. Warte auf die Veröffentlichung. Unter Pages erscheint **Visit site** mit der tatsächlichen HTTPS-Adresse. Das kann einige Minuten dauern.
8. Öffne diese Adresse. Kontrolliere **OFFLINE READY** in der Fußzeile. Die App muss zunächst leer sein. Das ist normal: localhost und GitHub Pages haben unterschiedliche Browserdaten.

Die Datei `.nojekyll` ist enthalten, damit GitHub die statischen Dateien unverändert bereitstellt. Falls dein Datei-Upload versteckte Dateien auslässt, kannst du sie im GitHub-Webinterface als leere Datei hinzufügen. Kein npm, Build, Python-Server oder Backend ist für GitHub Pages nötig.

## Auf dem iPhone installieren

1. Öffne die veröffentlichte HTTPS-Adresse in Safari.
2. Wähle **Teilen → Zum Home-Bildschirm**. Falls angeboten, **Als Web-App öffnen** aktivieren.
3. Starte Drum Log über das neue Home-Bildschirm-Icon, zunächst mit Internet.
4. Warte auf **OFFLINE READY**. Tippe einmal auf ein Bedienelement, um Audio zu aktivieren.
5. Öffne **Data systems → Import backup** und importiere dein JSON-Backup aus der Dateien-App. Prüfe die Vorschau und bestätige bewusst die Ersetzung. Importiere die echten Daten in der installierten App, da Safari und die installierte App getrennte Speicher haben können.
6. Schalte den Flugmodus ein, schließe Drum Log vollständig und starte es erneut. Prüfe Ansicht und Speicherung einer Testnotiz. Erst dann verlasse dich im Unterricht auf den Offline-Betrieb.

PC und iPhone synchronisieren sich nicht automatisch. Ein Import ersetzt den gesamten Datenbestand auf dem Zielgerät. Wenn du auf beiden Geräten unabhängig Änderungen machst, werden sie nicht zusammengeführt.

## Updates

Backup erstellen, Programmdateien im Repository aktualisieren, Veröffentlichung abwarten. Alle Drum-Log-Fenster schließen und die App online neu öffnen. Falls zunächst die alte Oberfläche erscheint, nach dem Download des Updates noch einmal vollständig schließen und öffnen. Website-Daten nicht löschen; darin liegen deine Unterrichtsdaten.

Die einmalige Installation macht die App offlinefähig; neue Programmversionen und neu hinzugefügte Dateien benötigen erneut eine Online-Verbindung.

## App weitergeben

Du kannst anderen die veröffentlichte App-Adresse nennen. Sie nutzen auf ihren Geräten ihren eigenen Datenbestand. Teile die Programmdateien oder die App-Adresse, nicht deinen persönlichen JSON-Export.

## Offizielle GitHub-Anleitungen

- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
