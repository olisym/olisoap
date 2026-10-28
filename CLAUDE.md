# olisoap – Projektkontext für Claude

Persönliche Werkstatt-App für DIY-Heimkosmetik (zuerst Seife, später Cremes, Balsame, Tinkturen, Deo, Bartwachs).
Ein Nutzer, Hobby-Seifensieder mit über 10 Jahren Erfahrung im Kaltverfahren, Nerd, kein ausgebildeter Entwickler.
Kommunikation auf **Deutsch**, Code-Kommentare und UI-Texte auf Deutsch.

## Leitlinien (vom Nutzer ausdrücklich gewünscht)

- **Evidenzbasiert, ohne Nonsens.** Keine Marketing-Behauptungen („natürliches Silikon“, „zellregenerierend“). Jede Zutat
  braucht einen Grund. Behauptungen zu Wirkstoffen immer mit Evidenz-Einordnung. Prüfungen von Rezepten heißen **„Gegenprobe“**.
- Empfindliche Haut, **hartes Wasser** (ca. 12–17 °dH), lange feine Haare (Haarseife + saure Rinse mit Zitronensäure),
  Rasur mit Pinsel. Duft nur über ätherische Öle, keine Farben.
- **So wenig wie möglich von Hand eintragen.** Lieber importieren, ableiten, vorschlagen.
- **Kein „für wen“** an Chargen oder Etiketten.
- UI: Übersicht nach Anliegen (Sieden, Rezepte, Vorrat, Einkauf, Entwickeln), dunkles Instrumententafel-Design, ernsthaft,
  Normen beachten (Touch-Ziele ≥ 44 px, WCAG AA, Material 3 / Apple HIG). Kurze Texte statt Erklärwüste.
- Schnell iterieren, erst Breite, dann Tiefe. „Entwickeln“ (Optimierer) bewusst zurückgestellt.

## Technik

- React 19 + TypeScript + Vite + Tailwind v4, PWA (vite-plugin-pwa), Dexie (IndexedDB), lucide-react, Vitest.
- `src/core/`: Rechenkern als reine Funktionen mit Tests. **Der Kern muss immer stimmen**, alle Werkzeuge bauen darauf auf.
  - `calc.ts` Verseifung (NaOH, KOH, Mischlauge), Wasser (Konzentration / % Fett / Verhältnis, Wasser aus Zusätzen wird
    abgezogen), Säuren verbrauchen Lauge, Kennzahlen nach SoapCalc-Konvention (Heuristik, so kennzeichnen)
  - `correction.ts` Ist-Einwaage → nachgeben, `evaluate.ts` Prüfregeln/Zielprofile, `inventory.ts` Artikel/Gebinde/Preise,
    `cost.ts`, `batch.ts` Chargen/Verbrauch/Reifung, `tasks.ts` „Heute zu tun“, `label.ts` Zutatenliste/INCI,
    `shopping.ts` Einkaufsplanung, `weights.ts` Gewichte aus Diktat
- `src/data/`: Fette (Verseifungszahl in mg KOH/g, Fettsäuren, Jodzahl, INCI), Zusätze inkl. ätherische Öle, Zielprofile,
  Vorlagen (Grundseifen Körper/Haar/Rasur je mit Spar-Variante).
- `src/import/`: Salandia-Bestellübersicht und Salandia-Katalog (automatische Erkennung).
- `src/sync/` + `public/api/index.php`: Ende-zu-Ende-verschlüsselter Sync (PBKDF2 → AES-256-GCM im Browser, Server speichert
  nur Chiffretext, Abgleich über Hashes, lokale Fassung gewinnt bei Konflikten).
- Rezepte: Grundseife + Varianten (`baseId`). Chargen speichern eine Kopie des Rezepts und festgeschriebene Kosten.

## Betrieb

- Repo `olisym/olisoap` (öffentlich – **keine persönlichen Daten, Zugangsdaten oder gescrapten Kataloge committen**).
- Push auf `main` → GitHub Actions: Tests, Build, GitHub Pages (`/olisoap/`) **und** Branch `deploy` (Basis `/`).
- Produktiv: `https://olisoap.error13.de`, Netcup Webhosting 1000, Plesk Git-Bereitstellung zieht `deploy` nach `httpdocs`.
  PHP 8.5, MySQL mit Tabellenpräfix `olisoap_`. `open_basedir` = `{DOCROOT}` → Konfiguration liegt in
  `httpdocs/olisoap-config.php` (nicht im Repo). Diagnose: `api/index.php?a=health`.
- Keine `.htaccess` mit `Require`/`RewriteRule` im `api`-Ordner (führte zu HTTP 500).
- Service Worker darf `/api/` nicht auf `index.html` umleiten (`navigateFallbackDenylist`).

## Arbeitsweise

- Nach Änderungen: `npm test`, `npm run build`, `npx oxlint`; UI-Änderungen mit Playwright im Browser prüfen.
- Commits auf Deutsch, aussagekräftig. Direkt auf `main` (Ein-Personen-Projekt).

## Offene Themen (Stand v0.7)

- Cremes/Emulsionen-Kern (Aftershave-Balsam als erstes Produkt), dann wasserfreie Produkte (Balsam, Bartwachs, Massageöl,
  Deo), Tinkturen (Myrrhe, Weihrauch). Haltbarkeit fertiger Produkte, „Retten“ ablaufender Zutaten.
- Rezepte: Olivenöl, Sonnenblumenöl HO, Stearinsäure und Kaolin gibt es nicht bei Salandia → Artikel manuell oder Rezepte anpassen.
- Ätherische Öle: Dosierung, Allergene (Deklaration ab 0,01 % in Rinse-off).
- Reste-Optimierer („Entwickeln“), Mindestbestände, Barcode.
