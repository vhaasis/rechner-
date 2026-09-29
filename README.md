# Aktien-News

Startseite **NEWS Heute** mit den wichtigsten Wirtschaftsnachrichten des Tages (Deutschland und
international). Außerdem: Aktie oder Ticker eingeben (z. B. „Tesla“, „SAP“, „NVDA“) und die
wichtigsten aktuellen Nachrichten dazu sehen – Meldungen von Top-Medien zuerst.

Live: https://vhaasis.github.io/rechner-/

## Nutzung

`index.html` im Browser öffnen oder die GitHub-Pages-Seite aufrufen. Kein Build-Prozess,
kein Backend. Suchen lassen sich per Link teilen, z. B. `?q=SAP&zeit=1w`.

## Funktionsweise

- **NEWS Heute**: Der Workflow `.github/workflows/update-news.yml` holt stündlich die
  Google-News-Rubrik „Wirtschaft“ (deutsch + englisch) als `heute.json`. Die Startseite zeigt die
  Meldungen der letzten 24 Stunden (bei wenigen Meldungen 48 Stunden).
- **Gelistete Werte** (rund 90 Aktien, ETFs und Kryptowährungen in `stocks.js`): Derselbe Workflow holt die
  Google-News-Schlagzeilen
  (deutsch + englisch, letzte 30 Tage) mit `scripts/fetch-news.mjs` und legt sie als
  `<TICKER>.json` auf den Branch `news-data`. Die Seite lädt diese Datei über
  raw.githubusercontent.com – ohne Rate-Limit und ohne API-Schlüssel.
  Zeitraum, Sortierung und Quellenfilter laufen danach lokal im Browser.
- **Kurse**: `scripts/fetch-quotes.mjs` holt Kurs und Vortagesschlusskurs bei Yahoo Finance
  (inoffizielle Chart-Schnittstelle) und legt sie als `quotes.json` ab – alle 15 Minuten an
  Werktagen. Die Zuordnung Ticker → Yahoo-Symbol steht in `stocks.js` (`QUOTE_SYMBOLS`). Deutsche
  Werte und ETFs erscheinen in Euro (Xetra), US-Werte in Dollar, Krypto in Euro. Die Tagesveränderung
  ist Kurs minus Vortagesschluss. Schlägt ein Abruf fehl, bleibt der letzte Kurs bis 24 Stunden stehen.
- **Andere Firmen**: Live-Suche über die
  [GDELT DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/). GDELT erlaubt
  nur eine Anfrage alle 5 Sekunden pro IP; die Seite hält diesen Abstand ein und wiederholt
  abgewiesene Anfragen einmal. In geteilten Netzen (Uni-WLAN, iCloud Private Relay) kann GDELT
  trotzdem blockieren.
- Doppelte Meldungen (syndizierte Artikel) werden zusammengefasst, Ergebnisse 10 Minuten im
  Browser zwischengespeichert.
- Der Zeitplan (`schedule`) läuft bei GitHub nur für Workflows auf dem Standard-Branch (`main`).
  Neue Werte: Eintrag in `stocks.js` ergänzen (optional als `"etf"` oder `"crypto"` markieren).

Keine Anlageberatung – reine Nachrichten-Recherche.

## Dateien

- `index.html` – Struktur
- `style.css` – Design (Hell/Dunkel)
- `stocks.js` – Aktienliste (Ticker, Name, Suchbegriffe), genutzt von Website und Workflow
- `script.js` – Datenabruf, Filter, Rendering
- `scripts/fetch-news.mjs` – News-Abruf für den Workflow
- `scripts/fetch-quotes.mjs` – Kurs-Abruf für den Workflow
- `fonts/` – selbst gehostete Schriften (Newsreader, IBM Plex Sans/Mono; SIL Open Font License),
  damit keine Verbindung zu Google Fonts nötig ist
