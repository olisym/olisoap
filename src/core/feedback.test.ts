import { describe, expect, it } from 'vitest'
import { feedbackText } from './feedback'

describe('Rückmeldung', () => {
  it('fasst die Schritte nach Art zusammen, Unklares zuerst', () => {
    const text = feedbackText({
      header: 'Rückmeldung zu olisoap',
      recipe: 'Körperseife (kalt)',
      build: 'abc1234',
      feedback: { safety: 'clear', blend: 'unclear', lye: 'much', weigh: 'clear' },
      titles: { safety: 'Sicherheit zuerst', blend: 'Mixen bis zur Spur', lye: 'Lauge ansetzen', weigh: 'Alles abwiegen' },
      labels: { clear: 'Klar', much: 'Zu viel auf einmal', unclear: 'Unklar' },
      note: '  Spur nicht erkannt ',
      noteLabel: 'Notiz',
    })
    expect(text.split('\n')).toEqual([
      'Rückmeldung zu olisoap',
      'Körperseife (kalt)',
      'Unklar: Mixen bis zur Spur',
      'Zu viel auf einmal: Lauge ansetzen',
      'Klar: Sicherheit zuerst, Alles abwiegen',
      'Notiz: Spur nicht erkannt',
      'Build abc1234',
    ])
  })
})
