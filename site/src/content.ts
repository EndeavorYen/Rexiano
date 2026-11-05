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
      open: string;
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
    guideHref: string;
    actions: {
      open: string;
      guide: string;
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

export const appUrl = "https://rexiano.vercel.app/";
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
      title: "Rexiano - Free piano practice in your browser",
      description:
        "Rexiano is a free, open-source piano practice web app with falling notes, sheet music, a Bluetooth piano that plays along, and 96 graded songs.",
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
      lead: "Free piano practice in your browser: falling notes, sheet music, and a Bluetooth piano that plays the song with you. Built by a dad for Rex.",
      guideHref: `${docsBaseUrl}/docs/user-guide-en.md`,
      actions: {
        open: "Open Rexiano",
        guide: "Read the guide",
        github: "View on GitHub",
      },
      facts: ["Runs in the browser", "Install as an app", "GPL-3.0"],
      note: "No piano is needed to watch and listen. Connect a Bluetooth piano for scoring, Wait mode, and the song playing on the piano.",
    },
    flow: {
      label: "Practice flow",
      heading: "From song choice to better repetitions",
      items: [
        {
          label: "01",
          title: "Pick a song",
          description:
            "Choose from 96 graded songs, follow the lesson path, or drop in your own MIDI or MusicXML file.",
          icon: "library",
        },
        {
          label: "02",
          title: "Watch first",
          description:
            "Hear the song and see the notes fall onto the keys, at full speed or slowed down.",
          icon: "monitorPlay",
        },
        {
          label: "03",
          title: "Play along in Wait mode",
          description:
            "Rexiano waits until the right notes are played, while the piano plays the hand you are not practising.",
          icon: "keyboard",
        },
      ],
    },
    features: {
      label: "Feature tour",
      heading: "Made for children learning a real piano",
      description:
        "Clear feedback, short repeatable practice, and a path from playing along to reading notation, on a computer or tablet.",
      items: [
        {
          title: "Falling notes on a real-looking keyboard",
          description:
            "Notes fall onto keys with true proportions, with a color for each hand and note names on the keys.",
          detail: "Smooth 60 FPS rendering with PixiJS.",
          icon: "piano",
        },
        {
          title: "Sheet music that moves with the notes",
          description:
            "Show the falling notes alone, or the staff above them, scrolling together so reading grows naturally.",
          detail: "Notation by VexFlow.",
          icon: "split",
        },
        {
          title: "A Bluetooth piano that plays along",
          description:
            "One connection both ways: your keys are scored, and the song plays on the piano itself — only the other hand in Wait mode.",
          detail: "Roland, Yamaha, Kawai, Casio and other BLE-MIDI pianos.",
          icon: "cable",
        },
        {
          title: "96 graded songs",
          description:
            "Folk songs, classics, and 62 teaching pieces: Beyer, Czerny, Burgmüller, the Anna Magdalena Notebook, sonatinas and Tchaikovsky.",
          detail: "Every built-in piece is in the public domain.",
          icon: "music",
        },
        {
          title: "Focused practice modes",
          description:
            "Watch, Wait and Free modes with speed control, loops, one-hand practice and gentle scoring.",
          detail: "Designed for short daily sessions.",
          icon: "gauge",
        },
        {
          title: "Works offline as an app",
          description:
            "Install it from Chrome or Edge; the songs and the piano sound are kept on the device.",
          detail: "Progress stays in the browser, with backup export.",
          icon: "headphones",
        },
      ],
    },
    screenshots: {
      label: "Screenshots",
      heading: "Real app screens",
      description:
        "These are the same screenshots as the README, captured from the app by an automated test.",
      items: [
        {
          id: "practice",
          label: "Practice",
          title: "Practice",
          caption:
            "Falling notes, keyboard feedback, Watch and Wait, speed and volume in one view.",
          image: "rexiano-practice.png",
          alt: "Rexiano practice view with falling notes, a piano keyboard and practice controls.",
        },
        {
          id: "library",
          label: "Library",
          title: "Song library",
          caption:
            "Daily goal, lesson path, search and filters across 96 built-in songs.",
          image: "rexiano-library.png",
          alt: "Rexiano song library with the lesson path and the song list.",
        },
        {
          id: "split-sheet",
          label: "Sheet music",
          title: "Sheet music plus falling notes",
          caption:
            "The staff and the falling notes scroll together when a learner needs both.",
          image: "rexiano-split-sheet.png",
          alt: "Rexiano showing sheet music above falling notes and the piano keyboard.",
        },
      ],
    },
    start: {
      label: "Getting started",
      heading: "Open, connect, and play",
      description:
        "Nothing to download: open Rexiano in your browser. Use Install in the address bar to keep it as an app for offline practice.",
      guideHref: `${docsBaseUrl}/docs/user-guide-en.md#5-connecting-a-bluetooth-piano`,
      actions: {
        open: "Open Rexiano",
        guide: "Connecting a piano",
      },
      note: "Computers and tablets only. Phones are not supported.",
    },
    platforms: {
      label: "Device",
      items: [
        {
          id: "computer",
          label: "Computer",
          title: "Windows, macOS or Linux",
          description:
            "Use Chrome or Edge, then press Connect piano and pick your piano.",
          notes: [
            "Bluetooth pianos connect straight from the browser; no pairing in system settings first.",
            "A piano already paired with the system can be picked under Other ways to connect.",
            "If the piano sounds late, move Line up the piano sound in Settings.",
          ],
          icon: "laptop",
        },
        {
          id: "android",
          label: "Android tablet",
          title: "Android tablet",
          description: "Use Chrome and connect the piano the same way.",
          notes: [
            "Install Rexiano from the Chrome menu to practice offline.",
            "Turn on Bluetooth and location if Chrome asks for them to find the piano.",
          ],
          icon: "monitorPlay",
        },
        {
          id: "ipad",
          label: "iPad",
          title: "iPad with Bluefy",
          description:
            "Safari and every other iPad browser lack Web Bluetooth, so open Rexiano in the free Bluefy browser to connect a piano.",
          notes: [
            "Without a piano, Safari works for watching and listening.",
            "Rexiano shows these steps when it is opened in Safari on an iPad.",
          ],
          icon: "apple",
        },
      ],
    },
    docs: {
      label: "Manual and developer docs",
      heading: "Where to read more",
      description:
        "The manuals, design notes and project history live in Markdown next to the code.",
      resources: [
        {
          title: "User Guide",
          description:
            "Practice modes, the library, connecting a piano, and daily use.",
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
          title: "What's New",
          description: "Changes in each version, in plain words.",
          href: `${docsBaseUrl}/CHANGELOG.md`,
          icon: "circleCheck",
        },
        {
          title: "Architecture",
          description:
            "Web platform layer, engines, stores, audio, MIDI and Bluetooth.",
          href: `${docsBaseUrl}/docs/architecture.md`,
          icon: "workflow",
        },
        {
          title: "Design Document",
          description:
            "Technical history, data model, domain decisions and testing strategy.",
          href: `${docsBaseUrl}/docs/DESIGN-en.md`,
          icon: "layers",
        },
        {
          title: "Roadmap",
          description: "What is done and what comes next.",
          href: `${docsBaseUrl}/docs/ROADMAP.md`,
          icon: "route",
        },
        {
          title: "Song Level Guide",
          description: "How songs are graded from L0 to L8.",
          href: `${docsBaseUrl}/docs/midi-level-guide.md`,
          icon: "music",
        },
        {
          title: "Contributing",
          description:
            "Local setup, development workflow and project conventions.",
          href: `${docsBaseUrl}/CONTRIBUTING.md`,
          icon: "badgeCheck",
        },
      ],
    },
    footer: {
      sentence:
        "Built for Rex, shared with learners, and licensed under GPL-3.0.",
      links: [
        { label: "Open Rexiano", href: appUrl },
        { label: "GitHub", href: repoUrl },
        { label: "Releases", href: releasesUrl },
        { label: "Issues", href: issuesUrl },
        { label: "License", href: `${docsBaseUrl}/LICENSE` },
      ],
    },
  },
  "zh-TW": {
    meta: {
      htmlLang: "zh-Hant-TW",
      title: "Rexiano - 打開瀏覽器就能練琴",
      description:
        "Rexiano 是免費開源的網頁鋼琴練習 App：下落音符、五線譜、會跟著彈的藍牙鋼琴，和 96 首分級曲目。",
      languageToggleLabel: "語言",
    },
    nav: {
      features: "特色",
      screenshots: "畫面",
      start: "開始",
      docs: "文件",
      github: "GitHub",
    },
    hero: {
      lead: "打開瀏覽器就能練琴：下落音符、五線譜，藍牙鋼琴還會跟你一起彈。一位爸爸為 Rex 打造。",
      guideHref: `${docsBaseUrl}/docs/user-guide.md`,
      actions: {
        open: "開始練琴",
        guide: "閱讀指南",
        github: "在 GitHub 查看",
      },
      facts: ["瀏覽器直接用", "可安裝成 App", "GPL-3.0"],
      note: "沒有鋼琴也能看和聽。連上藍牙鋼琴後，可以計分、用等待模式，曲子還會從鋼琴彈出來。",
    },
    flow: {
      label: "練琴流程",
      heading: "從選歌到越彈越好",
      items: [
        {
          label: "01",
          title: "選一首曲子",
          description:
            "96 首分級曲目、照課程路徑走，或拖入自己的 MIDI、MusicXML 檔。",
          icon: "library",
        },
        {
          label: "02",
          title: "先看先聽",
          description: "聽整首曲子、看音符落到琴鍵上，可以放慢速度。",
          icon: "monitorPlay",
        },
        {
          label: "03",
          title: "用等待模式跟彈",
          description: "彈對了才往下走；你沒在練的那一手，由鋼琴自己彈。",
          icon: "keyboard",
        },
      ],
    },
    features: {
      label: "特色",
      heading: "為正在學真鋼琴的孩子設計",
      description:
        "清楚的回饋、短而能重複的練習，從跟彈慢慢走到看譜；電腦和平板都能用。",
      items: [
        {
          title: "像真的一樣的琴鍵",
          description: "音符落到比例正確的琴鍵上，左右手不同顏色，鍵上有音名。",
          detail: "PixiJS 60 FPS 流暢繪製。",
          icon: "piano",
        },
        {
          title: "跟著音符走的五線譜",
          description:
            "只看下落音符，或五線譜在上、音符在下一起捲動，看譜能力慢慢長出來。",
          detail: "樂譜由 VexFlow 繪製。",
          icon: "split",
        },
        {
          title: "會跟著彈的藍牙鋼琴",
          description:
            "同一個連線雙向使用：彈的音會計分，曲子也從鋼琴彈出來；等待模式只彈另一手。",
          detail: "Roland、Yamaha、Kawai、Casio 等藍牙 MIDI 鋼琴。",
          icon: "cable",
        },
        {
          title: "96 首分級曲目",
          description:
            "童謠民謠、古典名曲，加上 62 首教材小品：拜耳、車爾尼、布格繆勒、《安娜·瑪德蓮娜筆記本》、小奏鳴曲和柴可夫斯基。",
          detail: "內建曲目都是公有領域作品。",
          icon: "music",
        },
        {
          title: "專注的練習模式",
          description:
            "觀看、等待、自由三種模式，可調速度、循環段落、分手練習。",
          detail: "適合每天短短練一下。",
          icon: "gauge",
        },
        {
          title: "裝成 App 也能離線",
          description:
            "在 Chrome 或 Edge 按「安裝」，曲子和鋼琴音色會存在裝置上。",
          detail: "練習紀錄存在瀏覽器，可匯出備份。",
          icon: "headphones",
        },
      ],
    },
    screenshots: {
      label: "畫面",
      heading: "實際的 App 畫面",
      description: "和 README 用的是同一組截圖，由自動化測試直接從 App 擷取。",
      items: [
        {
          id: "practice",
          label: "練習",
          title: "練習畫面",
          caption:
            "下落音符、琴鍵回饋、觀看與等待、速度和音量，都在同一個畫面。",
          image: "rexiano-practice-zh.png",
          alt: "Rexiano 練習畫面：下落音符、鋼琴鍵盤與練習控制。",
        },
        {
          id: "library",
          label: "曲庫",
          title: "曲庫",
          caption: "每日目標、課程路徑，以及 96 首內建曲目的搜尋與篩選。",
          image: "rexiano-library-zh.png",
          alt: "Rexiano 曲庫：課程路徑與曲目清單。",
        },
        {
          id: "split-sheet",
          label: "五線譜",
          title: "五線譜加下落音符",
          caption: "需要兩種看法時，五線譜和下落音符會一起捲動。",
          image: "rexiano-split-sheet-zh.png",
          alt: "Rexiano 同時顯示五線譜、下落音符與鋼琴鍵盤。",
        },
      ],
    },
    start: {
      label: "開始使用",
      heading: "打開、連琴、開始彈",
      description:
        "不用下載，用瀏覽器打開就好。在網址列按「安裝」，就能變成 App、沒網路也能練。",
      guideHref: `${docsBaseUrl}/docs/user-guide.md#5-連接藍牙鋼琴`,
      actions: {
        open: "開始練琴",
        guide: "怎麼連鋼琴",
      },
      note: "支援電腦和平板，不支援手機。",
    },
    platforms: {
      label: "裝置",
      items: [
        {
          id: "computer",
          label: "電腦",
          title: "Windows、macOS 或 Linux",
          description: "用 Chrome 或 Edge 開啟，按「連接鋼琴」再選你的鋼琴。",
          notes: [
            "藍牙鋼琴直接從瀏覽器連，不用先在系統設定配對。",
            "已經和系統配對好的鋼琴，可以在「其他連線方式」選。",
            "鋼琴聲音比畫面慢時，到設定調「鋼琴聲音對齊」。",
          ],
          icon: "laptop",
        },
        {
          id: "android",
          label: "Android 平板",
          title: "Android 平板",
          description: "用 Chrome 開啟，連鋼琴的方式一樣。",
          notes: [
            "從 Chrome 選單安裝 Rexiano，就能離線練。",
            "Chrome 要求開啟藍牙和定位時請允許，才找得到鋼琴。",
          ],
          icon: "monitorPlay",
        },
        {
          id: "ipad",
          label: "iPad",
          title: "iPad 用 Bluefy",
          description:
            "iPad 上的 Safari 和其他瀏覽器都沒有 Web Bluetooth，請用免費的 Bluefy 瀏覽器開啟 Rexiano 來連鋼琴。",
          notes: [
            "不連鋼琴的話，用 Safari 看和聽也可以。",
            "在 iPad 的 Safari 打開 Rexiano 時，也會顯示這些步驟。",
          ],
          icon: "apple",
        },
      ],
    },
    docs: {
      label: "手冊與開發文件",
      heading: "想知道更多",
      description: "使用手冊、設計文件和專案歷程都以 Markdown 放在程式碼旁邊。",
      resources: [
        {
          title: "使用手冊",
          description: "練習模式、曲庫、連接鋼琴與日常使用。",
          href: `${docsBaseUrl}/docs/user-guide.md`,
          icon: "bookOpen",
        },
        {
          title: "English Guide",
          description: "The full user manual in English.",
          href: `${docsBaseUrl}/docs/user-guide-en.md`,
          icon: "fileText",
        },
        {
          title: "更新紀錄",
          description: "每一版改了什麼，用白話寫。",
          href: `${docsBaseUrl}/CHANGELOG.md`,
          icon: "circleCheck",
        },
        {
          title: "架構文件",
          description: "網頁平台層、引擎、狀態、音訊、MIDI 與藍牙。",
          href: `${docsBaseUrl}/docs/architecture-zh.md`,
          icon: "workflow",
        },
        {
          title: "系統設計",
          description: "技術歷程、資料模型、領域決策與測試策略。",
          href: `${docsBaseUrl}/docs/DESIGN.md`,
          icon: "layers",
        },
        {
          title: "開發路線圖",
          description: "做完了什麼、接下來做什麼。",
          href: `${docsBaseUrl}/docs/ROADMAP.md`,
          icon: "route",
        },
        {
          title: "曲目分級指引",
          description: "曲子怎麼從 L0 分到 L8。",
          href: `${docsBaseUrl}/docs/midi-level-guide.md`,
          icon: "music",
        },
        {
          title: "貢獻指南",
          description: "本機設定、開發流程與專案慣例。",
          href: `${docsBaseUrl}/CONTRIBUTING.md`,
          icon: "badgeCheck",
        },
      ],
    },
    footer: {
      sentence: "為 Rex 打造，分享給所有學琴的人，以 GPL-3.0 授權。",
      links: [
        { label: "開始練琴", href: appUrl },
        { label: "GitHub", href: repoUrl },
        { label: "Releases", href: releasesUrl },
        { label: "Issues", href: issuesUrl },
        { label: "授權", href: `${docsBaseUrl}/LICENSE` },
      ],
    },
  },
};
