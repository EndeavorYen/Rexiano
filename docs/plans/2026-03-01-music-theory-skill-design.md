# Music Theory Skill — 設計文件

> **日期**: 2026-03-01
> **用途**: 為 Rexiano 專案建立樂理 skill，確保 Claude 生成或驗證的 MIDI / 音樂內容符合樂理規範，不會害到練習的小朋友

---

## 動機

Rexiano 是兒童鋼琴練習 app，未來可能需要 Claude 協助：

1. **生成**練習曲、音階練習、和弦進行等 MIDI 內容
2. **驗證**現有 MIDI 內容的樂理正確性

錯誤的音樂內容（不合理的音程、超出兒童手掌跨度的和弦、不解決的不協和音）會誤導正在學習的小朋友，因此需要一套嚴格的樂理規則作為 guardrail。

---

## 架構

```
.claude/skills/music-theory/
├── SKILL.md                         ← 主控流程 + 等級參數 + 驗證清單
└── references/
    ├── scales-and-keys.md           ← 音階/調性完整參考（含 MIDI 對照）
    ├── chords-and-progressions.md   ← 和弦/進行（按等級分層）
    ├── voice-leading.md             ← 聲部進行規則
    ├── rhythm-and-meter.md          ← 拍號/音符時值/MIDI tick 對照
    ├── children-pedagogy.md         ← 兒童教學法/難度分級/教材進度
    └── validation-checklist.md      ← 16 條驗證規則（含 TypeScript 虛擬碼）
```

### 設計決策

- **方案 B（主檔 + references）**：SKILL.md 精簡為流程指引，詳細規則按主題分檔在 references/ 中
- **4 個難度等級**：Beginner / Elementary / Intermediate / Advanced，每個等級有具體的約束參數
- **16 條驗證規則**：分為 Error（必須修正）和 Warning（強烈建議修正）兩個嚴重度
- **生成 6 步驟**：確認等級 → 查閱 references → 套用約束 → 生成 → 自我驗證 → 輸出

---

## 難度等級參數

| 參數           |  Beginner  |   Elementary    |   Intermediate   | Advanced |
| -------------- | :--------: | :-------------: | :--------------: | :------: |
| 適用年齡       |    4-7     |       6-9       |       8-11       |   10+    |
| 允許調性       |   C only   | C,G,F,D + Am,Dm |      ≤2#/2b      |  ≤3#/3b  |
| RH 音域 (MIDI) |   60-67    |      55-72      |      48-84       |  43-89   |
| LH 音域 (MIDI) |   48-60    |      43-62      |      36-65       |  33-67   |
| 最大手掌跨度   |   7 (P5)   |     9 (M6)      |     12 (P8)      | 15 (M10) |
| 單手同時音     |     1      |        2        |        3         |    4     |
| 音符時值       | 全/二/四分 | +附點二分+八分  | +附點四分+三連音 | +十六分  |
| 拍號           |    4/4     |    4/4, 3/4     |    +6/8, 2/4     |   全部   |
| BPM            |   60-80    |      72-96      |      80-120      | 100-168  |
| 曲長(小節)     |    4-16    |      8-24       |      16-48       |  32-64+  |

---

## 驗證規則摘要

16 條規則，8 條 Error + 8 條 Warning：

**Error（必修正）**: 音域越界、小二度碰撞、手掌跨度超限、單手音數超限、Note On/Off 不成對、同 pitch 重疊 Note On、Channel 10 誤用、音符時值不在等級允許範圍

**Warning（強烈建議）**: 非調性內音符、平行五/八度、導音未解決、速度不在範圍、休止符不足、力度無變化、旋律弱於伴奏、樂句缺呼吸點
