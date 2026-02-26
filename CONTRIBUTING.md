# Contributing to Rexiano

Thanks for your interest in contributing to Rexiano! This guide will help you get started.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Git](https://git-scm.com/)

### Getting Started

```bash
git clone https://github.com/EndeavorYen/Rexiano.git
cd Rexiano
pnpm install
pnpm dev
```

### Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start in development mode |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint the codebase |
| `pnpm typecheck` | Run TypeScript type checks |
| `pnpm build` | Build the application |

## Branch Strategy

- **`main`** — Stable, release-ready. Protected branch; changes via PR only.
- **`dev`** — Active development. Feature branches merge here.
- **Feature branches** — Branch off `dev`, named `feat/<description>` or `fix/<description>`.

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
- Formatting is handled by Prettier — run `pnpm format` before committing.
- ESLint enforces code quality — run `pnpm lint` to check.

## Project Architecture

See [docs/DESIGN.md](docs/DESIGN.md) for the full system design. Key conventions:

- **PixiJS engine** reads Zustand state via `store.getState()` (not React hooks)
- **Theme colors** use CSS Custom Properties `var(--color-*)`
- **Test files** live alongside their modules (`*.test.ts`)
- **Fonts** are bundled offline via `@fontsource`

## Reporting Issues

Use [GitHub Issues](https://github.com/EndeavorYen/Rexiano/issues) with the provided templates. Include:

- Steps to reproduce
- Expected vs actual behavior
- OS and Electron version

## License

By contributing, you agree that your contributions will be licensed under the [GPL-3.0 License](LICENSE).
