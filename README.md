# olisoap

Werkstatt-Software für Heimseifensieder: Rezepte entwerfen und berechnen, Arbeitsblätter drucken, Einwaagen korrigieren.
Später kommen Lager, Kosten, Chargen und ein Reste-Optimierer dazu. Leitlinie: **evidenzbasiert, ohne Nonsens.**
Jede Zutat braucht einen Grund.

## Stand (v0.7)

- **Übersicht** nach Anliegen: Sieden, Rezepte, Vorrat, Einkauf, Entwickeln, dazu Reifeprozess, Hinweise und „Was kann ich sieden?“
- **Geführtes Sieden**: Rezept wählen, Menge oder Stückzahl, Vorrats-Check, Siede-Modus mit großen Zahlen,
  Abhaken und Live-Korrektur bei Ist-Abweichungen, Charge anlegen
- **Einkauf**: Bedarf aus geplanten Suden, günstigste aktuelle Packung, Einkaufsliste mit Shop-Links,
  „bestellt“ und Wareneingang direkt ins Lager
- **Chargen-Etappen**: Gesiedet → Ausgeformt & geschnitten (Stückzahl, Gesamtgewicht) → Gereift → Geprüft → Etikettiert,
  fällige Etappen erscheinen unter „Heute zu tun“
- **Etiketten** aus der Charge: A4-Bogen 3 × 8 (70 × 37 mm), Zutaten deutsch oder als INCI, Haltbarkeitsvorschlag
- **Salandia-Katalog-Import**: aktuelle Shop-Preise für alle Artikel, Bestellübersicht und Katalog werden automatisch erkannt
- **Vorrat** als Übersicht mit Füllstand, MHD und Nachbestellen per Klick
- Dunkles Instrumententafel-Design (helles wählbar), Navigationsleiste bzw. untere Leiste auf dem Handy,
  Touch-Ziele ab 44 px
- **Grundseifen und Varianten**: Körper-, Haar- und Rasierseife als Grundseifen, Varianten zeigen ihre Unterschiede zur Grundseife
- **Laugenrechner** (NaOH, KOH oder Mischlauge, Reinheit, Überfettung, drei Wassermodi), Säuren wie Zitronensäure werden
  automatisch verrechnet, Wasser aus flüssigen Zusätzen wird vom Gesamtwasser abgezogen
- **Kennzahlen** (Härte, Reinigung, Pflege, Schaum, Jodzahl, INS, Linol-/Linolensäure) mit **Zielprofilen**
- **Zusätze** mit Zweck, Evidenz-Einordnung und eigener Begründung
- **Arbeitsblatt** zum Drucken mit Phasen und Chargenprotokoll
- **Korrekturrechner**: zu viel Fett oder Lauge eingewogen → was nachgeben?
- **Lager**: Artikel mit Preishistorie, Gebinde mit Restmenge und MHD, Import der Salandia-Bestellübersicht
- **Kosten** pro Rezept und pro Stück
- **Chargen**: Sieden aus dem Rezept mit Lagerabbuchung (zuerst, was zuerst abläuft), festgeschriebene Kosten,
  Reifekontrolle über Gewichtsverlust, Restbestand und Abgänge, frühestes MHD der verwendeten Fette
- **Hinweise** auf der Startseite: reife Chargen, fällige Wägungen, ablaufende Gebinde
- **Sync** zwischen Geräten über eine kleine PHP-API, **Ende-zu-Ende-verschlüsselt** (AES-256-GCM, Schlüssel per PBKDF2 aus der
  Passphrase); der Server speichert nur Chiffretext
- **Etiketten-Editor**: Logo, Texte, Zutaten deutsch/INCI/keine, Banderole oder Aufkleber
- **Sicherung** als JSON-Export und -Import
- Installierbar als **PWA**, funktioniert offline

## Aufbau

```
src/core/     Rechenkern: reine Funktionen, ohne UI, mit Tests (calc, correction, evaluate, inventory, cost, batch)
src/data/     Fett-, Zusatz- und Profildaten
src/pages/    Oberfläche (React)
src/import/   Importe (Salandia)
src/sync/     Verschlüsselung und Abgleich
src/db.ts     Lokale Datenbank (IndexedDB über Dexie)
public/api/   Sync-API (PHP, MySQL/MariaDB oder SQLite)
docs/         Vorlage für die Server-Konfiguration
```

## Betrieb auf eigenem Webspace

Ein Push auf `main` baut die App zusätzlich mit Basis `/` und legt das Ergebnis in den Branch `deploy`.
Plesk zieht diesen Branch per Git-Bereitstellung nach `httpdocs`. Die Datenbank-Zugangsdaten stehen in
`olisoap-config.php` (Vorlage: `docs/olisoap-config.sample.php`), nie im Repository. Gesucht wird eine Ebene über
`httpdocs`, in `httpdocs` und in `httpdocs/api`; mit dem Plesk-Standard für `open_basedir` funktioniert nur `httpdocs`.
Diagnose: `api/index.php?a=health`.

Alle Werkzeuge (Korrektur, Profilprüfung, künftig der Optimierer) rechnen über dieselben Kernfunktionen.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Tests des Rechenkerns
npm run build    # Produktionsbuild nach dist/
```

Ein Push auf `main` testet, baut und veröffentlicht automatisch auf GitHub Pages.
