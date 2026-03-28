<p align="center">
  <img src="docs/assets/rexiano-icon.png" alt="Rexiano icon" width="120" />
</p>

<h1 align="center">Rexiano</h1>

<p align="center">
  <b>開源鋼琴練習 App，結合下落音符、MIDI 鍵盤連接與高效率練習工具。</b><br />
  一位爸爸為兒子打造，並開放給所有想練琴的人。
</p>

<p align="center">
  <a href="https://github.com/nickhsu-endea/Rexiano/actions/workflows/ci.yml">
    <img src="https://github.com/nickhsu-endea/Rexiano/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://github.com/nickhsu-endea/Rexiano/actions/workflows/ci.yml">
    <img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/nickhsu-endea/COVERAGE_GIST_ID/raw/rexiano-coverage.json" alt="Coverage" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="GPL-3.0" />
  </a>
</p>

<p align="center">
  <b>繁體中文</b> | <a href="README.md">English</a>
</p>

---

## 為什麼是 Rexiano

Rexiano 專注一件事: 讓鋼琴練習更有成就感、也更能長期堅持。

- 透過 60 FPS 下落音符，快速建立節奏與雙手協調。
- USB / 藍牙 MIDI 鍵盤隨插即用，減少練習前準備時間。
- 慢速、循環、分手練習一次到位，專注攻克困難段落。
- 無帳號牆、無付費鎖定，打開就能練。

---

## 亮點功能

| 領域 | 你會得到 |
| --- | --- |
| 視覺訓練 | WebGL 下落音符、88 鍵即時高亮、左右手分色 |
| 練習引擎 | Watch / Wait / Free 模式、A-B 循環、分手練習、0.25x-2.0x 變速 |
| MIDI 連接 | USB + 藍牙 MIDI I/O、熱插拔偵測、自動重連、延音踏板（CC64） |
| 音訊系統 | SoundFont 鋼琴音色、主音量控制、合成器備援 |
| 曲庫與匯入 | 內建難度標記曲庫、支援拖放 `.mid` / `.midi` |
| 主題系統 | 四套內建主題，CSS Custom Properties 全域一致 |

---

## 安裝

請從 [Releases](https://github.com/nickhsu-endea/Rexiano/releases) 下載最新版本。

### Windows

1. 下載 `Rexiano-x.x.x-setup.exe`。
2. 執行安裝程式並完成設定。
3. 從開始選單或桌面捷徑啟動。

若看到 `Windows protected your PC`，因尚未程式碼簽章，請按 `More info` -> `Run anyway`。

### macOS

1. 下載 `Rexiano-x.x.x-arm64.dmg`（Apple Silicon）或 `Rexiano-x.x.x-x64.dmg`（Intel）。
2. 開啟 DMG 並拖曳到 `Applications`。
3. 首次啟動請右鍵 App -> `Open`，或到 `Privacy & Security` 允許。

### Linux

AppImage:

1. 下載 `Rexiano-x.x.x-x86_64.AppImage`。
2. 執行 `chmod +x Rexiano-*.AppImage`。
3. 以 `./Rexiano-*.AppImage` 啟動。

Debian / Ubuntu:

1. 下載 `Rexiano-x.x.x-amd64.deb`。
2. 執行 `sudo dpkg -i Rexiano-*.deb` 安裝。

藍牙 MIDI 詳細設定請看 [docs/guides/installation.zh-TW.md](docs/guides/installation.zh-TW.md)。

---

## 開發快速開始

### 前置需求

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- Git

### 本機啟動

```bash
git clone https://github.com/nickhsu-endea/Rexiano.git
cd Rexiano
pnpm install
pnpm dev
```

如需 sandbox 模式:

```bash
pnpm dev:sandbox
```

### 常用指令

| 指令 | 說明 |
| --- | --- |
| `pnpm dev` | 啟動 Electron 開發模式（HMR） |
| `pnpm build` | Typecheck + 產生正式版建置 |
| `pnpm test` | 執行 Vitest 全部測試 |
| `pnpm test:coverage` | 產生測試覆蓋率 |
| `pnpm test:e2e` | 建置後執行 Playwright Electron E2E |
| `pnpm test:visual` | 執行視覺回歸快照測試 |
| `pnpm lint` | 執行 ESLint |
| `pnpm typecheck` | 執行 TypeScript 型別檢查 |
| `pnpm format` | 使用 Prettier 格式化 |

---

## 架構速覽

```text
src/
  main/            Electron 主程序 + IPC handlers
  preload/         安全 context bridge
  renderer/src/
    engines/       核心邏輯（audio, midi, practice, falling notes）
    stores/        Zustand 狀態管理
    features/      React UI 功能模組
    themes/        主題 token
resources/         MIDI 曲庫與音色資源
build/             打包資源
```

---

## 技術堆疊

Electron 33、React 19、TypeScript 5.9、Tailwind CSS 4、Zustand 5、PixiJS 8、Web MIDI API、Web Audio API、SoundFont2、OpenSheetMusicDisplay、Vitest 4、Playwright、electron-builder。

---

## 文件導覽

| 文件 | 繁體中文 | English |
| --- | --- | --- |
| README | 目前頁面 | [README.md](README.md) |
| 使用手冊 | [docs/guides/user-guide.zh-TW.md](docs/guides/user-guide.zh-TW.md) | [docs/guides/user-guide.en.md](docs/guides/user-guide.en.md) |
| 安裝指南 | [docs/guides/installation.zh-TW.md](docs/guides/installation.zh-TW.md) | [docs/guides/installation.en.md](docs/guides/installation.en.md) |
| 架構文件 | [docs/architecture/architecture.zh-TW.md](docs/architecture/architecture.zh-TW.md) | [docs/architecture/architecture.en.md](docs/architecture/architecture.en.md) |
| 系統設計 | [docs/design/system-design.zh-TW.md](docs/design/system-design.zh-TW.md) | [docs/design/system-design.en.md](docs/design/system-design.en.md) |
| 開發路線圖 | [docs/project/roadmap.md](docs/project/roadmap.md) | [docs/project/roadmap.md](docs/project/roadmap.md) |

---

## 貢獻

歡迎貢獻。建議先閱讀 [docs/architecture/architecture.zh-TW.md](docs/architecture/architecture.zh-TW.md) 與 [docs/design/system-design.zh-TW.md](docs/design/system-design.zh-TW.md)，再進行較大的功能改動。

```bash
pnpm lint && pnpm typecheck && pnpm test
```

---

## 授權

本專案採用 [GNU GPL-3.0](LICENSE) 授權。

