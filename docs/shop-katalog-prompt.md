# Prompts für Claude in Chrome: Shops finden und Shop-Katalog erstellen

Teil A einmal verwenden, um Shops auszuwählen. Teil B je Shop einmal (und später zum Aktualisieren der Preise).
Die erzeugte JSON-Datei in olisoap unter **Vorrat → Import** einlesen. Das Format heißt `olisoap-shop-katalog`
(siehe `src/import/shopCatalog.ts`).

---

## Teil A: Shops vergleichen und auswählen

```text
Ich siede Seife im Kaltverfahren und suche Online-Shops in Deutschland für Rohstoffe. Bitte vergleiche diese Shops:
Dragonspice, Behawe, Manske, Rosarome, Alexmo, Einseifer, Camassia, Der Eulenhof, Brennessel München
(ergänze bis zu drei weitere, falls dir bei der Recherche bekannte, gut bewertete Shops dieser Art begegnen).

Prüfe je Shop auf der Website selbst und bei unabhängigen Bewertungen (z. B. Trusted Shops, Google-Bewertungen):
1. Bewertung: Durchschnitt und Anzahl, mit Quelle. Nichts schätzen; wenn nichts zu finden ist, „keine gefunden“.
2. Sortiment für Seife: Gibt es Natriumhydroxid (NaOH), Kaliumhydroxid (KOH), Sheabutter, Kakaobutter, Babassuöl,
   Kokosöl, Rizinusöl, Avocadoöl, Stearinsäure, Zitronensäure, naturreine ätherische Öle? Auch Großgebinde (≥ 1 kg)?
3. Versand innerhalb Deutschlands: Kosten, versandkostenfrei ab, Mindestbestellwert, Zuschläge (z. B. Gefahrgut für
   NaOH), Zahlungsarten mit Gebühren.
4. Angaben zur Qualität: Analysezertifikate, Herkunft, Bio, INCI-Angaben.

Gib eine Tabelle aus und empfiehl danach die drei Shops, die zusammen das Sortiment am besten abdecken, mit je einem
Satz Begründung. Keine Werbesprache, nichts erfinden, Quellen-Links angeben.
```

---

## Teil B: Shop-Katalog erstellen (je Shop)

```text
Erstelle für olisoap, meine Werkstatt-App für Seife und Kosmetik, einen Katalog-Auszug des Shops [SHOP-URL].
Nur für meinen eigenen Gebrauch. Arbeite die Seiten ruhig nacheinander ab, nicht parallel.

1. Versandbedingungen (Seite „Versand“, „Versandkosten“ oder „Lieferung“, meist im Footer):
   Standardversand innerhalb Deutschlands in €; hängt er vom Paketgewicht ab, stattdessen die Stufen als
   "versand_staffel" (bis kg → €) und "versand_eur": null. Versandkostenfrei ab (Warenwert in €), Mindestbestellwert in €,
   feste Gebühr je Bestellung (nur wenn sie immer anfällt, sonst null). Zuschläge oder Besonderheiten
   (z. B. Gefahrgut, Sperrgut, Nachnahme) kurz unter "hinweise".

2. Artikel aus diesen Bereichen, jede Packungsgröße als eigener Eintrag, Feld "art" wie angegeben:
   - Pflanzenöle, Fette, Buttern, Wachse, Stearinsäure → "fett"
   - Natriumhydroxid, Kaliumhydroxid (fest, keine fertigen Laugen/Lösungen) → "lauge"
   - Zitronensäure, Natriumcitrat, Natriumlactat, Milchsäure, Glycerin, Salz, Tonerden (Kaolin), Seidenprotein → "zusatz"
   - naturreine ätherische Öle (keine Parfüm-/Duftöle, keine Mischungen mit Trägeröl) → "aetherisch"
   - Emulgatoren → "emulgator", Konservierer → "konservierer", Wirkstoffe wie Panthenol, Allantoin, Hyaluron → "wirkstoff"
   Nicht aufnehmen: Verpackungen, Werkzeug, Farben, Glitzer, Gießseife/Rohseife, Parfümöle, Fertigprodukte, Sets.

3. Je Artikel:
   - "name": vollständiger Artikelname wie im Shop, inklusive Qualität (z. B. „raffiniert“, „kaltgepresst“, „Bio“)
     und Packungsgröße
   - "url": Link zur Artikelseite (bei Varianten der Link, der diese Größe zeigt, sonst die Artikelseite)
   - "packungsgroesse": Zahl in g bzw. ml (1 kg = 1000, 1 L = 1000), "einheit": "g", "ml" oder "Stk"
   - "preis_eur": Preis dieser Packung in € inklusive MwSt (nicht der Grundpreis pro kg/L)
   - "lieferbar": true/false laut Shop, null wenn unklar
   - "bio": true/false, "artikelnummer": falls angegeben, sonst null

4. Regeln: Nichts schätzen oder ergänzen. Unbekanntes = null. Angebote/Rabattpreise nur, wenn sie ohne Gutschein
   für alle gelten. Doppelte Einträge weglassen.

5. Ausgabe: genau ein JSON-Objekt in diesem Format, als Datei zum Herunterladen namens
   shop-[shopname]-[JJJJ-MM-TT].json (wenn das nicht geht, als einzelner Codeblock):

{
  "format": "olisoap-shop-katalog",
  "version": 1,
  "erstellt_am": "JJJJ-MM-TT",
  "shop": {
    "name": "Shopname",
    "url": "https://…",
    "versand_eur": 4.90,
    "versand_staffel": null,
    "versandfrei_ab_eur": 49.00,
    "mindestbestellwert_eur": null,
    "gebuehr_eur": null,
    "hinweise": "z. B. Gefahrgutzuschlag 2 € für Natriumhydroxid"
  },
  "produkte": [
    {
      "name": "Sheabutter raffiniert Bio 500 g",
      "url": "https://…",
      "art": "fett",
      "packungsgroesse": 500,
      "einheit": "g",
      "preis_eur": 9.90,
      "lieferbar": true,
      "bio": true,
      "artikelnummer": "12345"
    }
  ]
}

Beispiel für Versand nach Gewicht: "versand_eur": null, "versand_staffel": [{ "bis_kg": 10, "eur": 5.95 }, { "bis_kg": 30, "eur": 10.71 }]

Zum Schluss kurz berichten: Anzahl Artikel je "art", welche Bereiche du nicht gefunden hast und was unklar war.
```
