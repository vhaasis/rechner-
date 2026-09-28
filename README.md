# Aktien-News

Aktie oder Ticker eingeben (z. B. „Tesla“, „SAP“, „NVDA“) und die wichtigsten aktuellen
Nachrichten dazu sehen – Meldungen von Top-Medien zuerst.

Live: https://vhaasis.github.io/rechner-/

## Nutzung

`index.html` im Browser öffnen oder die GitHub-Pages-Seite aufrufen. Kein Build-Prozess,
kein Backend. Suchen lassen sich per Link teilen, z. B. `?q=SAP&zeit=1w`.

## Funktionsweise

- **Gelistete Aktien** (rund 75 US- und DAX-Werte in `stocks.js`): Der Workflow
  `.github/workflows/update-news.yml` holt alle 2 Stunden die Google-News-Schlagzeilen
  (deutsch + englisch, letzte 30 Tage) mit `scripts/fetch-news.mjs` und legt sie als
  `<TICKER>.json` auf den Branch `news-data`. Die Seite lädt diese Datei über
  raw.githubusercontent.com – ohne Rate-Limit und ohne API-Schlüssel.
  Zeitraum, Sortierung und Quellenfilter laufen danach lokal im Browser.
- **Andere Firmen**: Live-Suche über die
  [GDELT DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/). GDELT erlaubt
  nur eine Anfrage alle 5 Sekunden pro IP; die Seite hält diesen Abstand ein und wiederholt
  abgewiesene Anfragen einmal. In geteilten Netzen (Uni-WLAN, iCloud Private Relay) kann GDELT
  trotzdem blockieren.
- Doppelte Meldungen (syndizierte Artikel) werden zusammengefasst, Ergebnisse 10 Minuten im
  Browser zwischengespeichert.
- Der Zeitplan (`schedule`) läuft bei GitHub nur für Workflows auf dem Standard-Branch (`main`).
  Neue Aktien: Eintrag in `stocks.js` ergänzen.

Keine Anlageberatung – reine Nachrichten-Recherche.

## Dateien

- `index.html` – Struktur
- `style.css` – Design (Hell/Dunkel)
- `stocks.js` – Aktienliste (Ticker, Name, Suchbegriffe), genutzt von Website und Workflow
- `script.js` – Datenabruf, Filter, Rendering
- `scripts/fetch-news.mjs` – News-Abruf für den Workflow
- `fonts/` – selbst gehostete Schriften (Newsreader, IBM Plex Sans/Mono; SIL Open Font License),
  damit keine Verbindung zu Google Fonts nötig ist
