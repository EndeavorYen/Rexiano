# Phase 7 — 五線譜顯示：詳細技術設計文件

> **日期**: 2026-03-01
> **狀態**: 設計稿
> **前置依賴**: Phase 4（音頻播放同步）
> **目標版本**: v0.5.0

---

## 目錄

1. [方案確認：VexFlow](#1-方案確認vexflow)
2. [MidiToNotation.ts 演算法設計](#2-miditonotationts-演算法設計)
3. [資料模型](#3-資料模型)
4. [UI 架構與同步機制](#4-ui-架構與同步機制)
5. [任務分解](#5-任務分解)
6. [風險評估](#6-風險評估)

---

## 1. 方案確認：VexFlow

### 1.1 為何選擇 VexFlow

| 評估項目        | VexFlow                                | OSMD                        | abcjs                |
| --------------- | -------------------------------------- | --------------------------- | -------------------- |
| 輸入格式        | 程式化 API（StaveNote 物件）           | MusicXML                    | ABC Notation         |
| 自訂彈性        | **極高** — 逐音符控制渲染              | 中等 — MusicXML 驅動        | 低                   |
| 與 MIDI 整合    | **直接** — 我們控制轉換邏輯            | 需先轉 MusicXML（額外步驟） | 需先轉 ABC（非主流） |
| 互動性          | **支援** — 可標記、高亮、動態更新      | 有限                        | 有限                 |
| 套件大小        | ~300KB gzipped                         | ~1.5MB                      | ~200KB               |
| 社群活躍度      | 高（GitHub 3.8k stars，持續更新至 v5） | 中                          | 低                   |
| TypeScript 支援 | **原生**（v5 以 TypeScript 撰寫）      | 有型別定義                  | 有限                 |
| 授權            | MIT                                    | AGPL-3.0                    | MIT                  |

**核心決策理由**：

1. **Rexiano 的資料來源是 MIDI**，不是 MusicXML。使用 VexFlow 可以跳過「MIDI → MusicXML → 渲染」的中間步驟，直接「MIDI → 量化 → VexFlow StaveNote → 渲染」。
2. **互動需求高**：需要游標跟隨、當前音符高亮、即時捲動等互動功能，VexFlow 的程式化 API 能精確控制每個元素。
3. **OSMD 的 AGPL 授權**與 Rexiano 的 MIT 授權不相容。
4. **VexFlow 5 已原生支援 TypeScript**，與專案技術棧完美匹配。

### 1.2 VexFlow 5 API 速覽

VexFlow 提供兩層 API：

**低階 API**（精確控制）：

```typescript
import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Accidental,
  Beam,
  Dot,
  StaveTie,
} from "vexflow";

// 1. 建立渲染器（SVG 模式）
const renderer = new Renderer(divElement, Renderer.Backends.SVG);
renderer.resize(width, height);
const context = renderer.getContext();

// 2. 建立五線譜
const stave = new Stave(x, y, width);
stave.addClef("treble").addTimeSignature("4/4").addKeySignature("C");
stave.setContext(context).draw();

// 3. 建立音符
const notes = [
  new StaveNote({ keys: ["c/4"], duration: "q" }), // 四分音符 C4
  new StaveNote({ keys: ["d/4"], duration: "8" }), // 八分音符 D4
  new StaveNote({ keys: ["e/4", "g/4", "b/4"], duration: "h" }), // 和弦（二分音符）
  new StaveNote({ keys: ["b/4"], duration: "qr" }), // 四分休止符
];

// 4. 附點音符
Dot.buildAndAttach([notes[1]]); // 將 D4 變成附點八分音符

// 5. 升降記號
notes[0].addModifier(new Accidental("#")); // C#4

// 6. 建立聲部（Voice）+ 格式化 + 繪製
const voice = new Voice({ numBeats: 4, beatValue: 4 });
voice.addTickables(notes);
new Formatter().joinVoices([voice]).format([voice], staveWidth - 50);
voice.draw(context, stave);

// 7. 自動連桿（Beam）
const beams = Beam.generateBeams(notes);
beams.forEach((b) => b.setContext(context).draw());

// 8. 連結線（Tie）
const tie = new StaveTie({
  first_note: notes[0],
  last_note: notes[1],
  first_indices: [0],
  last_indices: [0],
});
tie.setContext(context).draw();
```

**高階 API（Factory + EasyScore）**（適合原型開發）：

```typescript
import { Factory } from "vexflow";

const vf = new Factory({
  renderer: { elementId: "output", width: 600, height: 300 },
});
const score = vf.EasyScore();
const system = vf.System();

// 大譜表（鋼琴：高音譜號 + 低音譜號）
system
  .addStave({
    voices: [
      score.voice(score.notes("C#5/q, B4, A4, G#4", { stem: "up" })),
      score.voice(score.notes("C#4/h, C#4", { stem: "down" })),
    ],
  })
  .addClef("treble")
  .addTimeSignature("4/4");

system
  .addStave({
    voices: [
      score.voice(
        score.notes("C#3/q, B2, A2/8, B2, C#3, D3", {
          clef: "bass",
          stem: "up",
        }),
      ),
      score.voice(score.notes("C#2/h, C#2", { clef: "bass", stem: "down" })),
    ],
  })
  .addClef("bass")
  .addTimeSignature("4/4");

system.addConnector("brace"); // 大括號
system.addConnector("singleLeft"); // 左邊線
system.addConnector("singleRight"); // 右邊線

vf.draw();
```

**VexFlow 時值代碼**：

| 代碼   | 時值              | 拍數（4/4） |
| ------ | ----------------- | ----------- |
| `w`    | 全音符            | 4           |
| `h`    | 二分音符          | 2           |
| `q`    | 四分音符          | 1           |
| `8`    | 八分音符          | 0.5         |
| `16`   | 十六分音符        | 0.25        |
| `32`   | 三十二分音符      | 0.125       |
| 加 `d` | 附點（+50% 時值） | -           |
| 加 `r` | 休止符            | -           |

### 1.3 安裝

```bash
pnpm add vexflow
```

VexFlow 5 為 ESM + TypeScript 原生，無需額外型別定義。

---

## 2. MidiToNotation.ts 演算法設計

這是 Phase 7 中**技術難度最高**的部分。MIDI 是「演奏資料」（時間戳 + 持續時間，以秒為單位），五線譜是「樂譜資料」（節拍位置 + 音符時值）。轉換需要經過多個階段的處理。

### 2.0 管線總覽

```
ParsedSong (MIDI)
    │
    ├─ tempos[]           # BPM 變化時間點
    ├─ timeSignatures[]   # 拍號變化
    └─ tracks[].notes[]   # { midi, time(秒), duration(秒), velocity }
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 1: 時間 → 節拍轉換 (secondsToBeats)             │
│  輸入：time(s), duration(s), tempoMap                   │
│  輸出：startBeat(全域 beat), durationBeats              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 2: 量化 (quantize)                               │
│  輸入：startBeat, durationBeats                         │
│  輸出：量化後的 startBeat, durationBeats                │
│  子步驟：                                                │
│    2a. 格線對齊（snap onset to nearest grid point）      │
│    2b. 時值量化（snap duration to nearest standard）     │
│    2c. 三連音偵測（detect triplet groupings）            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 3: 譜號分配 (assignClef)                         │
│  輸入：midi number, track index                         │
│  輸出：'treble' | 'bass'                                │
│  規則：                                                  │
│    - 若 MIDI 有明確雙軌（R/L hand）→ 按 track           │
│    - 否則以 MIDI 60 (C4) 為分界                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 4: 小節線切割 (splitIntoMeasures)                │
│  輸入：量化音符 + timeSignature map                      │
│  輸出：NotatedMeasure[]                                 │
│  子步驟：                                                │
│    4a. 計算每小節的 beat 範圍                            │
│    4b. 跨小節音符 → 連結線                               │
│    4c. 插入休止符填補空白                                 │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 5: 音符時值推斷 (inferDuration)                  │
│  輸入：durationBeats（量化後）                           │
│  輸出：VexFlow duration string + isDotted + isTied       │
│  子步驟：                                                │
│    5a. 精確匹配標準時值                                   │
│    5b. 附點音符偵測                                       │
│    5c. 需要連結線的複合時值                               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 6: 升降記號推斷 (inferAccidentals)               │
│  輸入：midi number, keySignature                         │
│  輸出：accidental? ('#', 'b', 'n', '##', 'bb')         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
  NotatedMeasure[] → 傳給 VexFlow 渲染
```

### 2.1 Stage 1：時間 → 節拍轉換

**目的**：將秒為單位的 MIDI 時間轉為以「beat」為單位的音樂時間。

**演算法**：

```typescript
/**
 * 將秒轉換為全域 beat 數。
 * 需要遍歷 tempo map，因為 BPM 可能在歌曲中變化。
 *
 * 一個 beat = 一個四分音符（quarter note）
 *
 * 演算法：
 *   對每段恆定 tempo 區間：
 *     beats += (segmentDuration_seconds) * (bpm / 60)
 */
function secondsToBeats(timeInSeconds: number, tempoMap: TempoEvent[]): number {
  let totalBeats = 0;
  let prevTime = 0;
  let prevBpm = tempoMap[0]?.bpm ?? 120; // 預設 120 BPM

  for (const tempo of tempoMap) {
    if (tempo.time >= timeInSeconds) break;

    const segmentDuration = tempo.time - prevTime;
    totalBeats += segmentDuration * (prevBpm / 60);

    prevTime = tempo.time;
    prevBpm = tempo.bpm;
  }

  // 最後一段（從最後一個 tempo change 到目標時間）
  const remainingDuration = timeInSeconds - prevTime;
  totalBeats += remainingDuration * (prevBpm / 60);

  return totalBeats;
}
```

**複雜度**：O(T) 其中 T 為 tempo 事件數量。大部分曲目 T < 10，可忽略。

### 2.2 Stage 2：量化（Quantization）

這是整個轉換管線中最關鍵的步驟。

#### 2.2a 格線對齊（Onset Quantization）

**目的**：將音符起始拍位對齊到最近的節拍格線。

**格線定義**：

```typescript
/** 支援的量化格線精度（以 beat 為單位） */
const QUANTIZE_GRIDS = [
  1.0, // 四分音符
  0.5, // 八分音符
  0.25, // 十六分音符
  0.125, // 三十二分音符
  // 三連音格線
  1 / 3, // 四分音符三連音（一拍分三等份）
  1 / 6, // 八分音符三連音
];

/** 量化容忍度：距離格線 ±20% 以內才 snap */
const QUANTIZE_TOLERANCE = 0.2;
```

**演算法**：

```typescript
function quantizeOnset(beatPosition: number, gridResolution: number): number {
  const gridUnit = gridResolution;
  const nearestGrid = Math.round(beatPosition / gridUnit) * gridUnit;
  const distance = Math.abs(beatPosition - nearestGrid);

  // 只在容忍度範圍內才吸附
  if (distance <= gridUnit * QUANTIZE_TOLERANCE) {
    return nearestGrid;
  }

  // 超出容忍度，嘗試更細的格線
  return beatPosition; // fallback: 保持原位
}

/**
 * 多層級量化：從粗到細嘗試格線。
 * 優先使用粗格線（四分音符 > 八分 > 十六分），
 * 只在粗格線無法對齊時才使用細格線。
 */
function quantizeOnsetMultiGrid(beatPosition: number): number {
  for (const grid of QUANTIZE_GRIDS) {
    const snapped = Math.round(beatPosition / grid) * grid;
    const distance = Math.abs(beatPosition - snapped);

    if (distance <= grid * QUANTIZE_TOLERANCE) {
      return snapped;
    }
  }

  // 全部格線都無法對齊 → 使用最細的格線強制對齊
  const finest = QUANTIZE_GRIDS[QUANTIZE_GRIDS.length - 1];
  return Math.round(beatPosition / finest) * finest;
}
```

#### 2.2b 時值量化（Duration Quantization）

**標準時值表（以 beat 為單位）**：

```typescript
const STANDARD_DURATIONS: {
  beats: number;
  vexDuration: string;
  isDotted: boolean;
}[] = [
  // 基本時值
  { beats: 4.0, vexDuration: "w", isDotted: false }, // 全音符
  { beats: 2.0, vexDuration: "h", isDotted: false }, // 二分音符
  { beats: 1.0, vexDuration: "q", isDotted: false }, // 四分音符
  { beats: 0.5, vexDuration: "8", isDotted: false }, // 八分音符
  { beats: 0.25, vexDuration: "16", isDotted: false }, // 十六分音符
  { beats: 0.125, vexDuration: "32", isDotted: false }, // 三十二分音符

  // 附點時值（基礎 * 1.5）
  { beats: 6.0, vexDuration: "wd", isDotted: true }, // 附點全音符
  { beats: 3.0, vexDuration: "hd", isDotted: true }, // 附點二分音符
  { beats: 1.5, vexDuration: "qd", isDotted: true }, // 附點四分音符
  { beats: 0.75, vexDuration: "8d", isDotted: true }, // 附點八分音符
  { beats: 0.375, vexDuration: "16d", isDotted: true }, // 附點十六分音符

  // 三連音時值
  { beats: 2 / 3, vexDuration: "q", isDotted: false }, // 四分音符三連音
  { beats: 1 / 3, vexDuration: "8", isDotted: false }, // 八分音符三連音
];
```

**演算法**：

```typescript
function quantizeDuration(
  durationBeats: number,
  tolerance: number = QUANTIZE_TOLERANCE,
): {
  vexDuration: string;
  isDotted: boolean;
  actualBeats: number;
  isTriplet: boolean;
} {
  let bestMatch = STANDARD_DURATIONS[0];
  let bestError = Infinity;

  for (const std of STANDARD_DURATIONS) {
    const error = Math.abs(durationBeats - std.beats) / std.beats;
    if (error < bestError) {
      bestError = error;
      bestMatch = std;
    }
  }

  // 判斷是否為三連音
  const isTriplet = [2 / 3, 1 / 3, 4 / 3].some(
    (t) => Math.abs(durationBeats - t) / t < tolerance,
  );

  return {
    vexDuration: bestMatch.vexDuration,
    isDotted: bestMatch.isDotted,
    actualBeats: bestMatch.beats,
    isTriplet,
  };
}
```

#### 2.2c 三連音偵測

**策略**：不逐音符偵測，而是以「音符群組」為單位偵測。

```typescript
/**
 * 三連音偵測：
 * 檢查連續 3 個音符是否等分一個標準時值。
 * 例如：3 個音符各佔 1/3 beat → 八分音符三連音。
 *
 * 偵測條件：
 * 1. 連續 3 個音符
 * 2. 時值相近（互相誤差 < 15%）
 * 3. 總和接近一個標準時值（1 beat, 0.5 beat 等）
 */
function detectTripletGroups(
  notes: { startBeat: number; durationBeats: number }[],
): TripletGroup[] {
  const groups: TripletGroup[] = [];

  for (let i = 0; i < notes.length - 2; i++) {
    const trio = [notes[i], notes[i + 1], notes[i + 2]];
    const durations = trio.map((n) => n.durationBeats);
    const avg = durations.reduce((a, b) => a + b, 0) / 3;

    // 三個音符時值相近
    const isUniform = durations.every((d) => Math.abs(d - avg) / avg < 0.15);
    if (!isUniform) continue;

    // 總和接近標準時值
    const total = durations.reduce((a, b) => a + b, 0);
    const standardTotals = [1.0, 0.5, 2.0]; // 一拍、半拍、兩拍
    const isStandardTotal = standardTotals.some(
      (s) => Math.abs(total - s) / s < 0.15,
    );

    if (isStandardTotal) {
      groups.push({
        startIndex: i,
        count: 3,
        totalBeats: Math.round(total * 4) / 4, // snap 到最近的標準總量
      });
      i += 2; // 跳過已處理的音符
    }
  }

  return groups;
}
```

### 2.3 Stage 3：譜號分配

```typescript
/**
 * 譜號分配策略：
 *
 * 策略一（優先）：按 Track 分配
 *   - 若 MIDI 有 2 個 track → Track 0 = treble, Track 1 = bass
 *   - 依據 track name 線索：含 "right"/"treble"/"melody" → treble
 *                          含 "left"/"bass"/"accomp" → bass
 *
 * 策略二（fallback）：按音高分配
 *   - MIDI >= 60 (C4, Middle C) → treble
 *   - MIDI < 60 → bass
 *   - 邊界處理：C4 本身歸高音譜號（符合慣例）
 *
 * 策略三（進階，未來）：智慧分配
 *   - 分析一個小節內所有音符的平均音高
 *   - 若大部分音符在 C4 以上 → 整個小節歸 treble
 *   - 減少同一旋律線在兩個譜號之間頻繁跳動
 */
function assignClef(
  midi: number,
  trackIndex: number,
  trackCount: number,
  trackName: string,
): "treble" | "bass" {
  // 策略一：按 track（多數鋼琴 MIDI 使用雙軌）
  if (trackCount === 2) {
    return trackIndex === 0 ? "treble" : "bass";
  }

  // 策略一 variant：按 track name
  const nameLower = trackName.toLowerCase();
  if (/right|treble|melody|soprano/.test(nameLower)) return "treble";
  if (/left|bass|accomp|tenor/.test(nameLower)) return "bass";

  // 策略二：按音高
  return midi >= 60 ? "treble" : "bass";
}
```

### 2.4 Stage 4：小節線切割

```typescript
/**
 * 計算小節邊界（以全域 beat 為單位）
 *
 * 演算法：
 *   遍歷 timeSignature 事件，計算每個小節的起始 beat。
 *   每個小節的長度 = numerator * (4 / denominator) beats
 *   （因為 1 beat = 1 四分音符）
 *
 * 範例：
 *   4/4 → 每小節 4 beats
 *   3/4 → 每小節 3 beats
 *   6/8 → 每小節 3 beats（6 * 4/8 = 3）
 *   2/2 → 每小節 4 beats（2 * 4/2 = 4）
 */
function computeMeasureBoundaries(
  totalBeats: number,
  timeSignatures: { beat: number; numerator: number; denominator: number }[],
): MeasureBoundary[] {
  const measures: MeasureBoundary[] = [];
  let currentBeat = 0;
  let tsIndex = 0;
  let measureNumber = 1;

  while (currentBeat < totalBeats) {
    // 找到當前生效的拍號
    while (
      tsIndex < timeSignatures.length - 1 &&
      timeSignatures[tsIndex + 1].beat <= currentBeat
    ) {
      tsIndex++;
    }

    const ts = timeSignatures[tsIndex] ?? { numerator: 4, denominator: 4 };
    const beatsPerMeasure = ts.numerator * (4 / ts.denominator);

    measures.push({
      number: measureNumber,
      startBeat: currentBeat,
      endBeat: currentBeat + beatsPerMeasure,
      timeSignature: [ts.numerator, ts.denominator],
    });

    currentBeat += beatsPerMeasure;
    measureNumber++;
  }

  return measures;
}

/**
 * 處理跨小節音符：
 * 如果一個音符跨越小節線，將其拆分為兩個音符並標記 tie。
 *
 * 範例：
 *   音符起始 beat=3.5, duration=1.5（在 4/4 中）
 *   → 音符 A: beat=3.5, duration=0.5 (八分音符), isTiedForward=true
 *   → 音符 B: beat=4.0, duration=1.0 (四分音符), isTiedBack=true
 */
function splitAtMeasureBoundaries(
  note: QuantizedNote,
  measures: MeasureBoundary[],
): QuantizedNote[] {
  const results: QuantizedNote[] = [];
  let remaining = note.durationBeats;
  let currentBeat = note.startBeat;
  let isFirst = true;

  for (const measure of measures) {
    if (currentBeat >= measure.endBeat) continue;
    if (currentBeat + remaining <= measure.endBeat) {
      // 完全在這個小節內
      results.push({
        ...note,
        startBeat: currentBeat,
        durationBeats: remaining,
        measureNumber: measure.number,
        isTiedBack: !isFirst,
        isTiedForward: false,
      });
      break;
    }

    // 跨越小節線
    const fitBeats = measure.endBeat - currentBeat;
    results.push({
      ...note,
      startBeat: currentBeat,
      durationBeats: fitBeats,
      measureNumber: measure.number,
      isTiedBack: !isFirst,
      isTiedForward: true,
    });

    remaining -= fitBeats;
    currentBeat = measure.endBeat;
    isFirst = false;
  }

  return results;
}
```

### 2.5 Stage 5：音符時值推斷

```typescript
/**
 * 從量化後的 durationBeats 推斷 VexFlow 時值字串。
 *
 * 優先順序：
 * 1. 精確匹配標準時值 → 單一音符
 * 2. 附點音符（1.5x 基礎時值）→ 單一附點音符
 * 3. 複合時值 → 多個音符 + 連結線
 *
 * 複合時值範例：
 *   2.5 beats = 二分音符 + 八分音符（tied）
 *   3.5 beats = 附點二分音符 + 八分音符（tied）
 */
function inferDuration(durationBeats: number): DurationResult[] {
  // Step 1: 嘗試精確匹配
  const exact = STANDARD_DURATIONS.find(
    (s) => Math.abs(s.beats - durationBeats) / s.beats < 0.05,
  );
  if (exact) {
    return [
      {
        vexDuration: exact.vexDuration,
        isDotted: exact.isDotted,
        beats: exact.beats,
      },
    ];
  }

  // Step 2: 貪心分解 — 從最大的標準時值開始填充
  const results: DurationResult[] = [];
  let remaining = durationBeats;

  // 按時值從大到小排序
  const sorted = [...STANDARD_DURATIONS].sort((a, b) => b.beats - a.beats);

  for (const std of sorted) {
    if (remaining <= 0.01) break; // 浮點數容差
    if (std.beats <= remaining + 0.01) {
      results.push({
        vexDuration: std.vexDuration,
        isDotted: std.isDotted,
        beats: std.beats,
      });
      remaining -= std.beats;
    }
  }

  return results;
}
```

### 2.6 Stage 6：升降記號推斷

```typescript
/**
 * MIDI 音符號 → 音名 + 升降記號
 *
 * 演算法：
 * 1. MIDI number → 基礎音名（C, C#, D, D#, E, F, F#, G, G#, A, A#, B）
 * 2. 根據 keySignature 判斷是否需要顯示臨時記號
 * 3. VexFlow key 格式: "c/4", "c#/4", "bb/5" 等
 */

const SHARP_NAMES = [
  "c",
  "c#",
  "d",
  "d#",
  "e",
  "f",
  "f#",
  "g",
  "g#",
  "a",
  "a#",
  "b",
];
const FLAT_NAMES = [
  "c",
  "db",
  "d",
  "eb",
  "e",
  "f",
  "gb",
  "g",
  "ab",
  "a",
  "bb",
  "b",
];

/** 各調號中已內含的升降音（不需要臨時記號） */
const KEY_SIGNATURE_MAP: Record<string, Set<string>> = {
  C: new Set([]),
  G: new Set(["f#"]),
  D: new Set(["f#", "c#"]),
  A: new Set(["f#", "c#", "g#"]),
  E: new Set(["f#", "c#", "g#", "d#"]),
  B: new Set(["f#", "c#", "g#", "d#", "a#"]),
  F: new Set(["bb"]),
  Bb: new Set(["bb", "eb"]),
  Eb: new Set(["bb", "eb", "ab"]),
  Ab: new Set(["bb", "eb", "ab", "db"]),
  // ... 更多調號
};

function midiToVexFlowKey(
  midi: number,
  keySignature: string = "C",
  preferFlats: boolean = false,
): { key: string; accidental?: string } {
  const pitchClass = midi % 12;
  const octave = Math.floor(midi / 12) - 1;

  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  const noteName = names[pitchClass];

  const key = `${noteName}/${octave}`;

  // 判斷是否需要顯示臨時記號
  const keyAccidentals = KEY_SIGNATURE_MAP[keySignature] ?? new Set();
  const needsAccidental = noteName.length > 1 && !keyAccidentals.has(noteName);

  return {
    key,
    accidental: needsAccidental ? noteName.slice(1) : undefined,
  };
}
```

### 2.7 休止符插入

```typescript
/**
 * 在小節內偵測音符之間的空白，插入適當的休止符。
 *
 * 演算法：
 * 1. 取得小節內所有音符，按 startBeat 排序
 * 2. 遍歷相鄰音符之間的空隙
 * 3. 對每個空隙，使用 inferDuration() 推斷需要幾個休止符
 * 4. 小節尾部空白也需要填充
 *
 * 注意：高音譜號和低音譜號的休止符需要獨立計算。
 * 當一個譜號沒有任何音符時，整個小節為全休止符。
 */
function insertRests(
  notes: NotatedNote[], // 已排序的小節內音符
  measureStartBeat: number,
  beatsPerMeasure: number,
): NotatedRest[] {
  const rests: NotatedRest[] = [];
  let cursor = measureStartBeat;

  for (const note of notes) {
    if (note.beat > cursor + 0.01) {
      // 有空隙 → 插入休止符
      const gapBeats = note.beat - cursor;
      const gapRests = inferDuration(gapBeats);

      let restBeat = cursor;
      for (const r of gapRests) {
        rests.push({
          beat: restBeat - measureStartBeat, // 小節內相對位置
          duration: r.vexDuration + "r", // VexFlow 休止符格式
          beats: r.beats,
        });
        restBeat += r.beats;
      }
    }
    cursor = note.beat + note.durationBeats;
  }

  // 小節尾部空白
  const measureEndBeat = measureStartBeat + beatsPerMeasure;
  if (cursor < measureEndBeat - 0.01) {
    const tailBeats = measureEndBeat - cursor;
    const tailRests = inferDuration(tailBeats);

    let restBeat = cursor;
    for (const r of tailRests) {
      rests.push({
        beat: restBeat - measureStartBeat,
        duration: r.vexDuration + "r",
        beats: r.beats,
      });
      restBeat += r.beats;
    }
  }

  return rests;
}
```

---

## 3. 資料模型

### 3.1 中間表示型別

```typescript
// ─── engines/notation/types.ts ─────────────────────────────────────

/** 量化後的音符（Stage 2 輸出） */
interface QuantizedNote {
  /** 原始 MIDI 音符編號 (0-127) */
  midi: number;
  /** 量化後的全域起始 beat */
  startBeat: number;
  /** 量化後的持續 beat 數 */
  durationBeats: number;
  /** 力度 (0-127) */
  velocity: number;
  /** 原始 track index */
  trackIndex: number;
  /** 所屬小節編號（1-based） */
  measureNumber: number;
  /** 是否為連結線的後段（接續前一小節） */
  isTiedBack: boolean;
  /** 是否為連結線的前段（延續到下一小節） */
  isTiedForward: boolean;
  /** 是否為三連音的一部分 */
  isTriplet: boolean;
}

/** 最終的記譜音符（Stage 5-6 輸出，直接對應 VexFlow StaveNote） */
interface NotatedNote {
  /** MIDI 音符編號 */
  midi: number;
  /** 在小節內的起始位置（以 beat 為單位，0-based） */
  beat: number;
  /** VexFlow 時值代碼 ("q", "8", "16", "h", "w" 等) */
  duration: string;
  /** 實際佔用的 beat 數 */
  durationBeats: number;
  /** 是否為附點音符 */
  isDotted: boolean;
  /** 是否有向前的連結線 */
  isTiedForward: boolean;
  /** 是否有向後的連結線 */
  isTiedBack: boolean;
  /** 是否為三連音 */
  isTriplet: boolean;
  /** 所屬譜號 */
  clef: "treble" | "bass";
  /** VexFlow key 字串 (e.g. "c/4", "f#/5") */
  vexKey: string;
  /** 臨時記號 ('#', 'b', 'n', '##', 'bb') 或 undefined */
  accidental?: string;
  /** 所屬小節編號 */
  measure: number;
  /** 力度 (0-127)，可用於動態標記 */
  velocity: number;
  /** 全域起始 beat（用於同步游標） */
  globalBeat: number;
  /** 對應的原始時間（秒），用於與 playback currentTime 同步 */
  originalTime: number;
}

/** 休止符 */
interface NotatedRest {
  /** 在小節內的 beat 位置 */
  beat: number;
  /** VexFlow 時值代碼（附加 'r'，如 "qr", "8r"） */
  duration: string;
  /** 佔用的 beat 數 */
  beats: number;
  /** 所屬譜號 */
  clef: "treble" | "bass";
}

/** 一個小節的完整記譜資料 */
interface NotatedMeasure {
  /** 小節編號（1-based） */
  number: number;
  /** 拍號 [分子, 分母] */
  timeSignature: [number, number];
  /** 調號 (VexFlow 格式，如 "C", "G", "Bb") */
  keySignature: string;
  /** 高音譜號音符 */
  trebleNotes: NotatedNote[];
  /** 低音譜號音符 */
  bassNotes: NotatedNote[];
  /** 高音譜號休止符 */
  trebleRests: NotatedRest[];
  /** 低音譜號休止符 */
  bassRests: NotatedRest[];
  /** 小節的全域起始 beat */
  startBeat: number;
  /** 每小節的 beat 數 */
  beatsPerMeasure: number;
  /** 小節起始時間（秒），用於同步 */
  startTime: number;
}

/** 量化後的完整樂譜 */
interface NotatedScore {
  /** 所有小節 */
  measures: NotatedMeasure[];
  /** 全域調號 */
  keySignature: string;
  /** 總小節數 */
  totalMeasures: number;
  /** 原始歌曲資訊 */
  songTitle: string;
  /** 轉換設定（供 debug） */
  quantizationGrid: number;
}
```

### 3.2 與 VexFlow 的映射關係

| NotatedNote 欄位               | VexFlow 對應                                             |
| ------------------------------ | -------------------------------------------------------- |
| `vexKey`                       | `StaveNote({ keys: [vexKey] })`                          |
| `duration`                     | `StaveNote({ duration })`                                |
| `isDotted`                     | `Dot.buildAndAttach([note])`                             |
| `accidental`                   | `note.addModifier(new Accidental(accidental))`           |
| `isTiedForward` / `isTiedBack` | `new StaveTie({ first_note, last_note })`                |
| `isTriplet`                    | `new Tuplet(notes, { num_notes: 3, notes_occupied: 2 })` |
| `clef`                         | `stave.addClef(clef)`                                    |

---

## 4. UI 架構與同步機制

### 4.1 檔案架構

```
src/renderer/src/
├── engines/notation/
│   ├── types.ts                 ← 上方所有 interface
│   ├── MidiToNotation.ts        ← 主轉換管線（6 stages）
│   ├── quantizer.ts             ← Stage 1-2: 時間轉換 + 量化
│   ├── measureSplitter.ts       ← Stage 4: 小節切割
│   ├── durationInfer.ts         ← Stage 5: 時值推斷
│   ├── accidentalInfer.ts       ← Stage 6: 升降記號
│   └── __tests__/
│       ├── quantizer.test.ts
│       ├── measureSplitter.test.ts
│       ├── durationInfer.test.ts
│       └── MidiToNotation.test.ts
├── features/sheetMusic/
│   ├── SheetMusicPanel.tsx      ← React 元件（VexFlow 容器）
│   ├── MeasureRenderer.ts       ← 將 NotatedMeasure → VexFlow 渲染
│   ├── CursorSync.ts            ← 同步播放時間 → 譜面位置
│   ├── useSheetMusicMode.ts     ← 顯示模式切換 hook
│   └── __tests__/
│       └── SheetMusicPanel.test.tsx
└── stores/
    └── useSheetMusicStore.ts    ← 五線譜狀態（顯示模式、游標位置等）
```

### 4.2 SheetMusicPanel.tsx 設計

```typescript
/**
 * SheetMusicPanel — 五線譜顯示的 React 容器元件
 *
 * 職責：
 * 1. 管理 VexFlow Renderer 的生命週期（mount / unmount / resize）
 * 2. 接收 NotatedScore 並觸發渲染
 * 3. 處理自動捲動（跟隨 currentTime）
 * 4. 高亮當前播放的音符
 *
 * 渲染策略：
 * - 使用 SVG backend（比 Canvas 更容易操作單一元素）
 * - 每行顯示 4 個小節（可依視窗寬度調整）
 * - 當 currentTime 進入下一行的範圍時，平滑捲動
 *
 * Props:
 * - score: NotatedScore | null（由 MidiToNotation 轉換產生）
 * - currentTime: number（從 playbackStore 訂閱）
 * - mode: 'split' | 'sheetOnly' | 'fallingOnly'
 *
 * 效能策略：
 * - 只渲染可見的行（虛擬化）
 * - 游標移動使用 CSS transform（不重繪 SVG）
 * - Score 轉換在 loadSong 時一次性完成，不在每幀執行
 */
```

### 4.3 CursorSync 同步機制

```typescript
/**
 * CursorSync — 同步播放位置到譜面
 *
 * 流程：
 * 1. tickerLoop 每幀更新 currentTime
 * 2. CursorSync.getPosition(currentTime) 回傳：
 *    - 當前小節編號
 *    - 小節內的 x 偏移（比例）
 *    - 是否需要翻頁/捲動
 * 3. SheetMusicPanel 據此：
 *    - 移動游標 overlay（紅色垂直線）
 *    - 高亮當前音符（加粗/變色）
 *    - 觸發平滑捲動
 *
 * 同步方式：
 * - 使用 NotatedMeasure.startTime（秒）建立 binary search 索引
 * - 每幀 O(log M) 查找當前小節（M = 小節數）
 * - 小節內位置線性插值
 */

class CursorSync {
  private _measures: NotatedMeasure[];
  private _startTimes: number[]; // binary search 用

  constructor(score: NotatedScore) {
    this._measures = score.measures;
    this._startTimes = score.measures.map((m) => m.startTime);
  }

  getPosition(currentTime: number): CursorPosition {
    // Binary search 找當前小節
    const measureIndex = this._binarySearch(currentTime);
    const measure = this._measures[measureIndex];

    // 計算小節內進度 (0 ~ 1)
    const nextMeasureTime =
      measureIndex < this._measures.length - 1
        ? this._measures[measureIndex + 1].startTime
        : measure.startTime + 999; // 最後一小節
    const progress =
      (currentTime - measure.startTime) / (nextMeasureTime - measure.startTime);

    return {
      measureIndex,
      measureNumber: measure.number,
      progress: Math.max(0, Math.min(1, progress)),
      needsScroll: false, // 由 SheetMusicPanel 判斷
    };
  }

  private _binarySearch(time: number): number {
    let lo = 0,
      hi = this._startTimes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this._startTimes[mid] <= time) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
}
```

### 4.4 顯示模式

```
┌────────────────────────────────────────────────────────┐
│  useSheetMusicStore                                    │
│                                                        │
│  displayMode: 'split' | 'sheetOnly' | 'fallingOnly'   │
│  score: NotatedScore | null                            │
│  cursorMeasure: number                                 │
│  isAutoScroll: boolean                                 │
│  measuresPerLine: number (default: 4)                  │
│                                                        │
│  setDisplayMode(mode)                                  │
│  setScore(score)                                       │
│  updateCursor(currentTime)                             │
└────────────────────────────────────────────────────────┘
```

**佈局切換**：

| 模式          | 上方區域                                  | 下方區域                                 |
| ------------- | ----------------------------------------- | ---------------------------------------- |
| `split`       | SheetMusicPanel (40%)                     | FallingNotesCanvas (60%) + PianoKeyboard |
| `sheetOnly`   | SheetMusicPanel (100%)                    | PianoKeyboard                            |
| `fallingOnly` | FallingNotesCanvas (100%) + PianoKeyboard | （現有預設）                             |

### 4.5 自適應排版

```typescript
/**
 * 根據視窗寬度動態計算每行小節數和 stave 寬度：
 *
 * 計算公式：
 *   staveWidth = (containerWidth - padding) / measuresPerLine
 *   measuresPerLine = floor((containerWidth - padding) / MIN_STAVE_WIDTH)
 *   clamp(measuresPerLine, 2, 6)
 *
 * MIN_STAVE_WIDTH = 200px（確保音符不會太擠）
 * padding = 80px（左右邊距 + brace 寬度）
 */
```

---

## 5. 任務分解

### Task 1：VexFlow 整合基礎建設

| 項目         | 內容                                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **名稱**     | 安裝 VexFlow + 建立基礎渲染元件                                                                                                                                        |
| **輸入**     | 無                                                                                                                                                                     |
| **輸出**     | `SheetMusicPanel.tsx` 能渲染硬編碼的 C 大調音階                                                                                                                        |
| **複雜度**   | 低                                                                                                                                                                     |
| **前置依賴** | 無                                                                                                                                                                     |
| **驗證方式** | 在 App 中嵌入 SheetMusicPanel，看到正確的五線譜                                                                                                                        |
| **細節**     | `pnpm add vexflow`；建立 `features/sheetMusic/SheetMusicPanel.tsx`；使用 `useRef` 管理 SVG 容器；VexFlow `Renderer.Backends.SVG`；渲染一個 treble stave + 4 個四分音符 |

### Task 2：資料模型與型別定義

| 項目         | 內容                                     |
| ------------ | ---------------------------------------- |
| **名稱**     | 定義 notation 中間表示型別               |
| **輸入**     | 設計文件中的型別規格                     |
| **輸出**     | `engines/notation/types.ts` 完整型別定義 |
| **複雜度**   | 低                                       |
| **前置依賴** | 無                                       |
| **驗證方式** | `pnpm typecheck` 通過                    |

### Task 3：時間轉換 + 量化引擎

| 項目         | 內容                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **名稱**     | 實作 secondsToBeats + quantizer                                                                                                                            |
| **輸入**     | `ParsedNote[]`、`TempoEvent[]`                                                                                                                             |
| **輸出**     | `QuantizedNote[]`（量化後的音符陣列）                                                                                                                      |
| **複雜度**   | **高**                                                                                                                                                     |
| **前置依賴** | Task 2                                                                                                                                                     |
| **驗證方式** | 單元測試：已知 MIDI 時間 + BPM → 預期 beat 位置；格線吸附誤差 < 5%                                                                                         |
| **細節**     | 實作 `quantizer.ts`：`secondsToBeats()`、`quantizeOnsetMultiGrid()`、`quantizeDuration()`、`detectTripletGroups()`；至少 15 個測試案例覆蓋正常/變速/三連音 |

### Task 4：小節切割引擎

| 項目         | 內容                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **名稱**     | 實作 measureSplitter + 跨小節連結線                                                                         |
| **輸入**     | `QuantizedNote[]`、`TimeSignatureEvent[]`                                                                   |
| **輸出**     | `NotatedMeasure[]`（按小節分組的音符）                                                                      |
| **複雜度**   | 中                                                                                                          |
| **前置依賴** | Task 3                                                                                                      |
| **驗證方式** | 單元測試：4/4 拍 + 跨小節音符 → 正確分割 + tie 標記                                                         |
| **細節**     | 實作 `measureSplitter.ts`：`computeMeasureBoundaries()`、`splitAtMeasureBoundaries()`、`assignToMeasures()` |

### Task 5：時值推斷 + 休止符插入

| 項目         | 內容                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| **名稱**     | 實作 durationInfer + 休止符邏輯                                                               |
| **輸入**     | `QuantizedNote.durationBeats`                                                                 |
| **輸出**     | VexFlow duration string + isDotted + 休止符列表                                               |
| **複雜度**   | 中                                                                                            |
| **前置依賴** | Task 3                                                                                        |
| **驗證方式** | 單元測試：各種 beat 長度 → 正確的時值字串；空白段落 → 正確的休止符組合                        |
| **細節**     | 實作 `durationInfer.ts`：`inferDuration()`、`insertRests()`；覆蓋附點音符、複合時值、全休止符 |

### Task 6：升降記號推斷

| 項目         | 內容                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| **名稱**     | 實作 accidentalInfer + 調號處理                                                                       |
| **輸入**     | `midi: number`、`keySignature: string`                                                                |
| **輸出**     | VexFlow key string + accidental                                                                       |
| **複雜度**   | 低                                                                                                    |
| **前置依賴** | Task 2                                                                                                |
| **驗證方式** | 單元測試：各調號下的音名轉換正確性                                                                    |
| **細節**     | 實作 `accidentalInfer.ts`：`midiToVexFlowKey()`、`detectKeySignature()`（分析曲目中最常出現的升降音） |

### Task 7：主轉換管線整合

| 項目         | 內容                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **名稱**     | 整合 6 個 Stage 為 MidiToNotation 管線                                                                                                             |
| **輸入**     | `ParsedSong`                                                                                                                                       |
| **輸出**     | `NotatedScore`                                                                                                                                     |
| **複雜度**   | **高**                                                                                                                                             |
| **前置依賴** | Task 3, 4, 5, 6                                                                                                                                    |
| **驗證方式** | 使用真實 MIDI 檔案（Twinkle Twinkle, Ode to Joy）測試，手動驗證產出的 NotatedScore 正確性                                                          |
| **細節**     | 實作 `MidiToNotation.ts`：`convertSongToScore(song: ParsedSong): NotatedScore`；串接所有 stage；處理邊界情況（空 track、無 tempo event、單音旋律） |

### Task 8：VexFlow 小節渲染器

| 項目         | 內容                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **名稱**     | 實作 MeasureRenderer — NotatedMeasure → VexFlow 繪製                                                                                                               |
| **輸入**     | `NotatedMeasure`                                                                                                                                                   |
| **輸出**     | 在指定 SVG context 上渲染大譜表（treble + bass）                                                                                                                   |
| **複雜度**   | **高**                                                                                                                                                             |
| **前置依賴** | Task 1, 7                                                                                                                                                          |
| **驗證方式** | 在 SheetMusicPanel 中渲染真實 MIDI 轉換後的小節                                                                                                                    |
| **細節**     | 實作 `MeasureRenderer.ts`：建立 treble/bass Stave；建立 Voice + StaveNote（含和弦、附點、臨時記號）；Beam 自動連桿；Tie 連結線；Tuplet 三連音標記；brace connector |

### Task 9：SheetMusicPanel 完整化

| 項目         | 內容                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------- |
| **名稱**     | 完整的五線譜面板（多行渲染 + resize）                                                          |
| **輸入**     | `NotatedScore`                                                                                 |
| **輸出**     | 可捲動的完整五線譜                                                                             |
| **複雜度**   | 中                                                                                             |
| **前置依賴** | Task 8                                                                                         |
| **驗證方式** | 載入完整曲目，看到多行大譜表，resize 視窗時自動重排                                            |
| **細節**     | 多行排版（每行 N 個小節，依寬度計算）；SVG 容器高度動態計算；`ResizeObserver` 監聽容器寬度變化 |

### Task 10：游標同步 + 音符高亮

| 項目         | 內容                                                                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **名稱**     | CursorSync + 自動捲動 + 當前音符高亮                                                                                                                                                   |
| **輸入**     | `currentTime`（從 playbackStore）                                                                                                                                                      |
| **輸出**     | 游標跟隨播放位置、當前音符變色、自動捲到可見區域                                                                                                                                       |
| **複雜度**   | 中                                                                                                                                                                                     |
| **前置依賴** | Task 9                                                                                                                                                                                 |
| **驗證方式** | 播放歌曲時，游標平滑移動，當前音符高亮，翻行時自動捲動                                                                                                                                 |
| **細節**     | 實作 `CursorSync.ts`；游標使用 SVG `<rect>` overlay（CSS transform 移動，不重繪）；音符高亮使用 SVG class 切換（`note-active`）；自動捲動使用 `scrollIntoView({ behavior: 'smooth' })` |

### Task 11：顯示模式切換 + Store

| 項目         | 內容                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------ |
| **名稱**     | 三種顯示模式 + useSheetMusicStore                                                                |
| **輸入**     | 使用者切換操作                                                                                   |
| **輸出**     | `split`/`sheetOnly`/`fallingOnly` 模式正確切換                                                   |
| **複雜度**   | 低                                                                                               |
| **前置依賴** | Task 9, 10                                                                                       |
| **驗證方式** | 切換模式時佈局正確變化，不閃爍                                                                   |
| **細節**     | 建立 `useSheetMusicStore.ts`；修改 `App.tsx` 佈局（flexbox 切換比例）；TransportBar 新增切換按鈕 |

### Task 12：測試與調校

| 項目         | 內容                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **名稱**     | 整合測試 + 量化精度調校 + 邊界處理                                                                                                         |
| **輸入**     | 18 首內建曲目                                                                                                                              |
| **輸出**     | 全部曲目可正確顯示五線譜                                                                                                                   |
| **複雜度**   | **高**                                                                                                                                     |
| **前置依賴** | Task 1-11                                                                                                                                  |
| **驗證方式** | 逐曲手動驗證；`pnpm lint && pnpm typecheck && pnpm test` 通過                                                                              |
| **細節**     | 量化參數微調（tolerance、grid 選擇策略）；處理邊界案例（pick-up bar / anacrusis、tempo rubato、grace notes）；效能壓測（> 200 小節的曲目） |

### 任務依賴圖

```
Task 2 (型別)
  │
  ├── Task 3 (量化引擎) ──┐
  │     │                  │
  │     ├── Task 4 (小節切割) ──┐
  │     └── Task 5 (時值推斷) ──┤
  │                              │
  ├── Task 6 (升降記號) ────────┤
  │                              │
  │                              ▼
  │                         Task 7 (管線整合)
  │                              │
Task 1 (VexFlow 基礎) ──── Task 8 (小節渲染器)
                                 │
                            Task 9 (面板完整化)
                                 │
                           Task 10 (游標同步)
                                 │
                           Task 11 (模式切換)
                                 │
                           Task 12 (測試調校)
```

---

## 6. 風險評估

### 6.1 量化精度風險 — **高**

**問題**：MIDI 演奏資料的時間戳包含人為演奏的微小誤差（rubato、不精確的節奏）。量化演算法可能：

- 將連續的十六分音符誤判為八分音符
- 無法正確辨識三連音
- 在 tempo 變化處產生錯誤對齊

**緩解措施**：

1. **多層級格線策略**：從粗到細嘗試，優先匹配四分音符，避免過度量化
2. **可調參數**：量化閾值（tolerance）暴露為 `NotationSettings`，讓進階使用者微調
3. **漸進式精度**：Phase 7 初版只支援機器生成的 MIDI（精準時間），Phase 7.5 再處理人工演奏的 MIDI
4. **視覺化 debug 工具**：開發過程中建立量化前後的對比視圖

### 6.2 效能風險 — **中**

**問題**：

- VexFlow SVG 渲染大量小節時可能緩慢
- 200+ 小節的曲目可能產生巨大的 SVG DOM

**數據估計**：
| 曲目 | 小節數 | 音符數 | SVG 元素估計 |
|------|--------|--------|-------------|
| Twinkle Twinkle | 24 | 48 | ~500 |
| Fur Elise (簡化) | 60 | 200 | ~2000 |
| Moonlight Sonata (1st) | 200 | 800 | ~8000 |

**緩解措施**：

1. **虛擬化渲染**：只渲染可見區域的行（±1 行緩衝），使用 `IntersectionObserver`
2. **增量渲染**：首屏立即渲染（前 8 小節），其餘在背景渲染
3. **SVG 快取**：每小節渲染後快取 SVG 片段，resize 時才重繪
4. **效能目標**：初次轉換 < 500ms（18 首內建曲目），游標更新 < 1ms/幀

### 6.3 VexFlow 限制 — **中**

**已知限制**：

1. **Voice 拍數驗證**：VexFlow `Voice` 預設啟用嚴格的拍數檢查，如果音符總拍數不等於 time signature，會拋出錯誤。需要使用 `Voice.Mode.SOFT` 關閉嚴格模式。
2. **多聲部排版**：同一 stave 上的兩個 voice（如右手的旋律 + 和弦分解）需要仔細處理 stem direction，否則符桿方向可能衝突。
3. **中文文字**：VexFlow 的 SVG 文字渲染可能不完美支援中文歌詞（Phase 7 不涉及歌詞，但未來可能需要）。

**緩解措施**：

1. 使用 `Voice.Mode.SOFT` 並在轉換管線中確保拍數正確
2. Phase 7 初版只支援單聲部（每個 clef 一個 voice），多聲部（如複雜古典曲目）延後處理
3. 預留 VexFlow 版本升級的兼容層

### 6.4 MIDI 資料品質風險 — **低**

**問題**：不同來源的 MIDI 檔案品質差異大：

- 機器生成（GarageBand、MuseScore 匯出）→ 時間精確，容易量化
- 人工演奏錄製 → 時間不精確，rubato 多
- 某些 MIDI 缺少 tempo / time signature 事件

**緩解措施**：

1. Phase 7 優先支援機器生成的 MIDI（內建曲庫全是機器生成的）
2. 缺少 tempo 事件時預設 120 BPM、缺少 time signature 時預設 4/4
3. 未來可考慮引入 beat tracking 演算法（如學術論文中的 HMM / Transformer 方法）

### 6.5 風險優先矩陣

| 風險                   | 機率 | 影響 | 優先處理                     |
| ---------------------- | ---- | ---- | ---------------------------- |
| 量化精度不足           | 高   | 高   | **是** — Task 3, 12 重點投入 |
| SVG 效能               | 中   | 中   | 是 — Task 9 實作虛擬化       |
| VexFlow Voice 嚴格模式 | 高   | 低   | 是 — Task 8 使用 SOFT mode   |
| MIDI 品質差異          | 低   | 中   | 否 — Phase 7.5 處理          |
| 多聲部排版             | 中   | 低   | 否 — Phase 7 只支援單聲部    |

---

## 附錄：參考資料

- VexFlow 官方文件：https://www.vexflow.com/
- VexFlow GitHub：https://github.com/0xfe/vexflow
- VexFlow Wiki Tutorial：https://github.com/0xfe/vexflow/wiki/Tutorial
- VexFlow EasyScore：https://github.com/0xfe/vexflow/wiki/Using-EasyScore
- MIDI 量化學術論文：Liu et al., "Performance MIDI-to-Score Conversion by Neural Beat Tracking", ISMIR 2022
- Beat-Based Rhythm Quantization：https://arxiv.org/html/2508.19262
