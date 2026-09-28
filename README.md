# Abitur-Notenrechner

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

## Dateien

- `index.html` – Struktur/Formular
- `style.css` – Design (inkl. Dark Mode)
- `script.js` – Berechnungslogik
