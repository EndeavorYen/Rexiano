import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { MidiDeviceManager } from './MidiDeviceManager'

// ─── Mock Web MIDI API ──────────────────────────

function createMockMIDIPort(overrides: Partial<MIDIInput | MIDIOutput> = {}): MIDIInput & MIDIOutput {
  return {
    id: 'port-1',
    name: 'Test Device',
    manufacturer: 'Test Manufacturer',
    type: 'input',
    state: 'connected',
    connection: 'open',
    version: '1.0',
    onmidimessage: null,
    onstatechange: null,
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    clear: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
    ...overrides,
  } as unknown as MIDIInput & MIDIOutput
}

function createMockMIDIAccess(
  inputs: Map<string, MIDIInput> = new Map(),
  outputs: Map<string, MIDIOutput> = new Map(),
): MIDIAccess {
  return {
    inputs,
    outputs,
    sysexEnabled: false,
    onstatechange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
  } as unknown as MIDIAccess
}

function stubRequestMIDIAccess(midiAccess: MIDIAccess) {
  const fn = vi.fn().mockResolvedValue(midiAccess)
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    requestMIDIAccess: fn,
  })
  return fn
}

// ─── Tests ───────────────────────────────────────

describe('MidiDeviceManager', () => {
  let manager: MidiDeviceManager

  beforeEach(() => {
    MidiDeviceManager.resetInstance()
    manager = MidiDeviceManager.getInstance()
  })

  afterEach(() => {
    MidiDeviceManager.resetInstance()
    vi.unstubAllGlobals()
  })

  describe('singleton', () => {
    test('getInstance returns the same instance', () => {
      const a = MidiDeviceManager.getInstance()
      const b = MidiDeviceManager.getInstance()
      expect(a).toBe(b)
    })

    test('resetInstance creates a new instance', () => {
      const a = MidiDeviceManager.getInstance()
      MidiDeviceManager.resetInstance()
      const b = MidiDeviceManager.getInstance()
      expect(a).not.toBe(b)
    })
  })

  describe('initial state', () => {
    test('status is uninitialized', () => {
      expect(manager.status).toBe('uninitialized')
    })

    test('inputs and outputs are empty', () => {
      expect(manager.inputs).toEqual([])
      expect(manager.outputs).toEqual([])
    })

    test('activeInputId and activeOutputId are null', () => {
      expect(manager.activeInputId).toBeNull()
      expect(manager.activeOutputId).toBeNull()
    })
  })

  describe('init', () => {
    test('sets status to unsupported when requestMIDIAccess is missing', async () => {
      vi.stubGlobal('navigator', { requestMIDIAccess: undefined })
      await manager.init()
      expect(manager.status).toBe('unsupported')
    })

    test('sets status to denied when requestMIDIAccess rejects', async () => {
      vi.stubGlobal('navigator', {
        requestMIDIAccess: vi.fn().mockRejectedValue(new DOMException('User denied')),
      })
      await manager.init()
      expect(manager.status).toBe('denied')
    })

    test('sets status to ready on successful access', async () => {
      const midiAccess = createMockMIDIAccess()
      stubRequestMIDIAccess(midiAccess)
      await manager.init()
      expect(manager.status).toBe('ready')
    })

    test('does not re-init when already ready', async () => {
      const midiAccess = createMockMIDIAccess()
      const fn = stubRequestMIDIAccess(midiAccess)
      await manager.init()
      await manager.init()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('does not re-init when status is unsupported', async () => {
      vi.stubGlobal('navigator', { requestMIDIAccess: undefined })
      await manager.init()
      expect(manager.status).toBe('unsupported')
      // Even if we somehow restore requestMIDIAccess, it should stay unsupported
      await manager.init()
      expect(manager.status).toBe('unsupported')
    })

    test('enumerates input and output devices on init', async () => {
      const inputPort = createMockMIDIPort({ id: 'in-1', type: 'input', name: 'Piano In' })
      const outputPort = createMockMIDIPort({ id: 'out-1', type: 'output', name: 'Piano Out' })

      const inputs = new Map<string, MIDIInput>([['in-1', inputPort]])
      const outputs = new Map<string, MIDIOutput>([['out-1', outputPort]])
      const midiAccess = createMockMIDIAccess(inputs, outputs)
      stubRequestMIDIAccess(midiAccess)

      await manager.init()

      expect(manager.inputs).toHaveLength(1)
      expect(manager.inputs[0].id).toBe('in-1')
      expect(manager.inputs[0].name).toBe('Piano In')

      expect(manager.outputs).toHaveLength(1)
      expect(manager.outputs[0].id).toBe('out-1')
      expect(manager.outputs[0].name).toBe('Piano Out')
    })

    test('calls requestMIDIAccess with sysex: false', async () => {
      const midiAccess = createMockMIDIAccess()
      const fn = stubRequestMIDIAccess(midiAccess)
      await manager.init()
      expect(fn).toHaveBeenCalledWith({ sysex: false })
    })
  })

  describe('connect / disconnect', () => {
    let inputPort: MIDIInput
    let outputPort: MIDIOutput

    beforeEach(async () => {
      inputPort = createMockMIDIPort({ id: 'in-1', type: 'input', state: 'connected' })
      outputPort = createMockMIDIPort({ id: 'out-1', type: 'output', state: 'connected' })

      const inputs = new Map<string, MIDIInput>([['in-1', inputPort]])
      const outputs = new Map<string, MIDIOutput>([['out-1', outputPort]])
      const midiAccess = createMockMIDIAccess(inputs, outputs)
      stubRequestMIDIAccess(midiAccess)

      await manager.init()
    })

    test('connectInput sets activeInputId', () => {
      const result = manager.connectInput('in-1')
      expect(result).toBe(true)
      expect(manager.activeInputId).toBe('in-1')
    })

    test('connectInput returns false for non-existent device', () => {
      const result = manager.connectInput('non-existent')
      expect(result).toBe(false)
      expect(manager.activeInputId).toBeNull()
    })

    test('connectInput returns false for disconnected device', async () => {
      const disconnected = createMockMIDIPort({ id: 'in-2', type: 'input', state: 'disconnected' })
      const inputs = new Map<string, MIDIInput>([['in-2', disconnected]])
      const midiAccess = createMockMIDIAccess(inputs)
      stubRequestMIDIAccess(midiAccess)

      MidiDeviceManager.resetInstance()
      manager = MidiDeviceManager.getInstance()
      await manager.init()

      const result = manager.connectInput('in-2')
      expect(result).toBe(false)
    })

    test('disconnectInput clears activeInputId', () => {
      manager.connectInput('in-1')
      manager.disconnectInput()
      expect(manager.activeInputId).toBeNull()
    })

    test('connectOutput sets activeOutputId', () => {
      const result = manager.connectOutput('out-1')
      expect(result).toBe(true)
      expect(manager.activeOutputId).toBe('out-1')
    })

    test('disconnectOutput clears activeOutputId', () => {
      manager.connectOutput('out-1')
      manager.disconnectOutput()
      expect(manager.activeOutputId).toBeNull()
    })

    test('connectInput fires onActiveInputChange callback', () => {
      const cb = vi.fn()
      manager.onActiveInputChange(cb)
      manager.connectInput('in-1')
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'in-1' }),
      )
    })

    test('disconnectInput fires onActiveInputChange with null', () => {
      const cb = vi.fn()
      manager.connectInput('in-1')
      manager.onActiveInputChange(cb)
      manager.disconnectInput()
      expect(cb).toHaveBeenCalledWith(null)
    })

    test('getActiveInput returns MIDIInput when connected', () => {
      manager.connectInput('in-1')
      const port = manager.getActiveInput()
      expect(port).toBe(inputPort)
    })

    test('getActiveInput returns null when not connected', () => {
      expect(manager.getActiveInput()).toBeNull()
    })

    test('getActiveOutput returns MIDIOutput when connected', () => {
      manager.connectOutput('out-1')
      const port = manager.getActiveOutput()
      expect(port).toBe(outputPort)
    })

    test('getActiveOutput returns null when not connected', () => {
      expect(manager.getActiveOutput()).toBeNull()
    })
  })

  describe('hot-plug / auto-reconnect', () => {
    test('onstatechange refreshes device lists', async () => {
      const inputs = new Map<string, MIDIInput>()
      const outputs = new Map<string, MIDIOutput>()
      const midiAccess = createMockMIDIAccess(inputs, outputs)
      stubRequestMIDIAccess(midiAccess)

      await manager.init()
      expect(manager.inputs).toHaveLength(0)

      // Simulate device plug-in
      const newPort = createMockMIDIPort({ id: 'in-new', type: 'input', state: 'connected' })
      inputs.set('in-new', newPort)

      // Trigger onstatechange
      midiAccess.onstatechange?.({} as MIDIConnectionEvent)

      expect(manager.inputs).toHaveLength(1)
      expect(manager.inputs[0].id).toBe('in-new')
    })

    test('auto-reconnects a previously connected input device', async () => {
      const inputPort = createMockMIDIPort({ id: 'in-1', type: 'input', state: 'connected' })
      const inputs = new Map<string, MIDIInput>([['in-1', inputPort]])
      const midiAccess = createMockMIDIAccess(inputs)
      stubRequestMIDIAccess(midiAccess)

      await manager.init()
      manager.connectInput('in-1')
      expect(manager.activeInputId).toBe('in-1')

      // Simulate device unplug
      ;(inputPort as any).state = 'disconnected'
      midiAccess.onstatechange?.({} as MIDIConnectionEvent)
      expect(manager.activeInputId).toBeNull()

      // Simulate device re-plug
      ;(inputPort as any).state = 'connected'
      midiAccess.onstatechange?.({} as MIDIConnectionEvent)
      expect(manager.activeInputId).toBe('in-1')
    })

    test('fires onDeviceListChange on statechange', async () => {
      const midiAccess = createMockMIDIAccess()
      stubRequestMIDIAccess(midiAccess)

      const cb = vi.fn()
      await manager.init()
      manager.onDeviceListChange(cb)

      midiAccess.onstatechange?.({} as MIDIConnectionEvent)
      expect(cb).toHaveBeenCalledTimes(1)
    })
  })

  describe('dispose', () => {
    test('resets all state', async () => {
      const midiAccess = createMockMIDIAccess()
      stubRequestMIDIAccess(midiAccess)
      await manager.init()

      manager.dispose()
      expect(manager.status).toBe('uninitialized')
      expect(manager.inputs).toEqual([])
      expect(manager.outputs).toEqual([])
      expect(manager.activeInputId).toBeNull()
      expect(manager.activeOutputId).toBeNull()
    })

    test('clears onstatechange handler from MIDIAccess', async () => {
      const midiAccess = createMockMIDIAccess()
      stubRequestMIDIAccess(midiAccess)
      await manager.init()

      expect(midiAccess.onstatechange).not.toBeNull()
      manager.dispose()
      expect(midiAccess.onstatechange).toBeNull()
    })
  })
})
