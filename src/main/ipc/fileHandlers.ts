import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { readFile } from 'fs/promises'
import { basename, join, resolve } from 'path'
import { existsSync } from 'fs'
import { IpcChannels, type MidiFileResult, type SoundFontResult } from '../../shared/types'

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

  ipcMain.handle(
    IpcChannels.LOAD_SOUNDFONT,
    async (_event, fileName?: string): Promise<SoundFontResult | null> => {
      const sfName = fileName ?? 'default.sf2'

      // Look in resources/ directory (packaged or dev)
      const resourcesDir = app.isPackaged
        ? join(process.resourcesPath, 'resources')
        : join(app.getAppPath(), 'resources')

      // Prevent path traversal: resolve and verify the path stays within resourcesDir
      const sfPath = resolve(resourcesDir, sfName)
      if (!sfPath.startsWith(resolve(resourcesDir))) {
        console.warn(`SoundFont path traversal blocked: ${sfName}`)
        return null
      }

      if (!existsSync(sfPath)) {
        console.warn(`SoundFont not found: ${sfPath}`)
        return null
      }

      const buffer = await readFile(sfPath)
      return {
        data: Array.from(buffer),
        fileName: sfName,
      }
    }
  )
}
