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
- **Wasserhärte im Profil** (°dH, Eingabe auch in mmol/l, 1 mmol/l = 5,6 °dH). Belegt: Bereiche nach WRMG (weich
  < 8,4, mittel ≤ 14, hart). Faustregel, so gekennzeichnet: Zitronensäure weich 0, mittel 1 %, hart 1,5 %, ab 21 °dH
  2 %. Bei weichem Wasser bleibt Citrat nur bei viel Linolsäure (Metallspuren, Ranzigkeit). Die Haar-Rinse hängt
  nicht von der Härte ab: 2 L mit 15 °dH enthalten ca. 5 mmol Ca/Mg, 10 g Zitronensäure ca. 52 mmol (pH wirkt).
- Keine automatische Suche nach PLZ: Es gibt keine bundesweite freie Quelle (Daten je Versorger); Sammelseiten
  abzugreifen wäre rechtlich heikel. Ebenso keine Prospekt-/Angebotsdaten von Supermärkten (keine offene Quelle,
  Weitergabe untersagt, Scope). Stattdessen: Wert einmal eintragen, „Preis gesehen“ für Ladenpreise.
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

## Rezept-Assistent

- Für alle Seifenarten mit `design`-Vorgaben (bevorzugte Fette mit Höchstanteil, Grenze der Laurinsäure-Öle,
  Reglerenden, Überfettungsöle für HP). Lauge, Überfettung und Zusätze kommen aus der Grundseife der Seifenart.
- Kern: Kennzahlen sind linear → kleines Optimierungsproblem. Projizierter, beschleunigter Gradientenabstieg (FISTA);
  Laurinsäure-Grenze exakt über die Projektion (als Strafterm war das Problem steif und 10× langsamer). Projektion
  exakt über die sortierten Knicke (statt Halbierung), Schrittweite aus der Krümmung per Potenziteration, Abbruch
  vor dem Neustart prüfen (sonst Endlosschleife durch Rundungsrauschen am Ziel). Ergebnis: ca. 3–12 ms je Durchlauf. Zielbereiche
  der Seifenart (Gegenprobe), Linol-/Linolensäure und Jodzahl als starke Strafterme, Reglerwünsche schwächer. Danach
  auf ≤ 5 Fette ausgedünnt (unter den drei kleinsten das am wenigsten wichtige, sonst fliegt Rizinus raus) und auf
  ganze Prozent gerundet. ca. 15–35 ms je Durchlauf.
- **Regler in der Mitte = egal** (kaum Gewicht). Sonst ziehen bei Körperseife Härte, cremiger Schaum und Reinigung
  (dieselben Fettsäuren) gegeneinander und kein Regler wirkt.
- **Regler zeigen, was geht** (Wunsch des Nutzers: lernen durch Hin-und-her-Schieben statt Erklärtext): unter jedem
  Regler die erreichbare Fläche (Regler ganz links bzw. rechts, übrige stehen) und ein Punkt für das Erreichte; beim
  Preis die €/kg an beiden Enden. Die acht Zusatz-Durchläufe rechnet ein Web Worker
  (`src/workers/designer.worker.ts`), höchstens ein Auftrag gleichzeitig, sonst nur der neueste. Unter dem Verfahren
  eine Zeile, wann sich kalt/heiß anbietet.
- Körperseife: „kräftig“ bleibt an der Laurinsäure-Grenze (18 %) hängen. Gewollt.
- Unbekannter Preis zählt 1,3 × Schnitt (was kein Shop führt, ist schwerer zu bekommen).
- „Beides“: Rezept kalt, das Überfettungsöl ist schon als „nach dem Kochen“ markiert.

## Einsteiger-Anleitung

- Im Siede-Modus „Schritt für Schritt“ (Einsteiger standardmäßig) oder „Liste“ (Experte); gleiche Häkchen und
  Ist-Werte, Stoppuhr beim Kochen läuft beim Blättern weiter. Ein Schritt je Bildschirm, große Schrift.
- Schritte als Daten aus dem Rezept (`core/guide.ts`), Texte getrennt (`guideContent.tsx`) für Bildschirm und Druck.
- Sicherheit nur Belegtes (SDB NaOH/KOH: Augen ≥ 15 min spülen, Arzt; Haut mit Wasser, **kein Essig**; kein
  Aluminium wegen Wasserstoff; Lauge ins Wasser). Weiter erst nach „Schutzbrille auf“ und „Handschuhe an“.
  Erfahrungswerte (Temperaturen, Reifezeit, Spülungsmenge) sind gekennzeichnet.
- **pH-Teststreifen statt Zungentest**, überall in der App (Wunsch des Nutzers). pH 9–10 ist normal für Seife.
- Haarseife endet mit „So benutzt du sie“: ohne saure Spülung bleibt Kalkseife im Haar (Nutzer: „funktioniert nur
  mit der sauren Spülung“). Seifenart hat dafür `usage`.
- Beim Abwiegen erscheinen Ist-Felder erst auf „Etwas weicht ab?“ (weniger auf einmal). Auf dem Handy stehen
  Ist-Felder in eigener Zeile, sonst werden Namen abgeschnitten.
- Rückmeldung je Schritt mit drei Knöpfen (Klar / Zu viel auf einmal / Unklar), beim Abschluss als Text teilbar
  (Teilen-Menü bzw. Zwischenablage), kein Server. **Nur im Testmodus** (Profil, standardmäßig aus): Überall
  Zusatzknöpfe nerven (Nutzer: „das nervt den total, und mich erst recht“).

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
2. ~~**Rezept-Assistent**~~ erledigt (`#/entwickeln`, siehe unten).
3. ~~**Einsteiger-Anleitung**~~ erledigt (siehe unten). Nutzer liest die Texte gegen, Bruder testet als Neuling.
4. **Fette tauschen** (gleicher Kern): Hinweis nur, wenn spürbar günstiger und Gegenprobe grün.
5. **Bis versandfrei auffüllen**: nur mit Dingen, die ohnehin gebraucht werden und nicht verderben.
6. Später: Cremes/Emulsionen (Aftershave-Balsam, passend zur Rasierseife), wasserfreie Produkte, Tinkturen, Haltbarkeit fertiger Produkte,
   Schnelleingabe „Preis gesehen“, Übersetzung (Texte stehen derzeit direkt im Code, ca. 1000 Stück).
