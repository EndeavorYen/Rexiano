# Rexiano 安裝指南

> **版本**: 0.4.1 | **最後更新**: 2026-03
>
> 其他語言：[English](./installation-en.md)

---

## 目錄

1. [系統需求](#1-系統需求)
2. [Windows 安裝](#2-windows-安裝)
3. [macOS 安裝](#3-macos-安裝)
4. [Linux 安裝](#4-linux-安裝)
5. [首次啟動注意事項](#5-首次啟動注意事項)
6. [解除安裝](#6-解除安裝)
7. [開發環境安裝（給開發者）](#7-開發環境安裝給開發者)

---

## 1. 系統需求

| 項目          | 最低需求                             | 建議規格  |
| ------------- | ------------------------------------ | --------- |
| 作業系統      | Windows 10 / macOS 12 / Ubuntu 20.04 | 最新版本  |
| 記憶體（RAM） | 4 GB                                 | 8 GB 以上 |
| 儲存空間      | 200 MB                               | 500 MB    |
| 顯示卡        | 支援 OpenGL 2.0 的 GPU               | 獨立 GPU  |
| 網路          | 不需要（完全離線運行）               | —         |

> **注意**：Rexiano 使用 WebGL 渲染下落音符，若顯示卡驅動程式過舊可能影響效能。建議更新到最新驅動程式。

---

## 2. Windows 安裝

### 步驟

1. 前往 [GitHub Releases 頁面](https://github.com/nickhsu-endea/Rexiano/releases) 下載最新版本
2. 下載 `rexiano-x.x.x-setup.exe` 檔案
3. 雙擊執行安裝程式

### 處理 Windows SmartScreen 警告

首次安裝時，Windows Defender SmartScreen 可能會顯示「Windows 已保護您的電腦」的警告畫面。**這不代表 Rexiano 是惡意軟體。**

原因：Rexiano 目前尚未購買 Windows 程式碼簽章憑證（EV Code Signing Certificate），SmartScreen 會對未簽署的應用程式顯示警告。Rexiano 是完全開源的軟體，你可以在 [GitHub](https://github.com/nickhsu-endea/Rexiano) 查看所有原始碼。

處理方式：

1. 看到警告時，點選「**更多資訊**」
2. 點選「**仍要執行**」
3. 按照安裝精靈指引完成安裝

### 安裝完成

安裝完成後，桌面會出現 Rexiano 的捷徑。你也可以在「開始選單」中找到 Rexiano。

---

## 3. macOS 安裝

### 步驟

1. 前往 [GitHub Releases 頁面](https://github.com/nickhsu-endea/Rexiano/releases) 下載最新版本
2. 下載 `rexiano-x.x.x.dmg` 檔案
3. 雙擊打開 DMG 檔案
4. 將 **Rexiano** 圖示拖放到「**應用程式**」資料夾

### 處理 macOS 安全性警告

首次開啟時，macOS 可能顯示「**無法驗證開發者**」警告（Gatekeeper 機制）。

處理方式：

1. 前往「**系統設定**」>「**隱私權與安全性**」
2. 滾到底部，找到關於 Rexiano 的提示
3. 點選「**仍然開啟**」

> macOS 14 以後的版本：前往「系統設定」>「一般」>「VPN 與裝置管理」，或在 Finder 中按住 Control 鍵點選 Rexiano，選擇「開啟」。

### Apple Silicon (M1/M2/M3/M4)

Rexiano 原生支援 Apple Silicon，不需要 Rosetta 轉譯層。DMG 內已包含通用二進位（Universal Binary）。

---

## 4. Linux 安裝

Rexiano 提供三種 Linux 安裝格式，選擇適合你的發行版的格式即可。

### 4.1 AppImage（推薦，免安裝）

AppImage 格式無需安裝，可在任何 Linux 發行版上直接執行。

```bash
# 1. 下載 AppImage
wget https://github.com/nickhsu-endea/Rexiano/releases/latest/download/rexiano-x.x.x.AppImage

# 2. 賦予執行權限
chmod +x rexiano-x.x.x.AppImage

# 3. 執行
./rexiano-x.x.x.AppImage
```

若無法執行，可能需要安裝 FUSE：

```bash
# Ubuntu / Debian
sudo apt install fuse libfuse2

# Fedora
sudo dnf install fuse fuse-libs
```

### 4.2 Debian / Ubuntu（.deb）

```bash
# 下載並安裝
wget https://github.com/nickhsu-endea/Rexiano/releases/latest/download/rexiano-x.x.x.deb
sudo dpkg -i rexiano-x.x.x.deb

# 如果有相依套件問題
sudo apt-get install -f
```

安裝完成後，可在應用程式選單中找到 Rexiano，或在終端機中執行 `rexiano`。

### 4.3 RPM（Fedora / RHEL / openSUSE）

```bash
# Fedora / RHEL
sudo rpm -i rexiano-x.x.x.rpm

# openSUSE
sudo zypper install rexiano-x.x.x.rpm
```

### 4.4 Linux 上的 MIDI 支援

在 Linux 上使用 USB MIDI 鍵盤前，確認已載入 ALSA 驅動：

```bash
# 確認 MIDI 裝置是否被偵測到
aconnect -l

# 若 ALSA 未偵測到裝置，嘗試載入模組
sudo modprobe snd-usb-audio
```

---

## 5. 首次啟動注意事項

### 新手引導

第一次啟動 Rexiano 時，會出現一個 4 步驟的引導教學，帶你快速了解基本操作。跟著走就好，大約 1 分鐘即可完成。

如果想再看一次引導，可以前往「設定」>「重新觀看引導」。

### 音頻載入

Rexiano 內建鋼琴音色（SoundFont，約 6 MB），儲存在應用程式內部，**不需要網路連線**。

首次播放歌曲時，SoundFont 會在背景載入（約需 3-5 秒）。載入期間，TransportBar 上會顯示旋轉圖示。載入完成後，音色會保留在記憶體中，後續播放不再有等待時間。

若音色載入失敗，Rexiano 會自動退回正弦波合成音色（聽起來像電子音），仍可正常使用所有功能。

### MIDI 鍵盤

- **USB 連接**：插上鍵盤後，Rexiano 應可自動偵測。若未偵測到，點選裝置選擇器重新整理
- **藍牙連接**：需先在作業系統層級完成配對，詳見[使用手冊 — 連接 MIDI 鍵盤](./user-guide.md#5-連接-midi-鍵盤)

---

## 6. 解除安裝

### Windows

1. 開啟「設定」>「應用程式」>「已安裝的應用程式」
2. 搜尋「Rexiano」
3. 點選「解除安裝」

解除安裝後，使用者資料（練習進度、設定）儲存在以下位置，需手動刪除：

- Windows：`%APPDATA%\Rexiano`（例如 `C:\Users\你的名字\AppData\Roaming\Rexiano`）

### macOS

1. 將「應用程式」資料夾中的 Rexiano 拖到垃圾桶
2. 清空垃圾桶

使用者資料位於：`~/Library/Application Support/Rexiano`

### Linux（AppImage）

直接刪除 `.AppImage` 檔案即可。使用者資料位於：`~/.config/Rexiano`

### Linux（.deb）

```bash
sudo dpkg -r rexiano
# 或完整清除（含設定檔）
sudo dpkg -P rexiano
```

---

## 7. 開發環境安裝（給開發者）

如果你想從原始碼建置 Rexiano，或參與開發，請按照以下步驟操作。

### 前置需求

| 工具    | 版本     | 安裝方式                            |
| ------- | -------- | ----------------------------------- |
| Node.js | 20+      | [nodejs.org](https://nodejs.org/)   |
| pnpm    | 9+       | `npm install -g pnpm`               |
| Git     | 任意版本 | [git-scm.com](https://git-scm.com/) |

### 複製並啟動

```bash
# 複製專案
git clone https://github.com/nickhsu-endea/Rexiano.git
cd Rexiano

# 安裝相依套件
pnpm install

# 啟動開發模式（Electron + HMR）
pnpm dev
```

### 常用指令

```bash
pnpm dev          # 開發模式（熱模組替換）
pnpm build        # 產出正式版安裝檔
pnpm lint         # ESLint 檢查
pnpm typecheck    # TypeScript 型別檢查
pnpm test         # 執行所有測試
pnpm test:watch   # 測試 Watch 模式
```

### WSL2 開發注意事項（Windows）

在 WSL2 環境中執行 Electron 需要以下設定：

```bash
# VS Code 終端可能設定了這個環境變數，需要取消
unset ELECTRON_RUN_AS_NODE

# Chromium 在 WSL2 中需要停用 sandbox
NO_SANDBOX=1 pnpm dev
```

---

_Rexiano 是開源免費軟體，以 GPL-3.0 授權釋出。_
_原始碼：[github.com/nickhsu-endea/Rexiano](https://github.com/nickhsu-endea/Rexiano)_
