# olisoap

Werkstatt-Software für Heimseifensieder: Rezepte entwerfen und berechnen, Arbeitsblätter drucken, Einwaagen korrigieren.
Später kommen Lager, Kosten, Chargen und ein Reste-Optimierer dazu. Leitlinie: **evidenzbasiert, ohne Nonsens.**
Jede Zutat braucht einen Grund.

## Stand (v0.1)

- **Laugenrechner** (NaOH/KOH, Reinheit, Überfettung, drei Wassermodi), Säuren wie Zitronensäure werden automatisch verrechnet
- **Kennzahlen** (Härte, Reinigung, Pflege, Schaum, Jodzahl, INS, Linol-/Linolensäure) mit **Zielprofilen**
- **Zusätze** mit Zweck, Evidenz-Einordnung und eigener Begründung
- **Arbeitsblatt** zum Drucken mit Phasen und Chargenprotokoll
- **Korrekturrechner**: zu viel Fett oder Lauge eingewogen → was nachgeben?
- **Sicherung** als JSON-Export und -Import (Daten liegen lokal im Browser)
- Installierbar als **PWA**, funktioniert offline

## Aufbau

```
src/core/     Rechenkern: reine Funktionen, ohne UI, mit Tests (calc, correction, evaluate)
src/data/     Fett-, Zusatz- und Profildaten
src/pages/    Oberfläche (React)
src/db.ts     Lokale Datenbank (IndexedDB über Dexie)
```

Alle Werkzeuge (Korrektur, Profilprüfung, künftig der Optimierer) rechnen über dieselben Kernfunktionen.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Tests des Rechenkerns
npm run build    # Produktionsbuild nach dist/
```

Ein Push auf `main` testet, baut und veröffentlicht automatisch auf GitHub Pages.
