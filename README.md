# Aktien-News

Aktie oder Ticker eingeben (z. B. „Tesla“, „SAP“, „NVDA“) und die wichtigsten aktuellen
Nachrichten dazu sehen – Meldungen von Top-Medien zuerst.

Live: https://vhaasis.github.io/rechner-/

## Nutzung

`index.html` im Browser öffnen oder die GitHub-Pages-Seite aufrufen. Kein Build-Prozess,
kein Backend. Suchen lassen sich per Link teilen, z. B. `?q=SAP&zeit=1w`.

## Funktionsweise

- Die Suche läuft direkt im Browser gegen die kostenlose
  [GDELT DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) – ohne API-Schlüssel.
- Pro Suche genau **eine** API-Anfrage (bis zu 100 Artikel, nach Relevanz sortiert).
  Sortierung („Wichtigste“/„Neueste“) und Quellenfilter („Nur Top-Medien“) laufen lokal.
- GDELT erlaubt nur eine Anfrage alle 5 Sekunden. Alle Abrufe laufen deshalb über eine
  Warteschlange mit Mindestabstand; abgewiesene Anfragen werden einmal automatisch wiederholt.
  Ergebnisse werden 10 Minuten im Browser zwischengespeichert.
- Ticker-Symbole gängiger US- und DAX-Werte werden auf Firmennamen abgebildet, weil GDELT
  Volltext durchsucht. Doppelte Meldungen (syndizierte Artikel) werden zusammengefasst.

Keine Anlageberatung – reine Nachrichten-Recherche.

## Dateien

- `index.html` – Struktur
- `style.css` – Design (Hell/Dunkel)
- `script.js` – Ticker-Zuordnung, GDELT-Abfrage, Rendering
- `fonts/` – selbst gehostete Schriften (Newsreader, IBM Plex Sans/Mono; SIL Open Font License),
  damit keine Verbindung zu Google Fonts nötig ist
