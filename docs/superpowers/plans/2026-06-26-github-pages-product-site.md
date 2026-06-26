# Rexiano GitHub Pages Product Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy an independent GitHub Pages product site for Rexiano.

**Architecture:** Add a standalone Vite React app under `site/` that reuses the repository's existing React/Vite dependencies through root scripts. The site builds to `site/dist` with Vite base `/Rexiano/`, copies current README screenshot assets into `site/public/assets`, and deploys through a dedicated GitHub Pages workflow.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, CSS, existing `@fontsource` fonts, existing `lucide-react`, GitHub Actions Pages.

---

## File Structure

- Create `site/package.json`: private metadata for the Pages app.
- Create `site/index.html`: static HTML shell and SEO/social metadata.
- Create `site/vite.config.ts`: Vite config with React plugin and `/Rexiano/` base.
- Create `site/tsconfig.json`: site-specific TypeScript settings.
- Create `site/scripts/sync-assets.mjs`: copies the current README screenshots and icon into `site/public/assets`.
- Create `site/src/main.tsx`: React entrypoint.
- Create `site/src/App.tsx`: single-page product/documentation hub with gallery and platform selector state.
- Create `site/src/styles.css`: site visual system, layout, responsive behavior, focus states, and motion rules.
- Create `.github/workflows/pages.yml`: build and deploy `site/dist` to GitHub Pages.
- Modify root `package.json`: add `site:assets`, `site:dev`, `site:build`, `site:preview`, and `site:typecheck` scripts.

## Task 1: Scaffold the Pages App and Asset Sync

**Files:**

- Create: `site/package.json`
- Create: `site/index.html`
- Create: `site/vite.config.ts`
- Create: `site/tsconfig.json`
- Create: `site/scripts/sync-assets.mjs`
- Create: `site/src/main.tsx`
- Modify: `package.json`

- [ ] **Step 1: Add root scripts**

  Modify root `package.json` scripts:

  ```json
  {
    "site:assets": "node site/scripts/sync-assets.mjs",
    "site:dev": "pnpm site:assets && vite --config site/vite.config.ts --host 127.0.0.1",
    "site:build": "pnpm site:assets && vite build --config site/vite.config.ts",
    "site:preview": "vite preview --config site/vite.config.ts --host 127.0.0.1",
    "site:typecheck": "tsc --noEmit -p site/tsconfig.json"
  }
  ```

- [ ] **Step 2: Add site package metadata**

  Create `site/package.json`:

  ```json
  {
    "name": "rexiano-site",
    "private": true,
    "version": "1.3.0",
    "type": "module"
  }
  ```

- [ ] **Step 3: Add Vite config**

  Create `site/vite.config.ts`:

  ```ts
  import { resolve } from "node:path";
  import react from "@vitejs/plugin-react";
  import { defineConfig } from "vite";

  export default defineConfig({
    root: resolve(__dirname),
    base: "/Rexiano/",
    plugins: [react()],
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  });
  ```

- [ ] **Step 4: Add TypeScript config**

  Create `site/tsconfig.json`:

  ```json
  {
    "extends": "../tsconfig.web.json",
    "compilerOptions": {
      "composite": false,
      "noEmit": true,
      "types": ["vite/client"]
    },
    "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"]
  }
  ```

- [ ] **Step 5: Add HTML shell**

  Create `site/index.html` with:

  ```html
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="Rexiano is an open-source piano practice app with falling notes, sheet music, MIDI keyboard support, and focused practice tools."
      />
      <meta property="og:title" content="Rexiano" />
      <meta
        property="og:description"
        content="Open-source piano practice with falling notes, sheet music, MIDI keyboards, and focused practice tools."
      />
      <title>Rexiano - Open-source piano practice</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
    </body>
  </html>
  ```

- [ ] **Step 6: Add asset sync script**

  Create `site/scripts/sync-assets.mjs` that copies:
  - `docs/assets/screenshots/rexiano-library.png`
  - `docs/assets/screenshots/rexiano-practice.png`
  - `docs/assets/screenshots/rexiano-split-sheet.png`
  - `docs/figure/Rexiano_icon.png`

  into `site/public/assets/`.

- [ ] **Step 7: Add React entrypoint**

  Create `site/src/main.tsx`:

  ```tsx
  import React from "react";
  import { createRoot } from "react-dom/client";
  import { App } from "./App";
  import "./styles.css";

  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  ```

- [ ] **Step 8: Verify scaffold**

  Run: `pnpm site:assets`

  Expected: `site/public/assets` contains four copied PNG files.

## Task 2: Implement the Product Page

**Files:**

- Create: `site/src/App.tsx`
- Create: `site/src/styles.css`

- [ ] **Step 1: Define data arrays in `App.tsx`**

  Add typed arrays for nav links, features, flow steps, screenshots, platform notes, docs links, and footer links.

- [ ] **Step 2: Build the hero**

  Implement one H1, lead copy, three CTAs, and real screenshot composition using:
  - `/assets/rexiano-practice.png`
  - `/assets/rexiano-library.png`
  - `/assets/rexiano-split-sheet.png`

- [ ] **Step 3: Build Practice Flow**

  Add three steps: Choose a song, Practice with Wait mode, Review progress.

- [ ] **Step 4: Build Feature Tour**

  Add guided sections for falling notes, sheet music, MIDI, practice modes, progress, and offline audio.

- [ ] **Step 5: Build Screenshot Gallery**

  Add accessible buttons that switch selected screenshot state. Each button updates the displayed image, title, and caption.

- [ ] **Step 6: Build Getting Started**

  Add accessible platform buttons for Windows, macOS, and Linux. Each button updates platform notes and links to releases/installation docs.

- [ ] **Step 7: Build Docs Hub and Footer**

  Add docs links for user guide, installation, MIDI setup, architecture, roadmap, release signing, and update flow. Close with GPL-3.0 and GitHub links.

- [ ] **Step 8: Style the page**

  Implement the Ocean-inspired token system, responsive layout, screenshot frames, sticky header, focus states, reduced motion handling, and the falling-note staff rail.

- [ ] **Step 9: Verify build**

  Run: `pnpm site:typecheck && pnpm site:build`

  Expected: both commands exit `0`, and `site/dist/index.html` exists.

## Task 3: Add GitHub Pages Deployment

**Files:**

- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Add workflow**

  Create a workflow that runs on pushes to `main` and `workflow_dispatch`, uses Node 22 and pnpm, runs `pnpm install --frozen-lockfile`, builds with `pnpm site:build`, uploads `site/dist`, and deploys to Pages.

- [ ] **Step 2: Verify workflow syntax by inspection**

  Check the workflow includes:
  - `permissions.contents: read`
  - `permissions.pages: write`
  - `permissions.id-token: write`
  - `environment.name: github-pages`
  - `actions/configure-pages`
  - `actions/upload-pages-artifact`
  - `actions/deploy-pages`

## Task 4: Local Browser QA

**Files:**

- Modify only if QA finds defects: `site/src/App.tsx`, `site/src/styles.css`

- [ ] **Step 1: Start preview**

  Run: `pnpm site:build && pnpm site:preview -- --port 4173`

  Expected: preview serves the Pages build at `http://127.0.0.1:4173/Rexiano/`.

- [ ] **Step 2: Browser QA**

  Verify:
  - Page title and URL are correct.
  - Page is not blank.
  - No framework overlay.
  - Console has no relevant errors.
  - Screenshot gallery buttons update visible image/copy.
  - Platform selector updates visible platform notes.
  - Desktop and mobile layouts have no clipping or overlap.

- [ ] **Step 3: Fix defects and rerun**

  If QA finds layout or interaction defects, patch `site/src/App.tsx` or `site/src/styles.css`, then rerun `pnpm site:build` and repeat browser QA.

## Task 5: Final Verification

**Files:**

- No expected edits.

- [ ] **Step 1: Format changed files**

  Run:

  ```bash
  pnpm exec prettier --write package.json site/package.json site/index.html site/vite.config.ts site/tsconfig.json site/scripts/sync-assets.mjs site/src/main.tsx site/src/App.tsx site/src/styles.css .github/workflows/pages.yml docs/superpowers/specs/2026-06-26-github-pages-product-site-design.md docs/superpowers/plans/2026-06-26-github-pages-product-site.md
  ```

- [ ] **Step 2: Run checks**

  Run:

  ```bash
  pnpm site:typecheck
  pnpm site:build
  git diff --check
  ```

- [ ] **Step 3: Report evidence**

  Final report should include changed files, build/typecheck evidence, browser QA evidence, preview URL, and remaining risk.
