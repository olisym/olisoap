import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Guide, GuideStep, StepKind } from '../core/guide'

// Texte der Schritt-für-Schritt-Anleitung, gemeinsam für Bildschirm und Ausdruck. Belegtes steht als Tatsache da
// (Sicherheitsdatenblatt NaOH/KOH, Chemie), Erfahrungswerte sind als solche markiert. Kurz halten: ein Gedanke je Zeile.

export interface StepContent {
  title: string
  intro?: string
  bullets: ReactNode[]
  /** Hervorgehobener Hinweis (Sicherheit, typischer Fehler). */
  warn?: ReactNode
  /** Erst weiter, wenn diese Punkte abgehakt sind. */
  gate?: { key: string; label: string }[]
  /** Kleingedrucktes: was Erfahrungswert ist. */
  note?: string
}

/** Stadien beim Kochen (Heißverseifung), ohne die Spur, die beim Mixen schon erreicht ist. */
export function useCookStages(): { key: string; name: string; hint: string }[] {
  const { t } = useTranslation()
  return [
    { key: 'cook:gel', name: t('Gel-Stadium'), hint: t('Ränder werden glasig, der Leim steigt auf: umrühren, Hitze etwas runter.') },
    { key: 'cook:vaseline', name: t('Vaseline-Stadium'), hint: t('Durchscheinend, zäh und glänzend, wie Kartoffelbrei mit Vaseline.') },
    {
      key: 'cook:test',
      name: t('pH-Test'),
      hint: t('Etwas Leim mit ein paar Tropfen destilliertem Wasser anfeuchten, Teststreifen drauf. pH 9–10 ist normal für Seife; deutlich darüber: weiterkochen und nochmal testen.'),
    },
  ]
}

export function useStepContent(): (guide: Guide, step: GuideStep) => StepContent {
  const { t } = useTranslation()
  const list = (names: string[]) => names.join(', ')

  return (g, step) => {
    const lye = list(g.lyes)
    const builders: Record<StepKind, () => StepContent> = {
      equipment: () => ({
        title: t('Was du brauchst'),
        bullets: [
          g.fineScale ? t('Digitalwaage, für die kleinen Mengen auf 0,1 g genau') : t('Digitalwaage, auf 1 g genau'),
          t('Stabmixer'),
          t('Thermometer (Stab oder Infrarot; Infrarot misst nur die Oberfläche: vorher umrühren, nicht auf blankes Metall zielen)'),
          ...(g.hot ? [t('Slow Cooker oder Topf im Wasserbad, mit Deckel'), t('pH-Teststreifen')] : []),
          t('Gefäße aus Edelstahl oder hitzefestem Kunststoff (PP, Recyclingcode 5). Kein Aluminium: Es reagiert mit Lauge und bildet Wasserstoff.'),
          g.tub ? t('Tiegel mit Deckel') : t('Silikonform oder mit Backpapier ausgelegte Kastenform'),
          t('Spatel, Löffel, Küchenpapier'),
          t('Destilliertes Wasser'),
          t('Schutzbrille, Handschuhe (Nitril), lange Ärmel'),
        ],
        note: t('Werkzeug, das mit Lauge in Berührung kam, nicht mehr für Lebensmittel verwenden.'),
      }),
      safety: () => ({
        title: t('Sicherheit zuerst'),
        bullets: [
          t('{{lye}} ist stark ätzend. Ein Spritzer ins Auge kann es dauerhaft schädigen.', { lye }),
          t('Schutzbrille und Handschuhe tragen, bis alles abgewaschen ist.'),
          t('Kinder und Haustiere aus der Küche. Nichts nebenher kochen oder essen.'),
          t('Gut lüften: Beim Lösen der Lauge steigen Dämpfe auf, nicht einatmen.'),
          t('Lauge beschriften und nie unbeaufsichtigt stehen lassen.'),
        ],
        warn: t('Wenn doch etwas passiert: Auge sofort mindestens 15 Minuten unter fließendem Wasser spülen, dann zum Arzt. Haut mit viel Wasser abspülen. Nicht mit Essig neutralisieren, Wasser ist richtig.'),
        gate: [
          { key: 'gate:goggles', label: t('Schutzbrille auf') },
          { key: 'gate:gloves', label: t('Handschuhe an') },
        ],
      }),
      weigh: () => ({
        title: t('Alles abwiegen'),
        intro: t('Alles vorher abwiegen und bereitstellen, jedes in ein eigenes Gefäß. Abhaken, was steht.'),
        bullets: [],
      }),
      lye: () => ({
        title: t('Lauge ansetzen'),
        bullets: [
          ...(g.acids.length ? [t('{{acids}} zuerst im kalten Wasser vollständig lösen.', { acids: list(g.acids.map((a) => a.name)) })] : []),
          t('{{lye}} langsam ins Wasser rieseln lassen und rühren, bis alles gelöst ist.', { lye }),
          t('Die Lösung wird sehr heiß und dampft. Nicht darüber beugen.'),
          ...(g.lyeExtras.length ? [t('{{extras}} erst in die etwas abgekühlte Lauge.', { extras: list(g.lyeExtras.map((a) => a.name)) })] : []),
          t('Abgedeckt an einem sicheren Ort abkühlen lassen.'),
        ],
        warn: t('Immer Lauge ins Wasser, nie Wasser auf die Lauge: Das wird schlagartig heiß und kann spritzen.'),
      }),
      fats: () => ({
        title: t('Fette schmelzen'),
        bullets: [
          ...(g.solidFats.length ? [t('{{fats}} sanft schmelzen, dann die flüssigen Öle dazugeben.', { fats: list(g.solidFats) })] : [t('Öle in den Topf geben.')]),
          ...(g.stearic && g.hot ? [t('Stearinsäure schmilzt erst bei etwa 55–70 °C: so lange erwärmen, bis alles klar ist.')] : []),
          ...(step.items.some((i) => i.key.startsWith('add:')) ? [t('{{extras}} in die Fette.', { extras: list(step.items.filter((i) => i.key.startsWith('add:')).map((i) => i.name)) })] : []),
          ...(g.hot && g.steps.some((s) => s.kind === 'afterCook' && s.items.some((i) => i.key.startsWith('fat:')))
            ? [t('Das Überfettungsöl zurückhalten, es kommt erst nach dem Kochen dazu.')]
            : []),
        ],
      }),
      temperature: () => ({
        title: t('Temperaturen angleichen'),
        bullets: [
          g.butterRich ? t('Lauge und Fette auf etwa 35–40 °C bringen.') : t('Lauge und Fette auf etwa 30–45 °C bringen.'),
          t('Beide ähnlich warm, höchstens etwa 10 °C Unterschied.'),
        ],
        warn: g.butterRich ? t('Nicht kälter: Sonst kristallisieren die Butter aus und täuschen eine Spur vor (falsche Spur).') : undefined,
        note: t('Temperaturen sind Erfahrungswerte, keine festen Regeln.'),
      }),
      blend: () => ({
        title: t('Mixen bis zur Spur'),
        bullets: [
          t('Lauge langsam zu den Fetten gießen.'),
          t('Mit dem Stabmixer ein paar Sekunden mixen, dann mit dem ausgeschalteten Mixer umrühren. Abwechseln.'),
          t('Mixer schräg am Topfboden halten, damit keine Luft hineinkommt.'),
          t('Leichte Spur: Der Leim ist wie Vanillesoße, eine Linie auf der Oberfläche bleibt kurz sichtbar.'),
          g.hot ? t('Bei leichter Spur aufhören, jetzt wird gekocht.') : t('Leichte Spur reicht. Dickt der Leim schnell an: nicht weitermixen, zügig weiter.'),
        ],
      }),
      trace: () => ({
        title: t('Zusätze unterrühren'),
        bullets: [t('Jetzt kommen die Zusätze dazu, gut unterrühren.'), ...(g.fragrance ? [t('Ätherische Öle zuletzt, mit Handschuhen.')] : [])],
      }),
      mold: () => ({
        title: g.tub ? t('In den Tiegel') : t('In die Form'),
        bullets: [
          t('Leim in die Form gießen und auf die Arbeitsfläche klopfen, damit Luftblasen aufsteigen.'),
          t('Abdecken (Deckel oder Backpapier) und an einen ruhigen Ort stellen.'),
        ],
        warn: t('Der frische Leim ist noch ätzend: Handschuhe anlassen.'),
      }),
      cook: () => ({
        title: t('Kochen'),
        bullets: [
          t('Bei etwa 80 °C mit Deckel garen: Slow Cooker auf niedriger Stufe oder Topf im Wasserbad.'),
          t('Ab und zu umrühren. Meist dauert es 45–90 Minuten.'),
        ],
        warn: t('Nicht unbeaufsichtigt lassen: Der Leim kann aufsteigen und überlaufen.'),
      }),
      afterCook: () => ({
        title: t('Nach dem Kochen'),
        bullets: [
          t('Etwas abkühlen lassen, auf etwa 70 °C.'),
          ...(step.items.length ? [t('Die folgenden Zutaten einrühren.')] : []),
          ...(g.fragrance ? [t('Ätherische Öle zuletzt, mit Handschuhen.')] : []),
          g.tub ? t('Warm in den Tiegel drücken und glatt streichen.') : t('Zügig in die Form drücken und aufklopfen, damit keine Luftlöcher bleiben.'),
        ],
      }),
      firstDays: () => ({
        title: t('Die ersten Tage'),
        bullets: g.tub
          ? [t('Tiegel offen stehen lassen, bis die Oberfläche trocken ist. Erst dann den Deckel schließen.')]
          : g.hot
            ? [t('Nach etwa einem Tag aus der Form lösen und in Stücke schneiden.')]
            : [
                t('1–2 Tage in der Form lassen.'),
                t('Wird die Mitte dunkler und glasig, ist das die Gelphase: normal.'),
                t('Wenn die Seife fest ist, aus der Form lösen und in Stücke schneiden. Handschuhe: Frische Seife kann noch reizen.'),
              ],
      }),
      cure: () => ({
        title: t('Reifen lassen'),
        bullets: [
          g.tub ? t('Nach etwa 1–2 Wochen benutzbar.') : g.hot ? t('Nach etwa einer Woche benutzbar. Mit mehr Zeit wird sie härter und hält länger.') : t('4–6 Wochen luftig und schattig reifen lassen, mit Abstand, ab und zu wenden.'),
          ...(g.tub ? [] : [t('Die Seife wird dabei milder und härter, weil Wasser verdunstet.')]),
          t('Die Übersicht erinnert dich ans Wiegen und Prüfen.'),
        ],
        note: t('Reifezeiten sind Erfahrungswerte. Ob die Seife fertig ist, zeigt ein gleichbleibendes Gewicht.'),
      }),
      cleanup: () => ({
        title: t('Aufräumen'),
        bullets: [
          t('Töpfe und Mixer mit Leimresten 1–2 Tage stehen lassen: Dann ist der Rest Seife und lässt sich leicht abwaschen.'),
          t('Bis dahin Handschuhe tragen.'),
        ],
      }),
      use: () =>
        g.usage === 'acidRinse'
          ? {
              title: t('So benutzt du die Haarseife'),
              bullets: [
                t('Haare nass machen, Seife über das Haar streichen oder in den Händen aufschäumen, gut ausspülen.'),
                t('Danach immer sauer spülen: 10 g Zitronensäure in 2 L Wasser lösen und über das Haar gießen.'),
                t('Nicht in die Augen bringen.'),
              ],
              warn: t('Ohne saure Spülung bleibt Kalkseife im Haar: Es wird stumpf und strohig. Die Spülung löst sie.'),
              note: t('Die Menge für die Spülung ist ein Praxiswert. Sie wirkt über den sauren pH-Wert, nicht abhängig von der Wasserhärte.'),
            }
          : {
              title: t('So benutzt du die Rasierseife'),
              bullets: [
                t('Pinsel nass machen und ausdrücken.'),
                t('Kreisend über die Seife streichen, bis er voll Schaum ist.'),
                t('Auf der Haut oder in einer Schale aufschlagen, bei Bedarf etwas Wasser dazu.'),
              ],
            },
    }
    return builders[step.kind]()
  }
}
