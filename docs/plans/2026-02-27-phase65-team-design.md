# Phase 6.5 — Agent Team Design (All 5 Sprints)

> **Date**: 2026-02-27
> **Status**: Approved
> **Scope**: Full Phase 6.5 (Sprint 1-5), all "Rex can practice independently" features

## Context

DESIGN.md §9 contains the complete spec. AGENT_TEAM_PROMPTS.md §Phase 6.5 has the ready-to-use team prompt for Sprint 1-4. This doc covers the Sprint 5 extension and team composition decisions.

## Team Composition (4 agents)

### Teammate 1 — UX Engineer (Interaction)
**Sprint 1-4**: Keyboard shortcuts, piano key labels, falling note BitmapText labels, drag-drop import
**Sprint 5**: Fingering number display on notes/keys, i18n string wrapping in all UI components

### Teammate 2 — UI Designer (Themes & Panels)
**Sprint 1-4**: Midnight dark theme, SettingsPanel modal, useSettingsStore, OnboardingGuide, CelebrationOverlay
**Sprint 5**: InsightsPanel + ProgressChart UI, locale switcher in SettingsPanel, translation file structure

### Teammate 3 — Engine Engineer (Persistence & Integration)
**Sprint 1-4**: useProgressStore, IPC handlers (progress.json), recent files, practice wiring, MetronomeEngine
**Sprint 5**: FingeringEngine.ts (heuristic algorithm), WeakSpotAnalyzer.ts, i18n framework setup (react-i18next or lightweight)

### Teammate 4 — QA Engineer (Testing)
**Sprint 1-4**: Code review + integration tests for all sprint items
**Sprint 5**: Fingering algorithm edge cases, insights data accuracy, i18n fallback tests, full regression

## Key Design Decisions

1. **Fingering algorithm**: Rule-based heuristic (scale patterns, thumb crossing rules, chord fingering tables). NOT ML-based.
2. **Insights charts**: Lightweight SVG/CSS self-drawn. No Chart.js dependency.
3. **i18n**: Start with lightweight key-value map. react-i18next only if complexity warrants it.
4. **File ownership**: Strict — each teammate only modifies their assigned files, reads freely.

## Sprint Dependencies

```
Sprint 1 (basic usability) ──┐
Sprint 2 (practice UX) ──────┼── Sprint 3 (persistence/settings)
Sprint 4 (teaching tools) ───┘        │
                                       ▼
                              Sprint 5 (long-term features)
```

Sprint 1, 2, 4 are parallel. Sprint 3 depends on Sprint 2. Sprint 5 depends on Sprint 3 (needs progress store for insights).

## References

- [DESIGN.md §9](../DESIGN.md#9-phase-65--兒童可用性增強) — Full specifications
- [AGENT_TEAM_PROMPTS.md §Phase 6.5](../AGENT_TEAM_PROMPTS.md) — Base team prompt (Sprint 1-4)
- [ROADMAP.md §Phase 6.5](../ROADMAP.md) — Task checklist
