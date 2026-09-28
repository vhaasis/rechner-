# Rechner & Tools

Kleine, clientseitige Web-Tools ohne Build-Prozess und ohne Backend. Jedes Tool
läuft komplett im Browser; es werden keine Nutzerdaten an einen eigenen Server
übertragen oder gespeichert.

## Abitur-Notenrechner (`index.html`)

Ein einfacher, clientseitiger Notenrechner für das deutsche Abitur. Er berechnet die
Gesamtqualifikation aus **Block I** (Kursphase Q1–Q4) und **Block II** (Abiturprüfung)
sowie die daraus resultierende Abiturdurchschnittsnote – nach dem bundesweit
einheitlichen Punkteschema der Kultusministerkonferenz (KMK).

## Nutzung

Einfach `index.html` in einem Browser öffnen – es ist kein Build-Prozess und
keine Installation nötig. Alle Berechnungen laufen lokal im Browser, es werden
keine Daten übertragen oder gespeichert.

## Berechnungslogik

- **Block I** (max. 600 Punkte): Punktsumme der eingebrachten Kurse (üblicherweise
  32–40), normiert auf `Punktsumme × 40 / Anzahl Kurse`.
- **Block II** (max. 300 Punkte): Punktsumme der Prüfungsfächer (4 oder 5), jeweils
  gewichtet mit Faktor ×5 (bei 4 Fächern) bzw. ×4 (bei 5 Fächern).
- **Gesamtpunktzahl**: Block I + Block II, im Bereich 300–900 Punkte.
- **Durchschnittsnote**: `5,5 − Gesamtpunktzahl / 200`, in 0,1-Schritten von 1,0
  (900 Punkte) bis 4,0 (300 Punkte).

Die genauen Zulassungs- und Bestehensregeln unterscheiden sich je nach Bundesland
(z. B. Anzahl erlaubter Unterkurse, Mindestkurse auf erhöhtem Niveau). Der Rechner
zeigt vereinfachte, bundesweit gültige Mindestanforderungen als Orientierung an,
ersetzt aber keine verbindliche Beratung durch die Schule.

### Dateien

- `index.html` – Struktur/Formular
- `style.css` – gemeinsames Design (inkl. Dark Mode) für alle Tools
- `script.js` – Berechnungslogik

## Aktien-News-Finder (`aktien-news.html`)

Aktie oder Ticker eingeben (z. B. „Apple“, „AAPL“, „SAP“) und die aktuell wichtigsten
News dazu sehen. Die Suche läuft direkt im Browser gegen die kostenlose, öffentliche
[GDELT DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) – ganz
ohne eigenen Server und ohne API-Schlüssel.

- Eingabefeld mit Autovervollständigung für gängige Ticker (US-Standardwerte + DAX)
- Schnellauswahl-Chips für beliebte Aktien
- Zeitraum-Filter (24 Std. bis 3 Monate)
- Optionaler Filter „nur seriöse Wirtschaftsmedien“ (Reuters, Bloomberg, Handelsblatt, …),
  fällt automatisch auf alle Quellen zurück, falls dort nichts gefunden wird
- Ergebnisliste mit Titel, Quelle, Datum und Link zum Originalartikel

Keine Anlageberatung – reine Nachrichten-Recherche.

### Dateien

- `aktien-news.html` – Struktur/Formular
- `aktien-news.css` – seitenspezifisches Design (nutzt die Farbvariablen aus `style.css`)
- `aktien-news.js` – Ticker-Mapping, GDELT-Abfrage und Rendering
