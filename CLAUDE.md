# olisoap – Projektkontext für Claude

Persönliche Werkstatt-App für DIY-Heimkosmetik (zuerst Seife, später Cremes, Balsame, Tinkturen, Deo, Bartwachs).
Ein Nutzer, Hobby-Seifensieder mit über 10 Jahren Erfahrung im Kaltverfahren, Nerd, kein ausgebildeter Entwickler.
Kommunikation auf **Deutsch**, Code-Kommentare und UI-Texte auf Deutsch. Antworten knapp halten.

**Hintergrund, Entscheidungen, Lehren und Fahrplan: `docs/ENTSCHEIDUNGEN.md` – zu Beginn einer Sitzung lesen.**

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
    `shopping.ts` Einkaufsplanung, `shops.ts` Shops mit Nebenkosten und Verteilung des Bedarfs auf mehrere Shops,
    `weights.ts` Gewichte aus Diktat, `designer.ts` Rezept-Assistent (Optimierung der Fettanteile), `profile.ts` Modus,
    `leftover.ts` „Übrig“ (Seife nach „am besten bis“, ablaufende Fette mit Rezepten, die sie aufbrauchen),
    `customFat.ts` eigene Fette (Etikettwerte → Fettsäureprofil; per `setCustomFats` in `FATS`/`FATS_BY_ID`),
    `swap.ts` Fette tauschen (1:1, gleiches oder ähnliches Fett, günstiger, Gegenprobe nicht schlechter),
    `water.ts` Wasserhärte (WRMG-Bereiche, Zitronensäure-Faustregel; Gegenprobe bekommt sie als `EvaluateContext`)
- `src/data/`: Fette (Verseifungszahl in mg KOH/g, Fettsäuren, Jodzahl, INCI), Zusätze inkl. ätherische Öle, Zielprofile,
  Vorlagen (Grundseifen Körper/Haar/Rasur je mit Spar-Variante).
- `src/import/`: allgemeiner Shop-Katalog (`olisoap-shop-katalog`, ein Shop je Datei inkl. Versand; Prompt für
  Claude in Chrome in `docs/shop-katalog-prompt.md`), dazu Salandia-Bestellübersicht und -Katalog (automatische Erkennung).
- `src/sync/` + `public/api/index.php`: Ende-zu-Ende-verschlüsselter Sync (PBKDF2 → AES-256-GCM im Browser, Server speichert
  nur Chiffretext, Abgleich über Hashes, lokale Fassung gewinnt bei Konflikten).
- Rezepte: Grundseife + Varianten (`baseId`). Chargen speichern eine Kopie des Rezepts und festgeschriebene Kosten.
- Verfahren `input.process` 'cold' (Standard) | 'hot' (HP). HP: Lauge unverändert über alle Fette; `RecipeFat.afterCook`
  = Überfettungsöl nach dem Kochen (Gegenprobe: Summe ≤ Überfettung); Zusätze der Spur kommen nach dem Kochen.
  Siede-Modus mit Phase „Kochen“ (Stoppuhr, Stadien) und „Nach dem Kochen“, Arbeitsblatt ebenso. Vorlage
  „Körperseife heiß“ (Migration v8 ergänzt sie bei vorhandener Grundseife). Nutzer hat bisher nur kalt gesiedet.

## Betrieb

- Repo `olisym/olisoap` (öffentlich – **keine persönlichen Daten, Zugangsdaten oder gescrapten Kataloge committen**).
- Push auf `main` → GitHub Actions: Tests, Build, GitHub Pages (`/olisoap/`) **und** Branch `deploy` (Basis `/`).
- Produktiv: `https://olisoap.error13.de`, Netcup Webhosting 1000, Plesk Git-Bereitstellung zieht `deploy` nach `httpdocs`.
  PHP 8.5, MySQL mit Tabellenpräfix `olisoap_`. `open_basedir` = `{DOCROOT}` → Konfiguration liegt in
  `httpdocs/olisoap-config.php` (nicht im Repo). Diagnose: `api/index.php?a=health`.
- Keine `.htaccess` mit `Require`/`RewriteRule` im `api`-Ordner (führte zu HTTP 500).
- Service Worker darf `/api/` nicht auf `index.html` umleiten (`navigateFallbackDenylist`).
- Sync-API: Datensatz-Kennungen **≤ 100 Zeichen**, Datensätze ≤ 4 MB verschlüsselt. Feste Kennungen (z. B. aus Importen)
  hashen statt Namen einbauen. Vorlagen haben feste Kennungen (`vorlage-…`), doppelte unveränderte Rezepte räumt
  `removeDuplicateRecipes` nach jedem Abgleich auf.
- Versionen: `version.json` (Build-Hash) neben der App; `src/version.ts` vergleicht laufende Version, Server und
  Branch `deploy` auf GitHub → Leiste zeigt immer den Stand: „aktuell“, „Neu laden“ bzw. „Server veraltet“ (Server alle
  2 min und bei Fokus, GitHub höchstens alle 10 min; Handy: Punkt am „Mehr“-Knopf). Plesk zieht ggf. verzögert („Jetzt
  abrufen“). Service Worker im Modus `prompt`. `.htaccess`: no-cache-Regel muss nach der immutable-Regel stehen.

## Arbeitsweise

- Nach Änderungen: `npm test`, `npm run build`, `npx oxlint`; UI-Änderungen mit Playwright im Browser prüfen.
- Commits auf Deutsch, aussagekräftig. Direkt auf `main` (Ein-Personen-Projekt), **nach grünen Prüfungen sofort
  pushen** (geht gleich online, Nutzer testet dort).
- **Neue UI-Texte übersetzbar** schreiben: `const { t } = useTranslation()` und `t('Deutscher Text')` (i18next,
  deutscher Text = Schlüssel, Einrichtung in `src/i18n.ts`). Platzhalter `{{name}}`, Mehrzahl über
  `defaultValue_one`/`_other`, Zahlen mit `format.ts`. Bestehende Texte (ca. 1000) werden später umgestellt.

## Lokal entwickeln

- `npm install`, `npm run dev` (App), `npm test`, `npm run build`, `npx oxlint`.
- Sync lokal testen: `php -S localhost:8080 -t dist` mit `OLISOAP_CONFIG=/pfad/zu/config.php`
  (Vorlage `docs/olisoap-config.sample.php`, `dsn` z. B. `sqlite:/tmp/olisoap.sqlite`).
- Echte Shop-Kataloge des Nutzers liegen in `daten-lokal/` (gitignored), nur lokal verwenden, nie committen.

## Offene Themen (Stand v0.8)

Fahrplan in `docs/ENTSCHEIDUNGEN.md`. Erledigt: Seite „Profil & Einstellungen“ (`#/profil`, Modus Einsteiger/Experte
über `useMode()`/`useExpert()`, Schlüssel `mode`; ohne Wahl abgeleitet: Chargen vorhanden → Experte). Erledigt:
Rezept-Assistent `#/entwickeln` (`core/designer.ts`, Vorgaben je Seifenart in `profiles.ts` → `design`). Nächster
Schritt: „Fette tauschen“ (gleicher Kern), „bis versandfrei auffüllen“. Einsteiger-Anleitung ist da (Siede-Modus
„Schritt für Schritt“, `core/guide.ts`, Texte in `pages/guideContent.tsx`, Druck `#/rezepte/:id/anleitung`).
Hilfen erscheinen dort, wo die Frage entsteht, nicht als Funktionswand.

- Cremes/Emulsionen-Kern (Aftershave-Balsam als erstes Produkt), dann wasserfreie Produkte (Balsam, Bartwachs, Massageöl,
  Deo), Tinkturen (Myrrhe, Weihrauch). Haltbarkeit fertiger Produkte, „Retten“ ablaufender Zutaten.
- Einkauf ist **shopunabhängig** (Salandia: kein Feed, kein Affiliate-Programm, Antwort freundlich, „melden, wenn es
  Reichweite gibt“). Shops (`db.shops`) mit Versand (pauschal oder nach Gewichtsstufen, Paketgewicht = Inhalt × 1,15), versandfrei ab, Mindestbestellwert, Gebühr, „Laden vor Ort“; Modus
  „Nur was gebraucht wird“ optimiert über alle Shops inkl. Nebenkosten. Supermarkt-Ware: „Kaufe ich im Supermarkt“.
  Vorlieben je Shop (bevorzugt = bis 10 % teurer ok, meiden = nur wenn einzige Quelle), „Aufwand je weitere Bestellung“
  (Einstellung `extraOrderCost`). Eigene Sudgröße `batchFat` (Nutzer: 2-kg-Kastenform) gilt für Seife am Stück
  (`atBatchSize`, nicht für Tiegel/Mischlauge). Einkauf: „Was kostet ein Sud jetzt?“ sortiert Rezepte nach Ausgabe heute.
  Haltbarkeit (`shelfLife.ts`, Faustregel aus Anteil mehrfach ungesättigter Fettsäuren, ein Sud alle 2 Monate):
  Vorrats-Modus kauft nicht mehr, als in der Haltbarkeit verbraucht wird; Hinweis „hält geöffnet ca. … Monate“.
  Mit echten Katalogen (Dragonspice, Salandia, Manske, Eulenhof, je 300–1700 Artikel) getestet; Dateien nur lokal.
- Shop-Katalog-Import für beliebige Shops ist da. Offen: Schnelleingabe „Preis gesehen“ (Link, Preis, Größe), evtl. eBay-API. Keine fremden Shop-Daten zentral verteilen
  (Demo nutzt erfundene Beispiel-Shops, `src/demo/catalog.ts`). Keine allgemeine Einkaufs-App bauen (Scope).
- Hauptziel: eigenes Sieden optimieren, Verluste durch Ranzigwerden vermeiden; Einsteigern helfen ist willkommen.
  Affiliate allenfalls später, gekennzeichnet, ohne Vorschläge zu verbiegen.
- Ätherische Öle: Dosierung, Allergene (Deklaration ab 0,01 % in Rinse-off).
- Reste-Optimierer („Entwickeln“), Mindestbestände, Barcode.
