# Squad Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the `squad` Claude Code plugin — a self-evolving agent team orchestrator that sits on top of official Agent Teams primitives.

**Architecture:** A pure-markdown plugin (no compiled code). 1 command, 6 skills, 1 hooks.json, 1 config template. All "logic" is prompt engineering injected into the main session and spawned agents. A persistent knowledge base at `.claude/squad/` grows across sessions.

**Tech Stack:** Claude Code Plugin system (markdown + JSON), YAML frontmatter, `${CLAUDE_PLUGIN_ROOT}` paths, official Agent Teams tools (TeamCreate/Task/SendMessage/TaskList)

**Plugin Location:** `d:\Code\squad` (standalone repo, not inside Rexiano)

---

### Task 1: Plugin scaffold — manifest and directory structure

**Files:**

- Create: `d:\Code\squad\.claude-plugin\plugin.json`
- Create: `d:\Code\squad\commands\` (directory)
- Create: `d:\Code\squad\skills\` (directory)
- Create: `d:\Code\squad\hooks\` (directory)
- Create: `d:\Code\squad\config\` (directory)

**Step 1: Create plugin root and manifest**

```bash
mkdir -p /d/Code/squad/.claude-plugin
mkdir -p /d/Code/squad/commands
mkdir -p /d/Code/squad/skills/mission-planning
mkdir -p /d/Code/squad/skills/role-forging
mkdir -p /d/Code/squad/skills/tool-forging
mkdir -p /d/Code/squad/skills/gate-check
mkdir -p /d/Code/squad/skills/status-report
mkdir -p /d/Code/squad/skills/retrospective
mkdir -p /d/Code/squad/hooks
mkdir -p /d/Code/squad/config
```

**Step 2: Write plugin.json**

```json
{
  "name": "squad",
  "description": "Self-evolving agent team orchestrator. Dispatch a squad to plan, execute, verify, and deliver — with configurable gates and persistent knowledge.",
  "author": {
    "name": "Rexiano",
    "email": "noreply@rexiano.dev"
  }
}
```

Write to: `d:\Code\squad\.claude-plugin\plugin.json`

**Step 3: Initialize git repo**

```bash
cd /d/Code/squad && git init
```

**Step 4: Commit scaffold**

```bash
git add -A && git commit -m "chore: scaffold squad plugin directory structure"
```

---

### Task 2: /squad command — the entry point

**Files:**

- Create: `d:\Code\squad\commands\squad.md`

This is the most critical file. It's the main orchestration prompt that transforms the session into the 參謀總長, defining the full 6-stage pipeline.

**Step 1: Write the command file**

Write to `d:\Code\squad\commands\squad.md`:

````markdown
---
description: Dispatch a self-organizing squad to accomplish a mission. Usage: /squad "objective" [--gate supervised|standard|autonomous]
argument-hint: "mission objective" [--gate standard]
---

# Squad — 特戰小隊出動

You are the 參謀總長 (Chief of Staff). The user is the 總統 (President) who has given you a mission objective. Your job is to assemble and lead a squad to accomplish it autonomously, reporting back at configured gate points.

**Mission Objective:** $ARGUMENTS

## Your Operating Protocol

Execute the following 6-stage pipeline in order. At each gate point, pause and present results to the 總統 for approval (unless running in autonomous mode).

### Parse Arguments

Extract from `$ARGUMENTS`:

- **objective**: The mission description (required)
- **gate**: One of `supervised`, `standard` (default), `autonomous`

If no gate is specified, check `.claude/squad/config.yaml` for `default_gate`. If that doesn't exist, default to `standard`.

Gate definitions:

- `supervised`: Pause after PLAN, EXECUTE, and VERIFY
- `standard`: Pause after PLAN and VERIFY
- `autonomous`: No pauses, deliver final report only

---

### Stage 1: RECON (偵察)

Gather intelligence about the codebase and mission context. Do this silently — no output to the user yet.

1. Read `CLAUDE.md` in the project root (if it exists) to understand project conventions
2. Read any design docs referenced in CLAUDE.md (e.g., `docs/DESIGN.md`, `docs/ROADMAP.md`)
3. Run `git log --oneline -20` to understand recent activity
4. Read `.claude/squad/knowledge/lessons.md` and `.claude/squad/knowledge/role-patterns.md` (if they exist) to leverage past experience
5. Read `.claude/squad/config.yaml` (if it exists) for user configuration
6. Identify the relevant files, modules, and architecture for this mission

**Output:** None (internal intelligence gathering)

---

### Stage 2: PLAN (作戰計畫)

Use the `mission-planning` skill to decompose the objective. Use the `role-forging` skill to design each squad member's persona.

Produce a battle plan containing:

1. **Task decomposition**: Break the objective into specific, independently-executable tasks with clear deliverables and dependency ordering
2. **Squad composition**: For each needed squad member, forge a bespoke persona (callsign, specialty, exact responsibilities, constraints). Do NOT use generic roles — each persona must be tailored to THIS mission based on the codebase intelligence from RECON
3. **Execution strategy**: Which tasks can run in parallel, which are sequential, dependency graph
4. **Verification criteria**: What "done" looks like — specific commands to run, files to check

Present the battle plan to the 總統 in a clear, structured format.

**Gate check (if `after_plan` is true):**

```
⏸ 作戰計畫已擬定。請確認或提出修改。
```

Wait for approval before proceeding. If the user provides feedback, revise the plan and re-present.

---

### Stage 3: EXECUTE (執行)

1. Create the team: use `TeamCreate` with a descriptive team name based on the mission
2. For each squad member in the plan:
   - Spawn via the `Task` tool with `team_name`, using the forged persona as the `prompt`
   - Include in each member's prompt:
     - Their specific task assignments
     - The project conventions from CLAUDE.md
     - Instructions to report completion via `SendMessage`
     - Instructions to report blockers immediately rather than guessing
     - Prohibition against modifying files outside their assigned scope
     - Prohibition against committing or pushing
   - If `use_worktrees` is true in config, add `isolation: "worktree"` to the Task call
3. Monitor progress via incoming messages from teammates
4. Report phase transitions to the 總統: "Alpha 完成 task #1", "Bravo 遇到阻塞..."
5. If a teammate reports a blocker, assess and either:
   - Provide guidance via `SendMessage`
   - Reassign the task
   - Escalate to the 總統

**Gate check (if `after_execute` is true):**

```
⏸ 執行階段完成。以下是各隊員成果摘要：[summary]。確認進入驗收？
```

---

### Stage 4: VERIFY (驗收)

1. Read the config to find `verify_commands` (default: project-appropriate lint/typecheck/test)
2. Run each verification command via Bash and capture results
3. If any verification fails:
   - Analyze the failure
   - Either fix it directly (if trivial) or send a teammate back to fix it
   - Re-run verification after fixes
4. Review all changed files for:
   - Architecture compliance (if DESIGN.md exists)
   - Code quality
   - No unintended side effects

**Gate check (if `after_verify` is true):**

```
⏸ 驗收結果：
- lint: ✅/❌
- typecheck: ✅/❌
- test: ✅/❌ (N → M tests)
- review: [summary]

確認結果？
```

---

### Stage 5: DEBRIEF (總結報告)

Use the `status-report` skill to generate the mission report.

1. Compile the structured report with: objective, squad composition, execution summary, changes made, verification results, lessons learned
2. Write the report to `.claude/squad/reports/YYYY-MM-DD-{mission-slug}.md`
3. If the project has a ROADMAP.md, update completed checkboxes
4. Present a brief summary to the 總統

---

### Stage 6: RETRO (反思進化)

Use the `retrospective` skill to conduct the post-mission review.

1. Reflect on:
   - **Efficiency**: Which tasks took longer than expected? Why?
   - **Roles**: Which persona designs were effective? Which were too vague?
   - **Tools**: Were there repetitive manual actions that should be automated?
   - **Process**: Were the gates appropriate? Task granularity correct?
2. Update knowledge base:
   - Append to `.claude/squad/knowledge/lessons.md`
   - Update `.claude/squad/knowledge/role-patterns.md` with effective persona designs
   - Update `.claude/squad/knowledge/tool-patterns.md` if new tools were identified
3. Use the `tool-forging` skill if actionable tool/skill gaps were identified:
   - Create bash scripts in `.claude/squad/tools/` for immediate use
   - Create new SKILL.md files in the plugin's skills/ directory for next-session use
4. Update `.claude/squad/metrics.md` with mission stats

**Final output:**

```
✅ 任務完成。
📄 報告：.claude/squad/reports/YYYY-MM-DD-{slug}.md
📚 知識庫已更新
🔧 [新工具/skill created, if any]
```

---

### Subcommands

If `$ARGUMENTS` matches these patterns, handle them directly instead of running the pipeline:

- `--status`: Read the current team's task list and present a progress summary
- `--history`: List all files in `.claude/squad/reports/` and present a summary table
- `--knowledge`: Read and present contents of `.claude/squad/knowledge/`

---

### First-Run Bootstrap

If `.claude/squad/` does not exist, create the initial structure:

```
.claude/squad/
├── config.yaml        (copy from ${CLAUDE_PLUGIN_ROOT}/config/defaults.yaml)
├── knowledge/
│   ├── lessons.md     (empty with header)
│   ├── role-patterns.md (empty with header)
│   └── tool-patterns.md (empty with header)
├── tools/
├── reports/
└── metrics.md         (empty with header)
```
````

**Step 2: Commit**

```bash
git add commands/squad.md && git commit -m "feat: add /squad command — main orchestration entry point"
```

---

### Task 3: mission-planning skill

**Files:**

- Create: `d:\Code\squad\skills\mission-planning\SKILL.md`

**Step 1: Write the skill**

Write to `d:\Code\squad\skills\mission-planning\SKILL.md`:

````markdown
---
name: mission-planning
description: Use when decomposing a mission objective into tasks and planning squad composition. Triggered during the PLAN stage of a /squad mission. Teaches the 參謀總長 how to analyze objectives, break them into parallelizable tasks, and design execution strategy.
---

# Mission Planning — 作戰計畫方法論

You are planning a squad mission. Follow this methodology to decompose the objective into executable tasks.

## Task Decomposition Process

### 1. Identify Deliverables

From the objective, list concrete deliverables (files to create/modify, tests to write, docs to update). Each deliverable must be verifiable.

### 2. Map Dependencies

For each deliverable, determine:

- What must exist before this can start? (blocking dependencies)
- What can be done in parallel? (independent work streams)
- What is the critical path? (longest sequential chain)

### 3. Size Tasks

Each task should be:

- **Completable by one agent** in a single session
- **Independently verifiable** (can run tests or check output without other tasks)
- **Bounded** — clear start and end, no open-ended exploration

Bad task: "Improve the UI"
Good task: "Create KeyboardShortcutManager class in engines/keyboard/KeyboardShortcutManager.ts with methods: register(), unregister(), handleKeyDown(). Must pass 5 unit tests."

### 4. Assign Priority and Parallelism

Group tasks into waves:

- **Wave 1**: Independent foundation tasks (can all run in parallel)
- **Wave 2**: Tasks depending on Wave 1 (run after Wave 1 completes)
- **Wave 3**: Integration and verification tasks

### 5. Estimate Squad Size

Rules of thumb:

- 1-2 tasks → No squad needed, 參謀總長 handles directly
- 3-5 independent tasks → 2-3 squad members
- 6+ tasks with parallelism → 3-5 squad members (max_members from config)
- Never spawn more members than there are parallel work streams

## Output Format

Present the plan as:

```
── 作戰計畫 ──────────────────────────
目標：{objective}

任務分解：
#1 {task description} [dependencies: none]
#2 {task description} [dependencies: none]
#3 {task description} [dependencies: #1]
#4 {task description} [dependencies: #1, #2]

執行策略：
Wave 1 (並行): #1, #2
Wave 2 (等待 Wave 1): #3, #4

編組：
• {Callsign} — {Forged role}: 負責 #{task numbers}
• {Callsign} — {Forged role}: 負責 #{task numbers}

驗證標準：
- {specific verification command and expected result}
─────────────────────────────────────
```
````

**Step 2: Commit**

```bash
git add skills/mission-planning/ && git commit -m "feat: add mission-planning skill — task decomposition methodology"
```

---

### Task 4: role-forging skill

**Files:**

- Create: `d:\Code\squad\skills\role-forging\SKILL.md`

**Step 1: Write the skill**

Write to `d:\Code\squad\skills\role-forging\SKILL.md`:

````markdown
---
name: role-forging
description: Use when designing bespoke agent personas for squad members. Triggered during the PLAN stage of a /squad mission. Teaches how to craft high-quality system prompts that produce focused, effective teammates.
---

# Role Forging — 角色鍛造術

You need to forge a bespoke persona for each squad member. Do NOT use generic roles like "developer" or "tester". Each persona is custom-built for THIS specific mission.

## Forging Process

### 1. Analyze Required Expertise

From the task assignment, identify:

- What domain knowledge does this person need? (e.g., PixiJS 8 particle systems, Zustand 5 store patterns)
- What project conventions must they follow? (from CLAUDE.md / DESIGN.md)
- What constraints apply? (performance budgets, architecture rules, file boundaries)

### 2. Check Role Patterns Library

Read `.claude/squad/knowledge/role-patterns.md` (if it exists). Look for previously successful persona designs for similar tasks. Reuse what worked, improve what didn't.

### 3. Forge the Persona Prompt

Structure each persona prompt with these sections:

```
你是 {specific expert identity}，被編入特戰小隊執行任務。

**你的專業：**
{2-3 sentences about specific domain expertise relevant to the tasks}

**任務分配：**
{Exact list of tasks with specific file paths and deliverables}

**專案慣例（必遵守）：**
{Key conventions extracted from CLAUDE.md — only include conventions relevant to this member's work}

**作業規範：**
1. 開始前先讀 CLAUDE.md 了解完整專案慣例
2. 嚴格按照分配的 task 範圍作業，不越界
3. 完成每個 task 後透過 SendMessage 向 lead 回報
4. 如果遇到阻塞，立即回報而非自行猜測
5. 完成所有 tasks 後回報完成並附上變更摘要

**禁止事項：**
- 不修改不在你任務範圍內的檔案
- 不自行 commit 或 push
- 不做超出任務要求的「改善」或「重構」
- 不安裝新的 dependencies 除非任務明確要求
```

### 4. Quality Checklist

Before finalizing each persona, verify:

- [ ] Expert identity is specific (not "developer" but "PixiJS 8 animation specialist")
- [ ] Task assignments reference exact file paths
- [ ] Project conventions are included (not just "follow conventions" but the actual rules)
- [ ] Constraints are explicit and measurable
- [ ] Communication protocol is clear (when and how to report)
- [ ] Boundaries are firm (what NOT to do)

## Naming Convention

Use NATO phonetic alphabet for callsigns: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot.

## Anti-Patterns

- **Too vague**: "You are a senior developer. Build the feature." → Agent will make arbitrary decisions
- **Too broad**: Assigning 5+ tasks to one member → Context overflow, poor focus
- **No boundaries**: Missing "禁止事項" → Agent will "improve" unrelated code
- **No communication protocol**: Agent works silently, lead can't track progress
````

**Step 2: Commit**

```bash
git add skills/role-forging/ && git commit -m "feat: add role-forging skill — bespoke persona design methodology"
```

---

### Task 5: tool-forging skill

**Files:**

- Create: `d:\Code\squad\skills\tool-forging\SKILL.md`

**Step 1: Write the skill**

Write to `d:\Code\squad\skills\tool-forging\SKILL.md`:

````markdown
---
name: tool-forging
description: Use when the squad identifies a tool gap during execution or RETRO — a repetitive manual action that should be automated. Teaches how to create bash scripts for immediate use and formal skills/hooks for next-session use.
---

# Tool Forging — 工具鍛造術

You've identified a tool gap — something the squad does manually that should be automated. Follow this process to forge the right kind of tool.

## Decision: Immediate vs Persistent

| Need                          | Tool Type      | Location                                       | Available    |
| ----------------------------- | -------------- | ---------------------------------------------- | ------------ |
| Use it right now this session | Bash script    | `.claude/squad/tools/{name}.sh`                | Immediately  |
| Reuse across future sessions  | Skill SKILL.md | `${CLAUDE_PLUGIN_ROOT}/skills/{name}/SKILL.md` | Next session |
| Auto-run on events            | Hook entry     | `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json`       | Next session |

**Default to immediate** (bash script). Only create a persistent skill/hook if the tool has been useful across 2+ missions.

## Creating an Immediate Tool (Bash Script)

1. Write the script to `.claude/squad/tools/{descriptive-name}.sh`
2. Make it executable: `chmod +x`
3. The script should:
   - Accept input via stdin or arguments
   - Output results to stdout
   - Exit 0 on success, non-zero on failure
   - Include a usage comment at the top

```bash
#!/bin/bash
# Usage: check-design-compliance.sh <file-path>
# Checks if a file follows DESIGN.md architecture conventions

set -euo pipefail
# ... implementation ...
```

4. Record the tool in `.claude/squad/knowledge/tool-patterns.md`

## Creating a Persistent Skill

Only when a tool has proven useful across multiple missions:

1. Create directory: `${CLAUDE_PLUGIN_ROOT}/skills/{skill-name}/`
2. Write `SKILL.md` with frontmatter:

```yaml
---
name: { skill-name }
description: Use when {specific trigger condition}. {What it does}.
---
```

3. The skill body teaches Claude HOW to do the thing, not just what to do
4. Record creation in `.claude/squad/knowledge/tool-patterns.md`

Note: New skills take effect in the next Claude Code session, not the current one.

## Identifying Tool Gaps

During RETRO, look for:

- Actions performed 3+ times manually during the mission
- Verification steps that could be automated
- Information gathering that follows a repeatable pattern
- Formatting or reporting tasks with a fixed structure
````

**Step 2: Commit**

```bash
git add skills/tool-forging/ && git commit -m "feat: add tool-forging skill — self-developing tools methodology"
```

---

### Task 6: gate-check skill

**Files:**

- Create: `d:\Code\squad\skills\gate-check\SKILL.md`

**Step 1: Write the skill**

Write to `d:\Code\squad\skills\gate-check\SKILL.md`:

````markdown
---
name: gate-check
description: Use when reaching a gate point in the squad pipeline (after PLAN, EXECUTE, or VERIFY). Determines whether to pause for user confirmation or proceed automatically based on the configured gate level.
---

# Gate Check — 閘門檢查

You've reached a gate point in the mission pipeline. Determine whether to pause or continue.

## Gate Levels

| Level        | after_plan | after_execute | after_verify |
| ------------ | ---------- | ------------- | ------------ |
| `supervised` | ⏸ Pause    | ⏸ Pause       | ⏸ Pause      |
| `standard`   | ⏸ Pause    | ▶ Continue    | ⏸ Pause      |
| `autonomous` | ▶ Continue | ▶ Continue    | ▶ Continue   |

## When Pausing

Present a structured summary of the completed stage:

**After PLAN:**

```
⏸ 作戰計畫已擬定。

[Plan summary with tasks, squad composition, execution strategy]

請確認計畫，或提出修改。
```

**After EXECUTE:**

```
⏸ 執行階段完成。

隊員成果：
• Alpha: ✅ 完成 task #1, #3
• Bravo: ✅ 完成 task #2
變更檔案：[list]

確認進入驗收？
```

**After VERIFY:**

```
⏸ 驗收結果：
- lint: ✅/❌
- typecheck: ✅/❌
- test: ✅/❌ (N → M tests)
- review: [findings summary]

確認結果？
```

## Override Rules

Even in `autonomous` mode, ALWAYS pause if:

- Verification fails and cannot be auto-fixed
- A squad member reports an unresolvable blocker
- The mission scope appears to have changed during execution
- Destructive actions are needed (deleting files, force-pushing, etc.)
````

**Step 2: Commit**

```bash
git add skills/gate-check/ && git commit -m "feat: add gate-check skill — configurable approval gates"
```

---

### Task 7: status-report skill

**Files:**

- Create: `d:\Code\squad\skills\status-report\SKILL.md`

**Step 1: Write the skill**

Write to `d:\Code\squad\skills\status-report\SKILL.md`:

````markdown
---
name: status-report
description: Use when generating the DEBRIEF mission report or when the user asks for /squad --status or --history. Defines the structured report format for squad missions.
---

# Status Report — 戰況報告

## Mission Report Format (DEBRIEF stage)

Write to `.claude/squad/reports/YYYY-MM-DD-{mission-slug}.md`:

```markdown
# Mission Report: {Mission Name}

> Date: {YYYY-MM-DD} | Gate: {level} | Duration: ~{N} min

## Objective

{Original objective as given by the 總統}

## Squad Composition

| Callsign | Forged Role     | Tasks  | Status      |
| -------- | --------------- | ------ | ----------- |
| Alpha    | {specific role} | #1, #3 | ✅ Complete |
| Bravo    | {specific role} | #2     | ✅ Complete |

## Task Breakdown

| #   | Description | Owner | Status | Notes                |
| --- | ----------- | ----- | ------ | -------------------- |
| 1   | {task}      | Alpha | ✅     | {any relevant notes} |
| 2   | {task}      | Bravo | ✅     |                      |

## Execution Summary

### RECON

{What was discovered about the codebase}

### PLAN

{Key planning decisions — why this decomposition, why these roles}

### EXECUTE

{How execution went — any blockers, pivots, or surprises}

### VERIFY

{Verification results and any fixes applied}

## Changes Made

{List all files created or modified, grouped by purpose}

## Verification Results

- lint: ✅/❌ {details if failed}
- typecheck: ✅/❌
- test: ✅/❌ ({before} → {after} tests)

## Lessons Learned

{Insights to carry forward — also written to knowledge/lessons.md}
```

## --status Format (in-progress mission)

```
── Squad Status ─────────────────────
Mission: {objective}
Stage: {current stage} ({N}/{total} stages)
Gate: {level}

Tasks:
  ✅ #1 {description} (Alpha)
  🔄 #2 {description} (Bravo) — in progress
  ⏳ #3 {description} — waiting for #1

Squad:
  Alpha: idle (completed #1)
  Bravo: working on #2
─────────────────────────────────────
```

## --history Format

Read all files in `.claude/squad/reports/` and present:

```
── Mission History ──────────────────
| Date | Mission | Gate | Squad Size | Result |
|------|---------|------|-----------|--------|
| 2026-02-28 | Keyboard shortcuts | standard | 3 | ✅ |
| 2026-03-01 | Dark theme | autonomous | 2 | ✅ |
─────────────────────────────────────
```
````

**Step 2: Commit**

```bash
git add skills/status-report/ && git commit -m "feat: add status-report skill — structured reporting formats"
```

---

### Task 8: retrospective skill

**Files:**

- Create: `d:\Code\squad\skills\retrospective\SKILL.md`

**Step 1: Write the skill**

Write to `d:\Code\squad\skills\retrospective\SKILL.md`:

````markdown
---
name: retrospective
description: Use during the RETRO stage after a squad mission completes. Guides reflection on efficiency, roles, tools, and process. Updates the persistent knowledge base to enable continuous improvement across missions.
---

# Retrospective — 反思進化

The mission is complete. Now reflect and evolve.

## Reflection Framework

Analyze the mission across four dimensions:

### 1. Efficiency (效率)

- Which tasks took longer than expected? Root cause?
- Was the task decomposition granularity appropriate?
- Were there unnecessary sequential dependencies that could have been parallel?
- Token/cost efficiency: did any squad member's context grow too large?

### 2. Roles (角色)

- Which persona designs produced focused, effective work?
- Which were too vague, causing the member to make unnecessary decisions?
- Were boundaries (禁止事項) respected? If not, what was missing?
- Record effective persona designs as **patterns** in `role-patterns.md`

### 3. Tools (工具)

- Were there actions performed 3+ times manually that should be scripted?
- Did verification commands cover all necessary checks?
- Are there project-specific checks that should become permanent tools?
- If gaps found → invoke the `tool-forging` skill

### 4. Process (流程)

- Was the gate level appropriate? Too many pauses (slowed down) or too few (missed issues)?
- Did the 6-stage pipeline flow smoothly, or were stages skipped/repeated?
- Was communication between squad members and lead sufficient?

## Knowledge Base Updates

After reflection, update these files:

### lessons.md

Append a dated entry:

```markdown
## {YYYY-MM-DD} — {Mission Name}

- {Lesson 1}
- {Lesson 2}
```

### role-patterns.md

If an effective persona was discovered, add it:

```markdown
## Pattern: {Pattern Name}

**When to use:** {Situation description}
**Persona template:**
{The effective prompt structure, with placeholders for mission-specific details}
**Why it works:** {Brief explanation}
```

### tool-patterns.md

If a useful tool was created or identified:

```markdown
## Tool: {Tool Name}

**Location:** {path}
**Purpose:** {what it automates}
**Created:** {date} | **Used in:** {mission count} missions
```

### metrics.md

Append mission metrics:

```markdown
## {YYYY-MM-DD} — {Mission Name}

- Squad size: {N}
- Tasks: {completed}/{total}
- Verification: {pass/fail}
- Gate: {level}
- Blockers: {count}
- New tools created: {count}
```

## Evolution Trigger

After updating the knowledge base, check if any of these thresholds are met:

- Same lesson appears 3+ times → Consider creating a permanent skill or hook
- Same tool pattern used 2+ times → Promote from bash script to formal skill
- Same role pattern used 3+ times → It's now a proven pattern, mark as "stable" in role-patterns.md
````

**Step 2: Commit**

```bash
git add skills/retrospective/ && git commit -m "feat: add retrospective skill — post-mission reflection and evolution"
```

---

### Task 9: hooks.json

**Files:**

- Create: `d:\Code\squad\hooks\hooks.json`

**Step 1: Write hooks configuration**

Write to `d:\Code\squad\hooks\hooks.json`:

```json
{
  "description": "Squad mission lifecycle hooks — progress tracking and completion validation",
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if a squad mission is currently active (look for references to squad stages: RECON, PLAN, EXECUTE, VERIFY, DEBRIEF, RETRO in recent context). If a mission IS active and not yet in DEBRIEF/RETRO stage, block stopping with: 'Squad mission still in progress. Complete remaining stages before stopping.' If no mission is active or mission is complete, approve stopping."
          }
        ]
      }
    ]
  }
}
```

**Step 2: Commit**

```bash
git add hooks/ && git commit -m "feat: add Stop hook — prevent premature mission termination"
```

---

### Task 10: defaults.yaml

**Files:**

- Create: `d:\Code\squad\config\defaults.yaml`

**Step 1: Write default configuration**

Write to `d:\Code\squad\config\defaults.yaml`:

```yaml
# Squad Plugin — Default Configuration
# Copy to .claude/squad/config.yaml to customize

# Gate level: supervised | standard | autonomous
default_gate: standard

# Report and knowledge paths (relative to project root)
reports_dir: .claude/squad/reports
knowledge_dir: .claude/squad/knowledge

# Evolution settings
evolution:
  retro_enabled: true # Run RETRO stage after each mission
  auto_create_tools: true # Allow squad to create bash scripts in tools/
  auto_create_skills: true # Allow squad to create new SKILL.md files

# Team constraints
team:
  max_members: 5 # Maximum concurrent squad members
  default_model: inherit # Model for squad members (inherit | sonnet | haiku | opus)
  use_worktrees: true # Isolate squad members in git worktrees


# Verification commands (auto-detected from project if empty)
# Uncomment and customize for your project:
# verify_commands:
#   - "pnpm lint"
#   - "pnpm typecheck"
#   - "pnpm test"
```

**Step 2: Commit**

```bash
git add config/ && git commit -m "feat: add default configuration template"
```

---

### Task 11: Knowledge base bootstrap templates

**Files:**

- Create: `d:\Code\squad\config\bootstrap\lessons.md`
- Create: `d:\Code\squad\config\bootstrap\role-patterns.md`
- Create: `d:\Code\squad\config\bootstrap\tool-patterns.md`
- Create: `d:\Code\squad\config\bootstrap\metrics.md`

These are templates copied to `.claude/squad/knowledge/` on first run.

**Step 1: Create bootstrap directory and template files**

```bash
mkdir -p /d/Code/squad/config/bootstrap
```

Write to `d:\Code\squad\config\bootstrap\lessons.md`:

```markdown
# Squad Lessons Learned

Accumulated insights from past missions. Read during RECON to avoid repeating mistakes.

<!-- Entries are appended by the RETRO stage after each mission -->
```

Write to `d:\Code\squad\config\bootstrap\role-patterns.md`:

```markdown
# Squad Role Patterns

Proven persona designs that produced effective squad members. Reference during PLAN stage when forging new roles.

<!-- Patterns are added by the RETRO stage when an effective persona is identified -->
```

Write to `d:\Code\squad\config\bootstrap\tool-patterns.md`:

```markdown
# Squad Tool Patterns

Tools and scripts created by the squad. Tracks usage across missions to identify candidates for promotion to formal skills.

<!-- Entries are added by the RETRO stage when tools are created or prove useful -->
```

Write to `d:\Code\squad\config\bootstrap\metrics.md`:

```markdown
# Squad Mission Metrics

Performance tracking across missions. Used during RETRO to identify trends.

<!-- Metrics are appended after each mission -->
```

**Step 2: Commit**

```bash
git add config/bootstrap/ && git commit -m "feat: add knowledge base bootstrap templates"
```

---

### Task 12: Final commit and installation test

**Step 1: Verify complete plugin structure**

```bash
cd /d/Code/squad && find . -type f | grep -v .git/ | sort
```

Expected output:

```
./.claude-plugin/plugin.json
./commands/squad.md
./config/bootstrap/lessons.md
./config/bootstrap/metrics.md
./config/bootstrap/role-patterns.md
./config/bootstrap/tool-patterns.md
./config/defaults.yaml
./hooks/hooks.json
./skills/gate-check/SKILL.md
./skills/mission-planning/SKILL.md
./skills/retrospective/SKILL.md
./skills/role-forging/SKILL.md
./skills/status-report/SKILL.md
./skills/tool-forging/SKILL.md
```

**Step 2: Install the plugin in Claude Code**

```
/plugins add /d/Code/squad
```

**Step 3: Verify plugin loads**

Start a new Claude Code session and check:

- `/squad --help` or `/squad "test"` is available as a command
- Skills appear in the skill list
- Hook is registered

**Step 4: Smoke test with a real mission**

```
/squad "Add a console.log to src/main/index.ts that prints 'Squad operational'" --gate supervised
```

Verify the full pipeline runs: RECON → PLAN (pause) → EXECUTE → VERIFY (pause) → DEBRIEF → RETRO.

**Step 5: Final commit if any adjustments needed**

```bash
git add -A && git commit -m "chore: finalize squad plugin v0.1.0"
```

---

## Summary

| Task | Files                            | Purpose                                           |
| ---- | -------------------------------- | ------------------------------------------------- |
| 1    | plugin.json + dirs               | Plugin scaffold                                   |
| 2    | commands/squad.md                | Main orchestration command (~200 lines of prompt) |
| 3    | skills/mission-planning/SKILL.md | Task decomposition methodology                    |
| 4    | skills/role-forging/SKILL.md     | Dynamic persona design                            |
| 5    | skills/tool-forging/SKILL.md     | Self-developing tools                             |
| 6    | skills/gate-check/SKILL.md       | Configurable approval gates                       |
| 7    | skills/status-report/SKILL.md    | Reporting formats                                 |
| 8    | skills/retrospective/SKILL.md    | Post-mission reflection + evolution               |
| 9    | hooks/hooks.json                 | Stop hook for mission completion                  |
| 10   | config/defaults.yaml             | Default configuration                             |
| 11   | config/bootstrap/\*.md           | Knowledge base templates                          |
| 12   | —                                | Integration test                                  |

Total: **14 files** to create. All markdown/JSON/YAML — zero compiled code.
