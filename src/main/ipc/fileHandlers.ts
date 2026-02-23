import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'
import { basename } from 'path'
import { IpcChannels, type MidiFileResult } from '../../shared/types'

export function registerFileHandlers(): void {
  ipcMain.handle(IpcChannels.OPEN_MIDI_FILE, async (): Promise<MidiFileResult | null> => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return null

    const result = await dialog.showOpenDialog(window, {
      title: 'Open MIDI File',
      filters: [{ name: 'MIDI Files', extensions: ['mid', 'midi'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const buffer = await readFile(filePath)

    return {
      fileName: basename(filePath),
      data: Array.from(buffer)
    }
  })
}
