import { describe, test, expect } from 'vitest'
import { formatTime } from './TransportBar'

describe('formatTime', () => {
  test('formats 0 seconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  test('formats seconds under a minute', () => {
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(30)).toBe('0:30')
    expect(formatTime(59)).toBe('0:59')
  })

  test('formats whole minutes', () => {
    expect(formatTime(60)).toBe('1:00')
    expect(formatTime(120)).toBe('2:00')
    expect(formatTime(600)).toBe('10:00')
  })

  test('formats minutes and seconds', () => {
    expect(formatTime(90)).toBe('1:30')
    expect(formatTime(185)).toBe('3:05')
    expect(formatTime(3661)).toBe('61:01')
  })

  test('floors fractional seconds', () => {
    expect(formatTime(0.9)).toBe('0:00')
    expect(formatTime(1.5)).toBe('0:01')
    expect(formatTime(59.999)).toBe('0:59')
    expect(formatTime(61.7)).toBe('1:01')
  })

  test('pads single-digit seconds with leading zero', () => {
    expect(formatTime(3)).toBe('0:03')
    expect(formatTime(63)).toBe('1:03')
    expect(formatTime(609)).toBe('10:09')
  })

  test('returns 0:00 for negative input', () => {
    expect(formatTime(-1)).toBe('0:00')
    expect(formatTime(-0.5)).toBe('0:00')
    expect(formatTime(-100)).toBe('0:00')
  })

  test('returns 0:00 for NaN and Infinity', () => {
    expect(formatTime(NaN)).toBe('0:00')
    expect(formatTime(Infinity)).toBe('0:00')
    expect(formatTime(-Infinity)).toBe('0:00')
  })
})
