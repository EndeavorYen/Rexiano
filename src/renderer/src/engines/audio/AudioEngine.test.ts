import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { AudioEngine } from './AudioEngine'

// ─── Mock SoundFontLoader ────────────────────────

vi.mock('./SoundFontLoader', () => {
  return {
    SoundFontLoader: class MockSoundFontLoader {
      isLoaded = false
      load = vi.fn().mockResolvedValue(undefined)
      getSample = vi.fn().mockReturnValue(undefined)
      dispose = vi.fn()
    },
  }
})

// ─── Mock Web Audio API ──────────────────────────

function createMockGainNode() {
  return {
    gain: {
      value: 1.0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function createMockAudioBufferSourceNode() {
  return {
    buffer: null,
    playbackRate: { value: 1.0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  }
}

function stubGlobalAudioContext() {
  const mockGainNode = createMockGainNode()
  const mockCtx = {
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    state: 'running',
    createGain: vi.fn().mockReturnValue(mockGainNode),
    createBufferSource: vi.fn().mockReturnValue(createMockAudioBufferSourceNode()),
    createBuffer: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }

  let constructCount = 0
  class MockAudioContext {
    currentTime = mockCtx.currentTime
    sampleRate = mockCtx.sampleRate
    destination = mockCtx.destination
    state = mockCtx.state
    createGain = mockCtx.createGain
    createBufferSource = mockCtx.createBufferSource
    createBuffer = mockCtx.createBuffer
    resume = mockCtx.resume
    suspend = mockCtx.suspend
    close = mockCtx.close
    constructor() {
      constructCount++
      // Return the shared mock object so tests can inspect it
      return mockCtx as unknown as MockAudioContext
    }
  }
  vi.stubGlobal('AudioContext', MockAudioContext)

  return {
    mockCtx,
    mockGainNode,
    MockAudioContext,
    get constructCount() { return constructCount },
  }
}

// ─── Tests ───────────────────────────────────────

describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEach(() => {
    engine = new AudioEngine()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initial state', () => {
    test('status is uninitialized', () => {
      expect(engine.status).toBe('uninitialized')
    })

    test('audioContext is null', () => {
      expect(engine.audioContext).toBeNull()
    })
  })

  describe('init', () => {
    test('sets status to ready after successful init', async () => {
      stubGlobalAudioContext()
      await engine.init()
      expect(engine.status).toBe('ready')
    })

    test('creates an AudioContext', async () => {
      const stub = stubGlobalAudioContext()
      await engine.init()
      expect(stub.constructCount).toBe(1)
      expect(engine.audioContext).not.toBeNull()
    })

    test('creates masterGain and connects to destination', async () => {
      const { mockCtx, mockGainNode } = stubGlobalAudioContext()
      await engine.init()
      expect(mockCtx.createGain).toHaveBeenCalled()
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockCtx.destination)
    })

    test('does not re-initialize if already ready', async () => {
      const stub = stubGlobalAudioContext()
      await engine.init()
      await engine.init()
      expect(stub.constructCount).toBe(1)
    })

    test('sets status to error if AudioContext creation fails', async () => {
      vi.stubGlobal('AudioContext', class FailingAudioContext {
        constructor() {
          throw new Error('AudioContext not supported')
        }
      })
      await expect(engine.init()).rejects.toThrow('AudioContext not supported')
      expect(engine.status).toBe('error')
    })

    test('status transitions: uninitialized → loading → ready', async () => {
      stubGlobalAudioContext()
      const statuses: string[] = []

      // Capture status during init by wrapping the method
      const origInit = engine.init.bind(engine)
      engine.init = async function () {
        // Record that it was 'uninitialized' before
        statuses.push(engine.status)
        const result = origInit()
        // After the first sync step, status should be 'loading'
        statuses.push(engine.status)
        await result
        statuses.push(engine.status)
      }

      await engine.init()
      expect(statuses).toEqual(['uninitialized', 'loading', 'ready'])
    })
  })

  describe('setVolume', () => {
    test('does not throw when masterGain is null (uninitialized)', () => {
      expect(() => engine.setVolume(0.5)).not.toThrow()
    })

    test('sets clamped value on masterGain when available', () => {
      const mockGainParam = { value: 0.5 }
      const mockGain = { gain: mockGainParam } as unknown as GainNode
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(engine as any)._masterGain = mockGain

      engine.setVolume(0.7)
      expect(mockGainParam.value).toBe(0.7)

      engine.setVolume(-0.5)
      expect(mockGainParam.value).toBe(0) // clamped to 0

      engine.setVolume(1.5)
      expect(mockGainParam.value).toBe(1) // clamped to 1

      engine.setVolume(0)
      expect(mockGainParam.value).toBe(0)

      engine.setVolume(1)
      expect(mockGainParam.value).toBe(1)
    })
  })

  describe('noteOn / noteOff', () => {
    test('noteOn is a no-op when status is not ready', () => {
      expect(() => engine.noteOn(60, 100, 0)).not.toThrow()
    })

    test('noteOff is a no-op when audioContext is null', () => {
      expect(() => engine.noteOff(60, 0.5)).not.toThrow()
    })

    test('noteOn creates source and connects audio graph', async () => {
      const { mockCtx } = stubGlobalAudioContext()

      // Set up getSample to return a valid sample
      const mockBuffer = {} as AudioBuffer
      const mockSample = { midi: 60, buffer: mockBuffer, sampleRate: 44100, basePitch: 60 }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loader = (engine as any)._soundFontLoader
      loader.getSample.mockReturnValue(mockSample)

      await engine.init()

      const mockSource = createMockAudioBufferSourceNode()
      const mockVelocityGain = createMockGainNode()
      mockCtx.createBufferSource.mockReturnValue(mockSource)
      // First createGain is for masterGain in init, subsequent ones for velocity
      mockCtx.createGain.mockReturnValue(mockVelocityGain)

      engine.noteOn(60, 100, 1.5)

      expect(mockCtx.createBufferSource).toHaveBeenCalled()
      expect(mockSource.buffer).toBe(mockBuffer)
      expect(mockSource.start).toHaveBeenCalledWith(1.5)
      expect(mockSource.connect).toHaveBeenCalledWith(mockVelocityGain)
    })

    test('noteOff applies release envelope to the active note', async () => {
      const { mockCtx } = stubGlobalAudioContext()

      const mockSample = { midi: 60, buffer: {} as AudioBuffer, sampleRate: 44100, basePitch: 60 }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loader = (engine as any)._soundFontLoader
      loader.getSample.mockReturnValue(mockSample)

      await engine.init()

      const mockSource = createMockAudioBufferSourceNode()
      const mockVelocityGain = createMockGainNode()
      mockCtx.createBufferSource.mockReturnValue(mockSource)
      mockCtx.createGain.mockReturnValue(mockVelocityGain)

      engine.noteOn(60, 100, 1.0)
      engine.noteOff(60, 2.0)

      // Release envelope should be applied
      expect(mockVelocityGain.gain.setValueAtTime).toHaveBeenCalled()
      expect(mockVelocityGain.gain.exponentialRampToValueAtTime).toHaveBeenCalled()
      expect(mockSource.stop).toHaveBeenCalled()
    })

    test('noteOn returns early if sample not found for midi', async () => {
      const { mockCtx } = stubGlobalAudioContext()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loader = (engine as any)._soundFontLoader
      loader.getSample.mockReturnValue(undefined)

      await engine.init()

      engine.noteOn(60, 100, 0)
      // createBufferSource should NOT be called if no sample
      // (only the init call to createGain counts)
      expect(mockCtx.createBufferSource).not.toHaveBeenCalled()
    })
  })

  describe('allNotesOff', () => {
    test('does not throw when no active notes', () => {
      expect(() => engine.allNotesOff()).not.toThrow()
    })

    test('stops all active sources', async () => {
      const { mockCtx } = stubGlobalAudioContext()

      const mockSample = { midi: 60, buffer: {} as AudioBuffer, sampleRate: 44100, basePitch: 60 }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loader = (engine as any)._soundFontLoader
      loader.getSample.mockReturnValue(mockSample)

      await engine.init()

      const mockSource = createMockAudioBufferSourceNode()
      const mockVelocityGain = createMockGainNode()
      mockCtx.createBufferSource.mockReturnValue(mockSource)
      mockCtx.createGain.mockReturnValue(mockVelocityGain)

      engine.noteOn(60, 100, 0)
      engine.allNotesOff()

      expect(mockSource.stop).toHaveBeenCalled()
    })
  })

  describe('resume / suspend', () => {
    test('resume does not throw when audioContext is null', async () => {
      await expect(engine.resume()).resolves.toBeUndefined()
    })

    test('suspend does not throw when audioContext is null', async () => {
      await expect(engine.suspend()).resolves.toBeUndefined()
    })

    test('resume calls audioContext.resume when available', async () => {
      const mockCtx = {
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as AudioContext
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(engine as any)._audioContext = mockCtx

      await engine.resume()
      expect(mockCtx.resume).toHaveBeenCalledTimes(1)
    })

    test('suspend calls audioContext.suspend when available', async () => {
      const mockCtx = {
        suspend: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as AudioContext
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(engine as any)._audioContext = mockCtx

      await engine.suspend()
      expect(mockCtx.suspend).toHaveBeenCalledTimes(1)
    })
  })

  describe('dispose', () => {
    test('sets status to uninitialized', () => {
      engine.dispose()
      expect(engine.status).toBe('uninitialized')
    })

    test('nullifies audioContext and masterGain', () => {
      const mockCtx = {
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as AudioContext
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(engine as any)._audioContext = mockCtx
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(engine as any)._masterGain = {} as GainNode

      engine.dispose()
      expect(engine.audioContext).toBeNull()
      expect(engine.status).toBe('uninitialized')
    })

    test('calls audioContext.close when available', () => {
      const closeFn = vi.fn().mockResolvedValue(undefined)
      const mockCtx = { close: closeFn } as unknown as AudioContext
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(engine as any)._audioContext = mockCtx

      engine.dispose()
      expect(closeFn).toHaveBeenCalledTimes(1)
    })

    test('disposes soundFontLoader', async () => {
      stubGlobalAudioContext()
      await engine.init()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loader = (engine as any)._soundFontLoader
      engine.dispose()
      expect(loader.dispose).toHaveBeenCalled()
    })

    test('dispose is safe to call multiple times', () => {
      engine.dispose()
      engine.dispose()
      expect(engine.status).toBe('uninitialized')
    })

    test('dispose is safe when audioContext is already null', () => {
      expect(() => engine.dispose()).not.toThrow()
    })
  })
})
