<img src="docs/figure/Rexiano_icon.png" alt="Rexiano icon" width="120" align="right">

# Rexiano

[![CI](https://github.com/nickhsu-endea/Rexiano/actions/workflows/ci.yml/badge.svg)](https://github.com/nickhsu-endea/Rexiano/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/nickhsu-endea/COVERAGE_GIST_ID/raw/rexiano-coverage.json)](https://github.com/nickhsu-endea/Rexiano/actions/workflows/ci.yml)

免費、開源的鋼琴練習應用程式——有下落音符、MIDI 鍵盤支援和多種練習工具。一位爸爸為兒子而建，開放給所有人。

**繁體中文** | [English](README.md)

<!-- TODO: 新增應用程式截圖或 GIF -->
<!-- ![Rexiano 截圖](docs/screenshot.png) -->

---

## 功能特色

**視覺學習**

- 下落音符顯示（節奏遊戲風格），以 WebGL 60 FPS 渲染
- 88 鍵鋼琴鍵盤即時高亮
- 不同聲部（手）使用不同顏色

**音頻播放**

- SoundFont 鋼琴音色播放（Web Audio API）
- 主音量控制
- SoundFont 載入失敗時退回合成器音色

**MIDI 連接**

- USB 和藍牙 MIDI 鍵盤輸入/輸出
- 熱插拔偵測（執行中也能接連/斷開裝置）
- 自動重連上次使用的裝置
- 延音踏板（CC64）支援

**練習模式**

- **觀看模式（Watch）** — 坐著觀察播放
- **等待模式（Wait）** — 播放在每個音符處暫停，等你彈對才繼續
- **自由模式（Free）** — 跟著音樂隨意彈奏
- 速度調整（0.25x 至 2.0x）
- A-B 段落循環，反覆練習難點
- 分手練習（選擇練習哪些聲部）
- 即時評分：準確率與連擊追蹤

**主題**

- 四套內建主題：薰衣草（Lavender）、海洋（Ocean）、水蜜桃（Peach）、午夜（Midnight，深色）
- 所有色彩統一透過 CSS Custom Properties 驅動

**檔案管理**

- 匯入任何 `.mid` / `.midi` 檔案
- 拖放支援
- 內建曲庫，含難度評級和 18 首曲目

---

## 安裝

從 **[Releases 頁面](https://github.com/nickhsu-endea/Rexiano/releases)** 下載對應平台的安裝檔：

| 作業系統 | 檔案                      | 備注                                                   |
| -------- | ------------------------- | ------------------------------------------------------ |
| Windows  | `rexiano-x.x.x-setup.exe` | 若 SmartScreen 出現警告，點選「更多資訊」→「仍要執行」 |
| macOS    | `rexiano-x.x.x.dmg`       | 拖入應用程式；首次開啟請在「隱私權與安全性」中允許     |
| Linux    | `rexiano-x.x.x.AppImage`  | `chmod +x` 後直接執行                                  |

完整安裝說明請參閱 **[安裝指南](docs/installation.md)**。

### 藍牙 MIDI 設定

Rexiano 支援在 Windows、macOS 和 Linux 上直接連接藍牙 MIDI 鍵盤，無需安裝任何橋接軟體：

1. 開啟鍵盤的藍牙功能
2. 在作業系統的藍牙設定中配對你的鍵盤
3. 開啟 Rexiano，在裝置選擇器中選擇你的鍵盤

詳細說明請參閱 **[安裝指南 — 藍牙 MIDI 鍵盤](docs/installation.md)**。

---

## 開發

### 前置需求

- [Node.js](https://nodejs.org/) 20 或更新版本
- [pnpm](https://pnpm.io/) 9 或更新版本
- Git

### 快速開始

```bash
# 複製專案
git clone https://github.com/nickhsu-endea/Rexiano.git
cd Rexiano

# 安裝相依套件
pnpm install

# 啟動開發模式（含熱模組替換）
pnpm dev
```

### 常用指令

| 指令               | 說明                               |
| ------------------ | ---------------------------------- |
| `pnpm dev`         | 以開發模式啟動 Electron（含 HMR）  |
| `pnpm build`       | 型別檢查 + 正式版建置              |
| `pnpm build:win`   | 建置 Windows 安裝檔（.exe）        |
| `pnpm build:mac`   | 建置 macOS 磁碟映像（.dmg）        |
| `pnpm build:linux` | 建置 Linux 套件（.AppImage、.deb） |
| `pnpm test`             | 執行所有 Vitest 測試               |
| `pnpm test:coverage`   | 執行測試並產生覆蓋率報告           |
| `pnpm test:watch`      | 測試 Watch 模式                    |
| `pnpm lint`        | 執行 ESLint                        |
| `pnpm typecheck`   | 執行 TypeScript 型別檢查           |
| `pnpm format`      | 以 Prettier 格式化程式碼           |

### 專案結構

```
src/
  main/                  # Electron 主程序
    ipc/                 # IPC 處理器（檔案對話框、MIDI 權限）
  preload/               # Context bridge（安全 IPC）
  renderer/src/
    engines/             # 純邏輯層（無 React 依賴）
      audio/             # Web Audio API + SoundFont
      fallingNotes/      # PixiJS 渲染 + ticker 迴圈
      midi/              # MIDI 裝置管理 + 解析
      practice/          # Wait 模式、評分、速度、循環
    stores/              # Zustand 狀態管理
    features/            # React UI 元件
    themes/              # 主題 token（CSS Custom Properties）
resources/               # SoundFont 檔案、內建 MIDI 曲目
build/                   # Electron-builder 資源（圖示、權限）
```

---

## 技術堆疊

| 層級        | 技術                                          | 用途                          |
| ----------- | --------------------------------------------- | ----------------------------- |
| 桌面框架    | Electron 33                                   | 跨平台視窗、系統 API、打包    |
| 建置工具    | electron-vite 5 + Vite 7                      | 快速 HMR、模組打包            |
| UI 框架     | React 19 + TypeScript 5.9                     | 元件化介面                    |
| 樣式        | Tailwind CSS 4 + CSS Custom Properties        | 主題系統                      |
| 狀態管理    | Zustand 5                                     | 輕量全域狀態（8 個 store）    |
| Canvas 渲染 | PixiJS 8                                      | WebGL Canvas，60 FPS 下落音符 |
| MIDI        | @tonejs/midi + Web MIDI API                   | 檔案解析 + 即時裝置 I/O       |
| 音頻        | Web Audio API + SoundFont (soundfont2)        | 鋼琴音色播放                  |
| 字型        | @fontsource (Nunito, DM Sans, JetBrains Mono) | 離線字型，無 CDN              |
| 測試        | Vitest 4 + Playwright 1.58                    | 單元測試 + E2E + 視覺回歸測試 |
| 打包        | electron-builder 26                           | Win / Mac / Linux 安裝檔      |

---

## 開發進度

| 版本   | 里程碑                                | 狀態      |
| ------ | ------------------------------------- | --------- |
| v0.1.0 | 專案骨架 + 下落音符 + 主題系統        | ✅ 完成   |
| v0.2.0 | 音頻播放（SoundFont）                 | ✅ 完成   |
| v0.3.0 | MIDI 鍵盤連接（USB + BLE）            | ✅ 完成   |
| v0.4.0 | 練習模式（等待 / 速度 / 循環 / 評分） | ✅ 完成   |
| v0.4.1 | 兒童可用性增強                        | 🔲 進行中 |
| v0.5.0 | 五線譜顯示                            | 🔲 規劃中 |
| v1.0.0 | 正式版（編輯器 + 打包）               | 🔲 規劃中 |

詳細任務清單請見 **[ROADMAP.md](docs/ROADMAP.md)**。

---

## 文件

| 文件           | 繁體中文                                           | English                                            |
| -------------- | -------------------------------------------------- | -------------------------------------------------- |
| **README**     | 目前頁面                                           | [README.md](README.md)                             |
| **使用手冊**   | [docs/user-guide.md](docs/user-guide.md)           | [docs/user-guide-en.md](docs/user-guide-en.md)     |
| **安裝指南**   | [docs/installation.md](docs/installation.md)       | [docs/installation-en.md](docs/installation-en.md) |
| **架構文件**   | [docs/architecture-zh.md](docs/architecture-zh.md) | [docs/architecture.md](docs/architecture.md)       |
| **系統設計**   | [docs/DESIGN.md](docs/DESIGN.md)                   | [docs/DESIGN-en.md](docs/DESIGN-en.md)             |
| **開發路線圖** | [docs/ROADMAP.md](docs/ROADMAP.md)                 | [docs/ROADMAP.md](docs/ROADMAP.md)                 |

---

## 授權

Rexiano 以 [GNU General Public License v3.0](LICENSE) 釋出。

你可以自由使用、修改和散佈此軟體，但若散佈修改版本，必須以相同授權開放原始碼。

---

## 貢獻

歡迎任何形式的貢獻！在寫程式碼之前，請先閱讀[架構文件](docs/architecture-zh.md)和[系統設計文件](docs/DESIGN.md)，並遵循三層架構（engines → stores → features）。

```bash
# 送出 PR 前請先執行驗證
pnpm lint && pnpm typecheck && pnpm test
```

---

## 致謝

- 為學鋼琴的 Rex 而建，以愛打造
- 感謝 [Synthesia](https://www.synthesia.app/) 的啟發
- 感謝讓這個專案成為可能的所有開源工具的作者們
