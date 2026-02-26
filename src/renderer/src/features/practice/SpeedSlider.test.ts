import { describe, test, expect } from 'vitest'
import { formatSpeed } from './SpeedSlider'

describe('SpeedSlider helpers', () => {
  describe('formatSpeed', () => {
    test('formats integer speeds with .0x suffix', () => {
      expect(formatSpeed(1)).toBe('1.0x')
      expect(formatSpeed(2)).toBe('2.0x')
    })

    test('formats fractional speeds with x suffix', () => {
      expect(formatSpeed(0.25)).toBe('0.25x')
      expect(formatSpeed(0.5)).toBe('0.5x')
      expect(formatSpeed(0.75)).toBe('0.75x')
      expect(formatSpeed(1.5)).toBe('1.5x')
    })
  })
})
