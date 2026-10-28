import { expect, it } from 'vitest'
import { parseWeights } from './weights'

it('liest Gewichte aus Spracheingabe', () => {
  expect(parseWeights('128 Absatz 134 Absatz Uno nonsense absence 121\n135 131 123. 116 116 115 127')).toEqual([128, 134, 121, 135, 131, 123, 116, 116, 115, 127])
  expect(parseWeights('112,5; 98.4 und 3 Stück')).toEqual([112.5, 98.4])
})
