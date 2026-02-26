import { describe, test, expect } from 'vitest'
import {
  MIDI_HIGHLIGHT,
  getWhiteKeyBackground,
  getBlackKeyBackground,
  getKeyShadow,
} from './PianoKeyboard'

describe('PianoKeyboard highlight helpers', () => {
  describe('getWhiteKeyBackground', () => {
    test('returns gradient when neither active', () => {
      const bg = getWhiteKeyBackground(false, false)
      expect(bg).toContain('linear-gradient')
      expect(bg).toContain('var(--color-key-white)')
    })

    test('returns key-active color when song active but not MIDI', () => {
      expect(getWhiteKeyBackground(true, false)).toBe('var(--color-key-active)')
    })

    test('returns MIDI highlight when MIDI active', () => {
      expect(getWhiteKeyBackground(false, true)).toBe(MIDI_HIGHLIGHT)
    })

    test('MIDI highlight takes priority over song active', () => {
      expect(getWhiteKeyBackground(true, true)).toBe(MIDI_HIGHLIGHT)
    })
  })

  describe('getBlackKeyBackground', () => {
    test('returns gradient when neither active', () => {
      const bg = getBlackKeyBackground(false, false)
      expect(bg).toContain('linear-gradient')
      expect(bg).toContain('var(--color-key-black)')
    })

    test('returns key-active color when song active but not MIDI', () => {
      expect(getBlackKeyBackground(true, false)).toBe('var(--color-key-active)')
    })

    test('returns MIDI highlight when MIDI active', () => {
      expect(getBlackKeyBackground(false, true)).toBe(MIDI_HIGHLIGHT)
    })

    test('MIDI highlight takes priority over song active', () => {
      expect(getBlackKeyBackground(true, true)).toBe(MIDI_HIGHLIGHT)
    })
  })

  describe('getKeyShadow', () => {
    test('returns default shadow for inactive white key', () => {
      const shadow = getKeyShadow(false, false, false)
      expect(shadow).toContain('rgba(0,0,0')
    })

    test('returns default shadow for inactive black key', () => {
      const shadow = getKeyShadow(false, false, true)
      expect(shadow).toContain('rgba(0,0,0')
      expect(shadow).toContain('inset')
    })

    test('returns accent glow for song-active key', () => {
      const shadow = getKeyShadow(true, false, false)
      expect(shadow).toContain('var(--color-accent)')
    })

    test('returns MIDI glow for MIDI-active key', () => {
      const shadow = getKeyShadow(false, true, false)
      expect(shadow).toContain(MIDI_HIGHLIGHT)
    })

    test('MIDI glow takes priority when both active', () => {
      const shadow = getKeyShadow(true, true, false)
      expect(shadow).toContain(MIDI_HIGHLIGHT)
      expect(shadow).not.toContain('var(--color-accent)')
    })

    test('black key shadow spread differs from white key', () => {
      const white = getKeyShadow(false, true, false)
      const black = getKeyShadow(false, true, true)
      expect(white).not.toBe(black)
    })
  })

  describe('MIDI_HIGHLIGHT constant', () => {
    test('is a valid hex color', () => {
      expect(MIDI_HIGHLIGHT).toMatch(/^#[0-9a-f]{6}$/i)
    })

    test('is distinct from generic accent placeholder', () => {
      expect(MIDI_HIGHLIGHT).not.toBe('var(--color-key-active)')
      expect(MIDI_HIGHLIGHT).not.toBe('var(--color-accent)')
    })
  })
})
