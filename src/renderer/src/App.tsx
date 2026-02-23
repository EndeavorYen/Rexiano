import { useState } from 'react'
import { parseMidiFile } from './engines/midi/MidiFileParser'
import type { ParsedSong } from './engines/midi/types'
import { PianoKeyboard } from './features/fallingNotes/PianoKeyboard'

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function App(): React.JSX.Element {
  const [song, setSong] = useState<ParsedSong | null>(null)

  const handleOpenFile = async (): Promise<void> => {
    const result = await window.api.openMidiFile()
    if (result) {
      const parsed = parseMidiFile(result.fileName, result.data)
      setSong(parsed)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {!song ? (
          <>
            <h1 className="text-4xl font-bold mb-2">Rexiano</h1>
            <p className="text-lg text-stone-500 mb-8">
              A modern, open-source piano practice application
            </p>
            <button
              onClick={handleOpenFile}
              className="px-6 py-3 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors cursor-pointer"
            >
              Open MIDI File
            </button>
          </>
        ) : (
          <>
            {/* Song info bar */}
            <div className="w-full max-w-3xl mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{song.fileName}</h2>
                  <p className="text-sm text-stone-500">
                    {formatDuration(song.duration)} &middot; {song.noteCount} notes &middot;{' '}
                    {song.tracks.length} track{song.tracks.length > 1 ? 's' : ''}
                    {song.tempos.length > 0 && ` \u00B7 ${song.tempos[0].bpm} BPM`}
                  </p>
                </div>
                <button
                  onClick={handleOpenFile}
                  className="px-4 py-2 text-sm bg-stone-200 rounded-lg hover:bg-stone-300 transition-colors cursor-pointer"
                >
                  Open Another
                </button>
              </div>

              {/* Track list */}
              <div className="space-y-2">
                {song.tracks.map((track, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-stone-200"
                  >
                    <div>
                      <p className="text-sm font-medium">{track.name}</p>
                      <p className="text-xs text-stone-400">
                        {track.instrument} &middot; Ch {track.channel + 1}
                      </p>
                    </div>
                    <span className="text-xs text-stone-500 tabular-nums">
                      {track.notes.length} notes
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Piano keyboard (always visible at bottom) */}
      <div className="border-t border-stone-300 bg-stone-100">
        <PianoKeyboard height={100} />
      </div>
    </div>
  )
}

export default App
