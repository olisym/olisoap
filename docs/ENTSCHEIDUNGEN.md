# Entscheidungen und Lehren

Verdichtetes Gedächtnis der bisherigen Entwicklung (Stand Ende Oktober 2026). Ergänzt `CLAUDE.md`: dort steht, was immer
gilt; hier steht, warum etwas so ist und was wir dabei gelernt haben. Neue Erkenntnisse unten ergänzen, Veraltetes löschen.

## Nutzer und Haltung

- Hobby-Seifensieder, über 10 Jahre Kaltverfahren, Nerd, kein Entwickler. Will verstehen, nicht nur bedient werden.
- Hat schlechte Erfahrungen mit erfundenen KI-Fakten gemacht. Deshalb: nichts behaupten, was nicht belegt ist;
  Faustregeln als solche kennzeichnen; bei Unsicherheit sagen „nicht belegt“ oder „nicht gefunden“.
- Mag es, wenn Vorschläge begründet sind und er entscheiden kann. Neigt zu langen Nachrichten: Antworten knapp halten.
- Persönliche Praxis: 2-kg-Kastenform (2 kg Fett pro Sud), hartes Wasser, empfindliche Haut, lange feine Haare.
  Bisher nur kalt gesiedet, will Heißverseifung ausprobieren.

## Seife: fachliche Grundlagen, die in Code und Vorlagen stecken

- **Laurinsäure** (Kokos, Babassu) ist der Hauptauslöser für Hautreizung durch Seife → Körperseife nur 18 % Babassu.
- **Ranzigkeit / orange Flecken**: freies Fett mit vielen mehrfach ungesättigten Fettsäuren (Linol-, Linolensäure)
  oxidiert, Metallspuren beschleunigen. Regeln in `evaluate.ts` (PUFA > 15 %, PUFA > 10 % bei Überfettung ≥ 8 %,
  fehlender Komplexbildner). Eigene Erfahrung des Nutzers: ältere Seifen und Fettvorräte wurden ranzig.
- **Hartes Wasser**: Zitronensäure in der Lauge bildet Natriumcitrat, bindet Ca/Mg im Schaum. Haare: saure Rinse
  (10 g Zitronensäure auf 2 L Wasser) löst Kalkseife; das Citrat in der Seife hilft nur begrenzt.
- **Rasierseife**: Mischlauge NaOH/KOH, viel Stearinsäure, im Tiegel; Sudgröße bleibt klein (keine Kastenform).
- **Ätherische Öle** brauchen keine Lauge (keine verseifbaren Triglyceride). Oxidierte Zitrus-/Nadelöle sind stärkere
  Kontaktallergene → alte, offene Flaschen nicht für Seife.
- **Wasser aus Zusätzen** (z. B. Natriumlactat-Lösung) wird vom Gesamtwasser abgezogen. Säuren verbrauchen Lauge.
- **Heißverseifung (HP)**: Lauge wie gewohnt über alle Fette; Überfettungsöl nach dem Kochen höchstens so viel wie die
  Überfettung. Ob es unverseift bleibt, ist nicht sicher belegt. Mehr Wasser (ca. 30 % Laugenkonzentration) hält den
  Leim formbar (Erfahrungswert). Benutzbar nach ca. 1 Woche, reift trotzdem nach.
- **Haltbarkeit offener Fette** (`shelfLife.ts`): Faustregel aus PUFA-Anteil (24 bis 6 Monate), Chemie dahinter belegt,
  Monatswerte nicht.
- Kennzahlen (Härte, Reinigung usw.) nach SoapCalc-Konvention sind Heuristiken, linear in den Fettanteilen.

## Produkt- und UX-Entscheidungen

- Übersicht nach Anliegen (Sieden, Rezepte, Vorrat, Einkauf, Entwickeln). Ernstes, dunkles Instrumententafel-Design.
- **Hilfe dort, wo die Frage entsteht**, nicht als Funktionswand: `LabelText` mit „?“-Kurzhilfe; Hinweise erscheinen
  nur, wenn sie etwas bringen. Keine Onboarding-Slideshow (wird weggeklickt).
- Feldnamen alltagsnah: „Seifenart“ statt Zielprofil, „Variante von“ statt Gehört zu, „Fette gesamt“.
- Rezepte: Grundseife + Varianten. Vorlagen haben feste Kennungen (`vorlage-…`), sonst verdoppelt der Sync sie.
- **Kein „für wen“** an Chargen/Etiketten (ausdrücklicher Wunsch). Keine Namen Dritter in Daten oder Code.
- Recipe-Prüfungen heißen „Gegenprobe“.
- **Einsteiger/Experte** ändert nur die Anzeige, nie Rechnung oder Daten. Einsteiger: keine VZ-Spalte, keine
  Mischlauge, nur Laugenkonzentration, Hilfen bei Überfettung/Wasser offen. Was ein Rezept schon nutzt (eigene VZ,
  Mischlauge, anderer Wassermodus), bleibt sichtbar, damit nichts unsichtbar mitrechnet. Der Modus wird beim ersten
  Start bewusst nicht gespeichert (sonst überschreibt ein frisches Gerät beim Sync die Wahl), sondern abgeleitet.
  Hell/dunkel gilt je Gerät (localStorage), alles andere wird synchronisiert.
- Demo (`#/demo`): erfundene Beispiel-Shops und eine Beispiel-Werkstatt relativ zum heutigen Datum, nie echte
  Shop-Daten verteilen.

## Einkauf (größter Ausbau bisher)

- **Shopunabhängig**: Salandia hat kein Feed/Affiliate-Programm (freundliche Antwort: interessant, melden, wenn es
  Reichweite gibt). Nutzer findet Salandias Shop umständlich und will künftig nur in der App suchen.
- Preise kommen per **Shop-Katalog-Import** (`olisoap-shop-katalog`, Prompt für Claude in Chrome in
  `docs/shop-katalog-prompt.md`). Getestet mit Dragonspice, Salandia, Manske, Der Eulenhof (300–1700 Artikel je Shop).
  Die JSON-Dateien liegen nur lokal beim Nutzer, **nie ins Repo**.
- Shop-Vergleich (Recherche des Nutzers): Dragonspice als Hauptshop (alles inkl. KOH, frei ab 80 €), Salandia als
  Alternative, Manske/Eulenhof nur für große Gebinde stabiler Rohstoffe (Freigrenzen 400/350 €). Manske: Versand nach
  Gewicht (5,95 € bis 10 kg, 10,71 € bis 30 kg) muss als Stufen eingetragen sein.
- Olivenöl, Sonnenblumenöl HO u. Ä. kauft der Nutzer im Supermarkt („Kaufe ich im Supermarkt“, Laden vor Ort).
- Zwei Modi: „Nur was gebraucht wird“ (Optimierer über alle Shops inkl. Versand, Gewichtsstufen, Mindestbestellwert,
  Gebühr, Vorlieben, Aufwand je weitere Bestellung) und „Vorrat: bester kg-Preis“ (begrenzt durch Haltbarkeit).
- Optimierer exakt bei wenigen Kombinationen, sonst Mehrstart-Heuristik; Produktlinie = Name ohne Größe/Gebinde, damit
  nur gleiche Qualität kombiniert wird. Nicht lieferbare Artikel und veraltete Preise zählen nicht.
- „Was kostet ein Sud jetzt?“: Rezepte nach heutiger Ausgabe sortiert (für „wenig Geld, schnell sieden“).
- Affiliate allenfalls später, gekennzeichnet, ohne Vorschläge zu verbiegen. Keine allgemeine Einkaufs-App bauen.

## Technik und Betrieb: gelernte Lektionen

- Plesk/Netcup: `open_basedir` = `{DOCROOT}` → `olisoap-config.php` liegt in `httpdocs`, nicht darüber.
  `.htaccess` mit `Require`/`RewriteRule` im `api`-Ordner führte zu HTTP 500. Token im JSON-Body statt Header.
- Service Worker: `/api/` nie auf `index.html` umleiten; Modus `prompt`; in `.htaccess` muss die no-cache-Regel nach der
  immutable-Regel stehen (sonst wird `sw.js` ein Jahr gecacht).
- Plesk zieht den Branch `deploy` teils verzögert → Versionsanzeige (`version.ts`), immer sichtbar nach Vorbild der
  Volcano-App: „aktuell“ + Stand (Build-Zeit), „Neu laden“, „Server veraltet“. GitHub-API ohne Anmeldung: 60 Anfragen
  je Stunde und IP, deshalb höchstens alle 10 Minuten.
- Übersetzung: i18next mit deutschem Text als Schlüssel (lesbarer Code, kein Build-Plugin nötig, Standardwerkzeuge
  zum Herausziehen). Gewählt statt Lingui, weil dessen Makros ein Babel/SWC-Plugin brauchen.
- Sync-API: Kennungen ≤ 100 Zeichen (Import-Kennungen hashen!), Datensätze ≤ 4 MB; zu große/lange Datensätze werden
  übersprungen und gemeldet statt den Abgleich zu blockieren. Migrationen über Dexie-Versionen (aktuell 8).
- Große Kataloge (≈ 4600 Artikel): Listen gruppieren und kürzen („Meine Artikel“), teure Berechnungen nur bei
  Datenänderung (Live-Query-Objekte als Memo-Abhängigkeit).
- Rasterzellen brauchen `min-width: 0` (global in `index.css`), sonst scrollt das Handy seitlich.
- Prüfen im Browser mit Playwright gegen `npm run build` + `php -S localhost:PORT -t dist`; Sync lokal mit SQLite:
  `OLISOAP_CONFIG=/pfad/config.php` (`dsn` sqlite, `register_code`). Echte Shop-Dateien nur in temporären Tests.
- Zugriff auf Shop-Websites war in der Cloud-Umgebung gesperrt; lokal mit Claude Code geht es. Eigene Kataloge
  liegen in `daten-lokal/` (gitignored). Lokal ist kein PHP installiert: UI-Prüfung mit `npx vite preview`.

## Fahrplan (Reihenfolge abgestimmt)

1. ~~**Profil & Einstellungen**~~ erledigt (`#/profil`, Zahnrad in der Leiste).
2. **Rezept-Assistent** (Rezepte → „Neue Seife zusammenstellen“, Kachel „Entwickeln“): touch-tauglich, wenige Regler mit
   Alltagswörtern (mild ↔ kräftig, cremig ↔ großblasig, weich ↔ hart, günstig ↔ egal), Verfahren kalt/heiß/beides,
   „nur was da ist“ oder „darf einkaufen“, Ausschlüsse und Lieblingsöl, Ergebnis live mit Gegenprobe, Kosten,
   Haltbarkeit und Begründung; Speichern/Sieden/Einkaufen. Kern: Optimierung (Kennzahlen linear), mit Tests.
3. **Einsteiger-Anleitung**: Sieden Schritt für Schritt (ein Schritt je Bildschirm, Sicherheit, Stadien), Ausdruck als
   Anleitung zum Nachmachen.
4. **Fette tauschen** (gleicher Kern): Hinweis nur, wenn spürbar günstiger und Gegenprobe grün.
5. **Bis versandfrei auffüllen**: nur mit Dingen, die ohnehin gebraucht werden und nicht verderben.
6. Später: Cremes/Emulsionen (Aftershave-Balsam), wasserfreie Produkte, Tinkturen, Haltbarkeit fertiger Produkte,
   Schnelleingabe „Preis gesehen“, Übersetzung (Texte stehen derzeit direkt im Code, ca. 1000 Stück).
