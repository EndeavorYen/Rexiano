export type Locale = "en" | "zh-TW";

export type IconKey =
  | "activity"
  | "apple"
  | "badgeCheck"
  | "bookOpen"
  | "cable"
  | "circleCheck"
  | "download"
  | "fileText"
  | "gauge"
  | "headphones"
  | "keyboard"
  | "laptop"
  | "layers"
  | "library"
  | "monitorPlay"
  | "music"
  | "piano"
  | "route"
  | "settings"
  | "split"
  | "workflow";

type LocaleOption = {
  id: Locale;
  label: string;
  shortLabel: string;
  htmlLang: string;
};

type Link = {
  label: string;
  href: string;
};

type IconContent = {
  icon: IconKey;
};

type Feature = IconContent & {
  title: string;
  description: string;
  detail: string;
};

type FlowStep = IconContent & {
  label: string;
  title: string;
  description: string;
};

type Screenshot = {
  id: string;
  label: string;
  title: string;
  caption: string;
  image: string;
  alt: string;
};

type Platform = IconContent & {
  id: string;
  label: string;
  title: string;
  description: string;
  notes: string[];
};

type Resource = IconContent & {
  title: string;
  description: string;
  href: string;
};

export type SiteContent = {
  meta: {
    htmlLang: string;
    title: string;
    description: string;
    languageToggleLabel: string;
  };
  nav: {
    features: string;
    screenshots: string;
    start: string;
    docs: string;
    github: string;
  };
  hero: {
    lead: string;
    guideHref: string;
    actions: {
      download: string;
      guide: string;
      github: string;
    };
    facts: string[];
    note: string;
  };
  flow: {
    label: string;
    heading: string;
    items: FlowStep[];
  };
  features: {
    label: string;
    heading: string;
    description: string;
    items: Feature[];
  };
  screenshots: {
    label: string;
    heading: string;
    description: string;
    items: Screenshot[];
  };
  start: {
    label: string;
    heading: string;
    description: string;
    installationHref: string;
    actions: {
      releases: string;
      installation: string;
    };
    note: string;
  };
  platforms: {
    label: string;
    items: Platform[];
  };
  docs: {
    label: string;
    heading: string;
    description: string;
    resources: Resource[];
  };
  footer: {
    sentence: string;
    links: Link[];
  };
};

export const repoUrl = "https://github.com/EndeavorYen/Rexiano";
export const releasesUrl = `${repoUrl}/releases`;
export const issuesUrl = `${repoUrl}/issues`;
export const docsUrl = `${repoUrl}/tree/main/docs`;
export const docsBaseUrl = `${repoUrl}/blob/main`;

export const localeOptions = [
  {
    id: "en",
    label: "English",
    shortLabel: "EN",
    htmlLang: "en",
  },
  {
    id: "zh-TW",
    label: "繁體中文",
    shortLabel: "繁中",
    htmlLang: "zh-Hant-TW",
  },
] as const satisfies readonly LocaleOption[];

export function resolveLocale(language?: string): Locale {
  if (language?.toLowerCase().startsWith("zh")) {
    return "zh-TW";
  }

  return "en";
}

export function getSiteContent(locale: Locale): SiteContent {
  return siteContent[locale];
}

const siteContent: Record<Locale, SiteContent> = {
  en: {
    meta: {
      htmlLang: "en",
      title: "Rexiano - Open-source piano practice",
      description:
        "Rexiano is an open-source piano practice app with falling notes, sheet music, MIDI keyboard support, and focused practice tools.",
      languageToggleLabel: "Language",
    },
    nav: {
      features: "Features",
      screenshots: "Screenshots",
      start: "Start",
      docs: "Docs",
      github: "GitHub",
    },
    hero: {
      lead: "Free, open-source piano practice with falling notes, sheet music, MIDI keyboards, and focused practice tools.",
      guideHref: `${docsBaseUrl}/docs/user-guide-en.md`,
      actions: {
        download: "Download",
        guide: "Read the guide",
        github: "View on GitHub",
      },
      facts: ["React + Electron", "GPL-3.0", "Windows, macOS, Linux"],
      note: "A MIDI keyboard is optional for watching and listening. Wait mode scoring and live key feedback need MIDI input.",
    },
    flow: {
      label: "Practice flow",
      heading: "A short path from song choice to better reps",
      items: [
        {
          label: "01",
          title: "Start Playing",
          description:
            "Open the main entry point and choose whether to continue, browse, or import a MIDI file.",
          icon: "monitorPlay",
        },
        {
          label: "02",
          title: "Song Library and preview",
          description:
            "Pick a built-in song, recommendation, recent file, or imported MIDI, then review the level and tracks before practice.",
          icon: "library",
        },
        {
          label: "03",
          title: "Practice or play along",
          description:
            "Slow the song down, loop a phrase, isolate a hand, then let Wait mode pause until the right notes are played.",
          icon: "keyboard",
        },
      ],
    },
    features: {
      label: "Feature tour",
      heading: "Built for visual practice and real instruments",
      description:
        "Rexiano connects modern desktop app engineering with the concrete needs of piano learners: clear feedback, repeatable practice, and a path from play-along to reading notation.",
      items: [
        {
          title: "Falling notes with a real piano keyboard",
          description:
            "PixiJS renders a rhythm-game practice lane while the 88-key keyboard highlights notes in sync with playback.",
          detail:
            "Built for smooth, visual practice instead of static playback.",
          icon: "piano",
        },
        {
          title: "Sheet music beside the note lane",
          description:
            "Switch between falling notes, traditional staff notation, or a split view that keeps both ways of reading visible.",
          detail: "VexFlow powers notation and cursor sync.",
          icon: "split",
        },
        {
          title: "USB and Bluetooth MIDI practice",
          description:
            "Connect a MIDI keyboard for input, output, and Wait mode scoring. Rexiano uses Chromium's Web MIDI support through Electron.",
          detail:
            "Works with normal MIDI ports exposed by the operating system.",
          icon: "cable",
        },
        {
          title: "Focused practice modes",
          description:
            "Watch, Wait, and Free modes support speed control, A-B loops, hand or track selection, and score feedback. A MIDI input unlocks live scoring.",
          detail: "Designed for short daily practice sessions.",
          icon: "gauge",
        },
        {
          title: "Progress history and weak spots",
          description:
            "Session history, best scores, daily goals, and weak-note analysis help learners choose the next useful repetition.",
          detail: "Practice closes with a next-step loop.",
          icon: "activity",
        },
        {
          title: "Offline piano audio",
          description:
            "A bundled piano SoundFont gives Rexiano a real instrument voice, with a synthesizer fallback if the sample cannot load.",
          detail: "No CDN fonts or runtime sample downloads required.",
          icon: "headphones",
        },
      ],
    },
    screenshots: {
      label: "Screenshots",
      heading: "Real product screens",
      description:
        "The site uses the same screenshot assets as the README, so the product page stays tied to the app that users actually download.",
      items: [
        {
          id: "practice",
          label: "Practice",
          title: "Practice mode",
          caption:
            "Falling notes, keyboard feedback, transport controls, speed, loop, score, and track controls in one workspace.",
          image: "rexiano-practice.png",
          alt: "Rexiano practice workspace with falling notes, piano keyboard, and practice controls.",
        },
        {
          id: "library",
          label: "Library",
          title: "Song library",
          caption:
            "Browse built-in pieces, recommendations, recent files, grades, favorites, and import options before entering practice.",
          image: "rexiano-library.png",
          alt: "Rexiano song library with built-in songs, practice recommendations, and filters.",
        },
        {
          id: "split-sheet",
          label: "Split Sheet",
          title: "Notation plus falling notes",
          caption:
            "Use traditional staff notation and the falling-note lane together when a learner needs both reading models.",
          image: "rexiano-split-sheet.png",
          alt: "Rexiano split view showing sheet music above falling notes and the piano keyboard.",
        },
      ],
    },
    start: {
      label: "Getting started",
      heading: "Download, connect, and play",
      description:
        "Pick the package for your platform, then follow the installation guide for MIDI and first-run notes.",
      installationHref: `${docsBaseUrl}/docs/installation-en.md`,
      actions: {
        releases: "Latest releases",
        installation: "Installation guide",
      },
      note: "Public builds may show Windows SmartScreen or macOS Gatekeeper prompts when signing or notarization credentials are not active.",
    },
    platforms: {
      label: "Platform",
      items: [
        {
          id: "windows",
          label: "Windows",
          title: "Windows installer or portable build",
          description:
            "Download the latest installer or portable package from GitHub Releases.",
          notes: [
            "Use the NSIS installer for normal desktop shortcuts and file association.",
            "Use the portable zip when you want to try Rexiano without installation.",
            "Bluetooth MIDI may need a bridge driver depending on the keyboard and Windows setup.",
          ],
          icon: "laptop",
        },
        {
          id: "macos",
          label: "macOS",
          title: "macOS DMG",
          description:
            "Install from the DMG, then pair Bluetooth MIDI devices through Audio MIDI Setup when needed.",
          notes: [
            "macOS exposes paired BLE MIDI devices as normal MIDI ports.",
            "Unsigned builds may require the standard security confirmation on first launch.",
            "USB MIDI keyboards usually appear automatically.",
          ],
          icon: "apple",
        },
        {
          id: "linux",
          label: "Linux",
          title: "AppImage or deb package",
          description:
            "Use the AppImage for a portable run or the deb package for a desktop-integrated install.",
          notes: [
            "Most USB MIDI devices are exposed through ALSA.",
            "Bluetooth MIDI depends on the desktop stack and BlueZ pairing support.",
            "The AppImage is the fastest way to smoke-test a release.",
          ],
          icon: "settings",
        },
      ],
    },
    docs: {
      label: "Manual and developer docs",
      heading: "A compact hub for the repo",
      description:
        "Pages gives new users the map. The detailed manuals, design notes, and release guides stay in Markdown where contributors can review and update them with the code.",
      resources: [
        {
          title: "User Guide",
          description:
            "Practice modes, library flow, MIDI setup, and daily use.",
          href: `${docsBaseUrl}/docs/user-guide-en.md`,
          icon: "bookOpen",
        },
        {
          title: "Traditional Chinese Guide",
          description: "The full user manual in Traditional Chinese.",
          href: `${docsBaseUrl}/docs/user-guide.md`,
          icon: "fileText",
        },
        {
          title: "Installation",
          description:
            "Platform notes for Windows, macOS, Linux, and MIDI devices.",
          href: `${docsBaseUrl}/docs/installation-en.md`,
          icon: "download",
        },
        {
          title: "Architecture",
          description:
            "Renderer, engine, store, IPC, audio, MIDI, and release design.",
          href: `${docsBaseUrl}/docs/architecture.md`,
          icon: "workflow",
        },
        {
          title: "Design Document",
          description:
            "Technical history, system phases, data model, domain decisions, and testing strategy.",
          href: `${docsBaseUrl}/docs/DESIGN-en.md`,
          icon: "layers",
        },
        {
          title: "Roadmap",
          description: "Technical status tracking and completed phases.",
          href: `${docsBaseUrl}/docs/ROADMAP.md`,
          icon: "route",
        },
        {
          title: "MIDI Level Guide",
          description: "Song grade references and progression from L0 to L8.",
          href: `${docsBaseUrl}/docs/midi-level-guide.md`,
          icon: "music",
        },
        {
          title: "Release and Updates",
          description:
            "How Rexiano checks GitHub Releases from packaged builds.",
          href: `${docsBaseUrl}/docs/update-flow.md`,
          icon: "circleCheck",
        },
        {
          title: "Release Signing",
          description:
            "Windows and macOS signing policy, secrets, and unsigned fallback.",
          href: `${docsBaseUrl}/docs/release-signing.md`,
          icon: "circleCheck",
        },
        {
          title: "SoundFont Provenance",
          description:
            "Bundled piano sample source, license notes, and loader checks.",
          href: `${docsBaseUrl}/docs/soundfont-provenance.md`,
          icon: "headphones",
        },
        {
          title: "Contributing",
          description:
            "Local setup, development workflow, and project conventions.",
          href: `${docsBaseUrl}/CONTRIBUTING.md`,
          icon: "badgeCheck",
        },
      ],
    },
    footer: {
      sentence:
        "Built for Rex, shared with learners, and licensed under GPL-3.0.",
      links: [
        { label: "GitHub", href: repoUrl },
        { label: "Releases", href: releasesUrl },
        { label: "Issues", href: issuesUrl },
        { label: "Docs", href: docsUrl },
        { label: "License", href: `${docsBaseUrl}/LICENSE` },
      ],
    },
  },
  "zh-TW": {
    meta: {
      htmlLang: "zh-Hant-TW",
      title: "Rexiano - 開源鋼琴練習工具",
      description:
        "Rexiano 是開源鋼琴練習 app，支援下落音符、五線譜、MIDI 鍵盤與專注練習工具。",
      languageToggleLabel: "語言",
    },
    nav: {
      features: "功能",
      screenshots: "截圖",
      start: "開始",
      docs: "文件",
      github: "GitHub",
    },
    hero: {
      lead: "免費、開源的鋼琴練習工具，結合下落音符、五線譜、MIDI 鍵盤與專注練習流程。",
      guideHref: `${docsBaseUrl}/docs/user-guide.md`,
      actions: {
        download: "下載",
        guide: "閱讀指南",
        github: "查看 GitHub",
      },
      facts: ["React + Electron", "GPL-3.0", "Windows、macOS、Linux"],
      note: "不接 MIDI 鍵盤也能觀看與聆聽；Wait 模式評分與即時琴鍵回饋需要 MIDI 輸入。",
    },
    flow: {
      label: "練習流程",
      heading: "從選曲到有效重複的短路徑",
      items: [
        {
          label: "01",
          title: "Start Playing",
          description: "從首頁入口開始，選擇繼續練習、瀏覽曲庫或匯入 MIDI 檔。",
          icon: "monitorPlay",
        },
        {
          label: "02",
          title: "曲庫與預覽",
          description:
            "選擇內建曲目、推薦曲、最近檔案或匯入 MIDI，先確認等級與聲部再開始。",
          icon: "library",
        },
        {
          label: "03",
          title: "練習或跟彈",
          description:
            "放慢速度、循環片段、分手練習，讓 Wait 模式在正確音符被彈出前暫停。",
          icon: "keyboard",
        },
      ],
    },
    features: {
      label: "功能導覽",
      heading: "為視覺化練習與真實樂器而做",
      description:
        "Rexiano 把現代桌面 app 工程和鋼琴學習需求接在一起：清楚回饋、可重複練習，並能從跟彈逐步走向讀譜。",
      items: [
        {
          title: "下落音符與 88 鍵鋼琴",
          description:
            "PixiJS 負責流暢渲染節奏遊戲式練習軌，88 鍵鍵盤會跟播放同步高亮。",
          detail: "為流暢、直覺的視覺練習而設計。",
          icon: "piano",
        },
        {
          title: "五線譜並排練習",
          description:
            "可在下落音符、傳統五線譜、或上下分割視圖之間切換，保留兩種閱讀方式。",
          detail: "VexFlow 負責譜面與游標同步。",
          icon: "split",
        },
        {
          title: "USB 與藍牙 MIDI 練習",
          description:
            "連接 MIDI 鍵盤做輸入、輸出與 Wait 模式評分。Rexiano 透過 Electron 使用 Chromium 的 Web MIDI 支援。",
          detail: "適用於作業系統已辨識的標準 MIDI port。",
          icon: "cable",
        },
        {
          title: "專注練習模式",
          description:
            "Watch、Wait、Free 模式支援速度控制、A-B 循環、分手或分軌設定與分數回饋；即時評分需要 MIDI 輸入。",
          detail: "適合短時間、每天可重複的練習。",
          icon: "gauge",
        },
        {
          title: "進度紀錄與弱點分析",
          description:
            "歷史成績、最佳分數、每日目標與弱點音符分析，幫助學習者挑下一次最有價值的重複。",
          detail: "練習結束後接上下一步。",
          icon: "activity",
        },
        {
          title: "離線鋼琴音色",
          description:
            "內建鋼琴 SoundFont 提供真實樂器聲音；若 sample 載入失敗，仍保留合成器 fallback。",
          detail: "不依賴 CDN 字型或執行時 sample 下載。",
          icon: "headphones",
        },
      ],
    },
    screenshots: {
      label: "截圖",
      heading: "真實產品畫面",
      description:
        "這個頁面沿用 README 的截圖資產，讓產品頁和使用者實際下載到的 app 保持一致。",
      items: [
        {
          id: "practice",
          label: "練習",
          title: "練習模式",
          caption:
            "下落音符、鍵盤回饋、播放控制、速度、循環、分數與 track 控制集中在同一個工作區。",
          image: "rexiano-practice.png",
          alt: "Rexiano 練習畫面，包含下落音符、鋼琴鍵盤與練習控制。",
        },
        {
          id: "library",
          label: "曲庫",
          title: "曲庫",
          caption:
            "進入練習前，可瀏覽內建曲、推薦、最近檔案、等級、收藏與匯入選項。",
          image: "rexiano-library.png",
          alt: "Rexiano 曲庫畫面，包含內建曲、練習推薦與篩選器。",
        },
        {
          id: "split-sheet",
          label: "五線譜",
          title: "譜面加下落音符",
          caption: "當學習者需要同時看傳統譜面與視覺化節奏時，可使用分割視圖。",
          image: "rexiano-split-sheet.png",
          alt: "Rexiano 分割視圖，上方為五線譜，下方為下落音符與鋼琴鍵盤。",
        },
      ],
    },
    start: {
      label: "開始使用",
      heading: "下載、連接、開始彈",
      description:
        "依平台選擇安裝包，再依安裝指南處理 MIDI 與第一次啟動注意事項。",
      installationHref: `${docsBaseUrl}/docs/installation.md`,
      actions: {
        releases: "最新發佈",
        installation: "安裝指南",
      },
      note: "公開 build 在簽章或公證憑證未啟用時，可能會顯示 Windows SmartScreen 或 macOS Gatekeeper 提示。",
    },
    platforms: {
      label: "平台",
      items: [
        {
          id: "windows",
          label: "Windows",
          title: "Windows 安裝程式或免安裝版",
          description:
            "從 GitHub Releases 下載最新安裝程式或 portable package。",
          notes: [
            "一般安裝建議使用 NSIS installer，會建立桌面捷徑與檔案關聯。",
            "想先試用時，可使用 portable zip，不需要完整安裝。",
            "藍牙 MIDI 可能依鍵盤與 Windows 設定需要橋接 driver。",
          ],
          icon: "laptop",
        },
        {
          id: "macos",
          label: "macOS",
          title: "macOS DMG",
          description:
            "從 DMG 安裝，需要藍牙 MIDI 時可透過 Audio MIDI Setup 配對。",
          notes: [
            "macOS 會把已配對的 BLE MIDI 裝置暴露為一般 MIDI port。",
            "未簽章 build 第一次啟動時可能需要標準安全性確認。",
            "USB MIDI 鍵盤通常會自動出現。",
          ],
          icon: "apple",
        },
        {
          id: "linux",
          label: "Linux",
          title: "AppImage 或 deb 套件",
          description: "AppImage 適合免安裝試用，deb 則提供較完整桌面整合。",
          notes: [
            "多數 USB MIDI 裝置會透過 ALSA 出現。",
            "藍牙 MIDI 取決於桌面環境與 BlueZ 配對支援。",
            "AppImage 是最快速的 release smoke test 路徑。",
          ],
          icon: "settings",
        },
      ],
    },
    docs: {
      label: "使用手冊與開發文件",
      heading: "Repo 的雙語文件入口",
      description:
        "Pages 負責給新使用者地圖；詳細手冊、設計筆記與發佈指南仍保留在 Markdown，方便跟程式碼一起 review 和更新。",
      resources: [
        {
          title: "使用手冊",
          description: "練習模式、曲庫流程、MIDI 設定與日常使用。",
          href: `${docsBaseUrl}/docs/user-guide.md`,
          icon: "bookOpen",
        },
        {
          title: "English User Guide",
          description: "The full user manual in English.",
          href: `${docsBaseUrl}/docs/user-guide-en.md`,
          icon: "fileText",
        },
        {
          title: "安裝指南",
          description: "Windows、macOS、Linux 與 MIDI 裝置平台注意事項。",
          href: `${docsBaseUrl}/docs/installation.md`,
          icon: "download",
        },
        {
          title: "架構文件",
          description:
            "Renderer、engine、store、IPC、audio、MIDI 與 release 設計。",
          href: `${docsBaseUrl}/docs/architecture-zh.md`,
          icon: "workflow",
        },
        {
          title: "設計文件",
          description: "技術歷史、系統階段、資料模型、領域決策與測試策略。",
          href: `${docsBaseUrl}/docs/DESIGN.md`,
          icon: "layers",
        },
        {
          title: "Roadmap",
          description: "技術狀態追蹤與已完成階段。",
          href: `${docsBaseUrl}/docs/ROADMAP.md`,
          icon: "route",
        },
        {
          title: "MIDI 等級指南",
          description: "L0 到 L8 的曲目分級與學習進程參考。",
          href: `${docsBaseUrl}/docs/midi-level-guide.md`,
          icon: "music",
        },
        {
          title: "更新流程",
          description: "Rexiano packaged build 如何檢查 GitHub Releases。",
          href: `${docsBaseUrl}/docs/update-flow.md`,
          icon: "circleCheck",
        },
        {
          title: "發佈簽章",
          description:
            "Windows 與 macOS 簽章策略、secrets 與 unsigned fallback。",
          href: `${docsBaseUrl}/docs/release-signing.md`,
          icon: "circleCheck",
        },
        {
          title: "SoundFont 來源",
          description: "內建鋼琴 sample 來源、授權筆記與 loader 檢查。",
          href: `${docsBaseUrl}/docs/soundfont-provenance.md`,
          icon: "headphones",
        },
        {
          title: "貢獻指南",
          description: "本機開發、工作流程與專案慣例。",
          href: `${docsBaseUrl}/CONTRIBUTING.md`,
          icon: "badgeCheck",
        },
      ],
    },
    footer: {
      sentence: "為 Rex 製作，分享給所有學琴者，並以 GPL-3.0 授權。",
      links: [
        { label: "GitHub", href: repoUrl },
        { label: "Releases", href: releasesUrl },
        { label: "Issues", href: issuesUrl },
        { label: "文件", href: docsUrl },
        { label: "授權", href: `${docsBaseUrl}/LICENSE` },
      ],
    },
  },
};
