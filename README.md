# Aktien-News-Finder

Ein einfacher, clientseitiger Web-Tool ohne Build-Prozess und ohne Backend: Aktie
oder Ticker eingeben (z. B. „Apple“, „AAPL“, „SAP“) und die aktuell wichtigsten
News dazu sehen. Alles läuft komplett im Browser; es werden keine Nutzerdaten an
einen eigenen Server übertragen oder gespeichert.

## Nutzung

Einfach `index.html` in einem Browser öffnen – es ist kein Build-Prozess und
keine Installation nötig.

## Funktionsweise

Die Suche läuft direkt im Browser gegen die kostenlose, öffentliche
[GDELT DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) –
ganz ohne eigenen Server und ohne API-Schlüssel.

- Eingabefeld mit Autovervollständigung für gängige Ticker (US-Standardwerte + DAX)
- Schnellauswahl-Chips für beliebte Aktien
- Zeitraum-Filter (24 Std. bis 3 Monate)
- Optionaler Filter „nur seriöse Wirtschaftsmedien“ (Reuters, Bloomberg, Handelsblatt, …),
  fällt automatisch auf alle Quellen zurück, falls dort nichts gefunden wird
- Ergebnisliste mit Titel, Quelle, Datum und Link zum Originalartikel

Keine Anlageberatung – reine Nachrichten-Recherche.

## Dateien

- `index.html` – Struktur/Formular
- `style.css` – Design (inkl. Dark Mode)
- `script.js` – Ticker-Mapping, GDELT-Abfrage und Rendering
