# Contributing to Rexiano

Thanks for your interest in contributing to Rexiano! This is a piano practice app built by a dad for his son -- and open-sourced for everyone. Whether you want to fix a bug, add a feature, improve documentation, or translate the UI, we appreciate your help.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Git](https://git-scm.com/)

### Getting Started

```bash
git clone https://github.com/nickhsu-endea/Rexiano.git
cd Rexiano
pnpm install
pnpm dev
```

### Useful Commands

| Command            | Description                               |
| ------------------ | ----------------------------------------- |
| `pnpm dev`         | Start in development mode with HMR        |
| `pnpm dev:sandbox` | Start in dev mode (non-WSL2 environments) |
| `pnpm test`        | Run all tests with Vitest                 |
| `pnpm test:watch`  | Run tests in watch mode                   |
| `pnpm lint`        | Lint the codebase with ESLint             |
| `pnpm typecheck`   | Run TypeScript compiler checks            |
| `pnpm format`      | Format code with Prettier                 |
| `pnpm build`       | Typecheck + production build              |
| `pnpm build:win`   | Build Windows installer (.exe)            |
| `pnpm build:mac`   | Build macOS disk image (.dmg)             |
| `pnpm build:linux` | Build Linux packages (.AppImage, .deb)    |

### Verify Before Submitting

Always run all three checks before pushing:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Branch Strategy

- **`main`** -- Stable, release-ready. Protected branch; changes via PR only.
- **`dev`** -- Active development. Feature branches merge here.
- **Feature branches** -- Branch off `dev`, named `feat/<description>` or `fix/<description>`.

## Pull Request Process

1. Fork the repo and create your branch from `dev`.
2. Make your changes. Add or update tests as appropriate.
3. Ensure all checks pass: `pnpm lint && pnpm typecheck && pnpm test`
4. Open a PR targeting the `dev` branch.
5. Describe what your PR does and link any related issues.

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add speed slider to practice mode
fix: correct note rendering at high BPM
docs: update ROADMAP for phase 7
refactor: extract MIDI parser into separate module
test: add coverage for AB loop selector
```

## Code Style

- TypeScript strict mode is enabled.
- Formatting is handled by Prettier -- run `pnpm format` before committing.
- ESLint enforces code quality -- run `pnpm lint` to check.
- Prefer named exports over default exports.
- Write descriptive variable names; avoid abbreviations.

## Project Architecture

See [docs/DESIGN.md](docs/DESIGN.md) for the full system design. The codebase follows a strict three-layer architecture:

| Layer        | Location                     | Rules                                             |
| ------------ | ---------------------------- | ------------------------------------------------- |
| **Engines**  | `src/renderer/src/engines/`  | Pure logic. No React imports. No DOM access.      |
| **Stores**   | `src/renderer/src/stores/`   | Zustand stores. Bridge between engines and React. |
| **Features** | `src/renderer/src/features/` | React UI components.                              |

### Key Conventions

- **PixiJS engine** reads Zustand state via `store.getState()` (not React hooks) to avoid unnecessary re-renders
- **Theme colors** use CSS Custom Properties: `var(--color-*)`, defined in `themes/tokens.ts`
- **Callback pattern** for engine-to-store communication (not EventEmitter)
- **IPC** uses `number[]` instead of `Uint8Array` (Electron structured clone compatibility)
- **Test files** live alongside their source modules (`*.test.ts`)
- **Fonts** are bundled offline via `@fontsource` (Nunito, DM Sans, JetBrains Mono)

## Areas Where Help Is Appreciated

Check [docs/ROADMAP.md](docs/ROADMAP.md) for the full task list. Items marked `[ ]` are available to work on. Some areas where contributions are especially welcome:

- **Built-in songs** -- Curating beginner-friendly MIDI files for the song library
- **Translations** -- Adding i18n support (English + Chinese initially)
- **Accessibility** -- ARIA labels, keyboard navigation, screen reader support
- **Documentation** -- Screenshots, tutorials, improved guides
- **Testing** -- Expanding test coverage for existing features

## Reporting Issues

Use [GitHub Issues](https://github.com/nickhsu-endea/Rexiano/issues) with the provided templates. Include:

- Your operating system and version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)

## Suggesting Features

Use the [feature request template](https://github.com/nickhsu-endea/Rexiano/issues/new?template=feature_request.md). Check `docs/ROADMAP.md` first to see if the feature is already planned.

## Code of Conduct

Be kind. This is a project built for a child learning piano. Keep discussions constructive and welcoming to contributors of all skill levels.

## License

By contributing, you agree that your contributions will be licensed under the [GPL-3.0 License](LICENSE).
