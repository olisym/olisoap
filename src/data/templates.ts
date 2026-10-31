import type { Recipe } from '../db'

export type Template = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'baseId'>

/** Eine Grundseife mit ihren Varianten. Varianten verweisen beim Anlegen auf die Grundseife. */
export interface TemplateFamily {
  base: Template
  variants: Template[]
}

const citrate = {
  additiveId: 'citric-anhydrous',
  percentOfFats: 1.5,
  reason: 'Hartes Wasser: Natriumcitrat bindet einen Teil von Ca/Mg im Schaum.',
}

export const TEMPLATES: TemplateFamily[] = [
  {
    base: {
      name: 'Körperseife',
      description: 'Mild, cremig, ranzstabil. Wenig Laurinsäure, Härte über Stearin- und Palmitinsäure.',
      profileId: 'body-sensitive',
      barWeight: 125,
      notes:
        'Laurinsäure-Seifen (Kokos, Babassu) sind der Hauptauslöser für Reizungen durch Seife, deshalb nur 18 % Babassu. ' +
        'Härte kommt aus Shea und Kakaobutter, Pflege und Stabilität aus Olivenöl. ' +
        'Arbeitstemperatur ca. 35–40 °C, damit Shea und Kakaobutter nicht vorzeitig auskristallisieren (falsche Spur). ' +
        'Duft: wenn überhaupt, max. 1 % ätherisches Öl. Für empfindliche Haut besser unbeduftet.',
      input: {
        totalFat: 1000,
        lyeType: 'NaOH',
        lyePurity: 100,
        superfat: 7,
        water: { mode: 'concentration', value: 33 },
        fats: [
          { fatId: 'shea', percent: 30 },
          { fatId: 'olive', percent: 30 },
          { fatId: 'babassu', percent: 18 },
          { fatId: 'cocoa', percent: 10 },
          { fatId: 'castor', percent: 7 },
          { fatId: 'avocado', percent: 5 },
        ],
        additives: [citrate],
      },
    },
    variants: [
      {
        name: 'Körperseife Spar',
        description: 'Auf Preis optimiert: Kokos statt Babassu, Sonnenblumenöl High Oleic statt Oliven- und Avocadoöl.',
        profileId: 'body-sensitive',
        barWeight: 125,
        notes:
          'Rohstoffkosten ca. 30 % unter der Grundseife. Sonnenblumenöl unbedingt High Oleic (≥ 80 % Ölsäure), ' +
          'normales Sonnenblumenöl ist zu linolsäurereich. Arbeitstemperatur ca. 35–40 °C.',
        input: {
          totalFat: 1000,
          lyeType: 'NaOH',
          lyePurity: 100,
          superfat: 7,
          water: { mode: 'concentration', value: 33 },
          fats: [
            { fatId: 'sunflower-ho', percent: 35 },
            { fatId: 'shea', percent: 25 },
            { fatId: 'coconut', percent: 20 },
            { fatId: 'cocoa', percent: 15 },
            { fatId: 'castor', percent: 5 },
          ],
          additives: [citrate],
        },
      },
      {
        name: 'Körperseife heiß',
        description: 'Gleiche Fettmischung, heiß verseift: nach etwa einer Woche benutzbar, Avocadoöl als Überfettung nach dem Kochen.',
        profileId: 'body-sensitive',
        barWeight: 125,
        notes:
          'Heißverseifung: Leim bis zur Spur mixen, dann im Wasserbad oder Slow Cooker bei ca. 80 °C mit Deckel kochen, ' +
          'bis er durchscheinend und vaselineartig ist und der Zungen- bzw. pH-Test passt (meist 45–90 Minuten). ' +
          'Danach etwas abkühlen lassen, Avocadoöl und ggf. ätherisches Öl einrühren und zügig in die Form drücken, ' +
          'aufklopfen, damit keine Luftlöcher bleiben. Mehr Wasser (30 % Laugenkonzentration) hält den Leim formbar. ' +
          'Ob das nach dem Kochen zugegebene Öl wirklich unverseift bleibt, ist nicht sicher belegt: Ein Teil wird im heißen ' +
          'Leim noch verseift. Die Überfettung insgesamt stimmt trotzdem.',
        input: {
          totalFat: 1000,
          lyeType: 'NaOH',
          lyePurity: 100,
          superfat: 7,
          water: { mode: 'concentration', value: 30 },
          process: 'hot',
          fats: [
            { fatId: 'shea', percent: 30 },
            { fatId: 'olive', percent: 30 },
            { fatId: 'babassu', percent: 18 },
            { fatId: 'cocoa', percent: 10 },
            { fatId: 'castor', percent: 7 },
            { fatId: 'avocado', percent: 5, afterCook: true },
          ],
          additives: [citrate],
        },
      },
    ],
  },
  {
    base: {
      name: 'Haarseife',
      description: 'Hart, viel Schaum, gründliche aber nicht strippende Reinigung, ranzstabil.',
      profileId: 'hair-fine-long',
      barWeight: 80,
      notes:
        'Reinigung bewusst höher als bei der Körperseife (ca. 22), niedrige Überfettung, damit feines Haar nicht beschwert wird. ' +
        'Nur ölsäurereiche Flüssigöle (High Oleic), nie linolsäurereiche wie normales Distel- oder Sonnenblumenöl. ' +
        'Macadamia ist seifentechnisch neutral und kann durch weiteres Sonnenblumenöl HO ersetzt werden. ' +
        'Den Kalk löst die saure Rinse, das Citrat in der Seife hilft nur im Schaum.',
      input: {
        totalFat: 500,
        lyeType: 'NaOH',
        lyePurity: 100,
        superfat: 5,
        water: { mode: 'concentration', value: 33 },
        fats: [
          { fatId: 'sunflower-ho', percent: 33 },
          { fatId: 'babassu', percent: 32 },
          { fatId: 'castor', percent: 15 },
          { fatId: 'macadamia', percent: 10 },
          { fatId: 'cocoa', percent: 10 },
        ],
        additives: [citrate],
      },
    },
    variants: [
      {
        name: 'Haarseife Spar',
        description: 'Kokos statt Babassu, Shea statt Macadamia.',
        profileId: 'hair-fine-long',
        barWeight: 80,
        notes: 'Rohstoffkosten ca. 12 €/kg Fett statt ca. 18 €. Sonnenblumenöl unbedingt High Oleic.',
        input: {
          totalFat: 500,
          lyeType: 'NaOH',
          lyePurity: 100,
          superfat: 5,
          water: { mode: 'concentration', value: 33 },
          fats: [
            { fatId: 'sunflower-ho', percent: 35 },
            { fatId: 'coconut', percent: 30 },
            { fatId: 'castor', percent: 15 },
            { fatId: 'cocoa', percent: 10 },
            { fatId: 'shea', percent: 10 },
          ],
          additives: [citrate],
        },
      },
    ],
  },
  {
    base: {
      name: 'Rasierseife',
      description: 'Für Pinsel und Tiegel: Stearinsäure-Basis, Mischlauge 50 % KOH, Glycerin. Unbeduftet.',
      profileId: 'shave-brush',
      barWeight: 100,
      notes:
        'Heißverfahren empfohlen, Stearinsäure dickt im Kaltverfahren fast sofort an: Fette und Stearinsäure bei ca. 70 °C schmelzen, Lauge zugeben, ' +
        'im Wasserbad oder Slow Cooker 1–2 h garen, bis der Zungentest nicht mehr prickelt. Dann Glycerin einrühren und warm in den Tiegel drücken. ' +
        'Deckel erst schließen, wenn die Oberfläche trocken ist. ' +
        'Kein Duft: Frisch rasierte Haut ist die empfindlichste Stelle für Duftstoff-Reizungen.',
      input: {
        totalFat: 400,
        lyeType: 'dual',
        lyePurity: 100,
        kohShare: 50,
        kohPurity: 90,
        superfat: 4,
        water: { mode: 'concentration', value: 30 },
        process: 'hot',
        fats: [
          { fatId: 'stearic-acid', percent: 40 },
          { fatId: 'babassu', percent: 20 },
          { fatId: 'shea', percent: 20 },
          { fatId: 'castor', percent: 10 },
          { fatId: 'avocado', percent: 10 },
        ],
        additives: [
          { ...citrate, reason: 'Hartes Wasser verschlechtert Rasierschaum deutlich: Citrat bindet einen Teil von Ca/Mg.' },
          { additiveId: 'glycerin', percentOfFats: 7, reason: 'Weicher im Tiegel, leichter mit dem Pinsel aufzunehmen, gleitfähiger Schaum.' },
        ],
      },
    },
    variants: [
      {
        name: 'Rasierseife Spar',
        description: 'Kokos statt Babassu.',
        profileId: 'shave-brush',
        barWeight: 100,
        notes: 'Rohstoffkosten ca. 20 % unter der Grundseife. Verfahren wie Grundseife.',
        input: {
          totalFat: 400,
          lyeType: 'dual',
          lyePurity: 100,
          kohShare: 50,
          kohPurity: 90,
          superfat: 4,
          water: { mode: 'concentration', value: 30 },
          process: 'hot',
          fats: [
            { fatId: 'stearic-acid', percent: 40 },
            { fatId: 'coconut', percent: 20 },
            { fatId: 'shea', percent: 20 },
            { fatId: 'castor', percent: 10 },
            { fatId: 'avocado', percent: 10 },
          ],
          additives: [
            { ...citrate, reason: 'Hartes Wasser verschlechtert Rasierschaum deutlich: Citrat bindet einen Teil von Ca/Mg.' },
            { additiveId: 'glycerin', percentOfFats: 7, reason: 'Weicher im Tiegel, leichter mit dem Pinsel aufzunehmen, gleitfähiger Schaum.' },
          ],
        },
      },
    ],
  },
]
