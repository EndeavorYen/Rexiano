import { useEffect, useCallback } from 'react'
import { useMidiDeviceStore } from '@renderer/stores/useMidiDeviceStore'
import { ConnectionStatus } from './ConnectionStatus'

export function DeviceSelector(): React.JSX.Element {
  const inputs = useMidiDeviceStore((s) => s.inputs)
  const outputs = useMidiDeviceStore((s) => s.outputs)
  const selectedInputId = useMidiDeviceStore((s) => s.selectedInputId)
  const selectedOutputId = useMidiDeviceStore((s) => s.selectedOutputId)
  const isConnected = useMidiDeviceStore((s) => s.isConnected)
  const connectionError = useMidiDeviceStore((s) => s.connectionError)
  const connect = useMidiDeviceStore((s) => s.connect)
  const disconnect = useMidiDeviceStore((s) => s.disconnect)
  const selectInput = useMidiDeviceStore((s) => s.selectInput)
  const selectOutput = useMidiDeviceStore((s) => s.selectOutput)

  // Auto-init MIDI access on mount
  useEffect(() => {
    connect()
  }, [connect])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value
      selectInput(val || null)
    },
    [selectInput]
  )

  const handleOutputChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value
      selectOutput(val || null)
    },
    [selectOutput]
  )

  const connectedInputs = inputs.filter((d) => d.state === 'connected')
  const connectedOutputs = outputs.filter((d) => d.state === 'connected')
  const noDevices = connectedInputs.length === 0 && connectedOutputs.length === 0

  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 text-xs font-body"
      style={{ color: 'var(--color-text)' }}
    >
      <ConnectionStatus />

      {noDevices && !connectionError ? (
        <span
          className="italic text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          No MIDI devices detected
        </span>
      ) : (
        <>
          {/* Input device select */}
          {connectedInputs.length > 0 && (
            <label className="flex items-center gap-1.5">
              <span style={{ color: 'var(--color-text-muted)' }}>In</span>
              <select
                value={selectedInputId ?? ''}
                onChange={handleInputChange}
                className="rounded px-2 py-1 text-xs outline-none cursor-pointer"
                style={{
                  background: 'var(--color-surface-alt)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
                aria-label="MIDI input device"
              >
                <option value="">-- None --</option>
                {connectedInputs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Output device select */}
          {connectedOutputs.length > 0 && (
            <label className="flex items-center gap-1.5">
              <span style={{ color: 'var(--color-text-muted)' }}>Out</span>
              <select
                value={selectedOutputId ?? ''}
                onChange={handleOutputChange}
                className="rounded px-2 py-1 text-xs outline-none cursor-pointer"
                style={{
                  background: 'var(--color-surface-alt)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
                aria-label="MIDI output device"
              >
                <option value="">-- None --</option>
                {connectedOutputs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}

      {/* Connect / Disconnect button */}
      {isConnected ? (
        <button
          onClick={disconnect}
          className="px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
          style={{
            background: 'var(--color-surface-alt)',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}
          title="Disconnect MIDI device"
          aria-label="Disconnect MIDI device"
        >
          Disconnect
        </button>
      ) : null}

      {/* Error message */}
      {connectionError && (
        <span
          className="text-xs truncate max-w-48"
          style={{ color: '#f87171' }}
          title={connectionError}
        >
          {connectionError}
        </span>
      )}
    </div>
  )
}
