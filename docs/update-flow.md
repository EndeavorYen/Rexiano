# Update Flow

Rexiano uses a small, mockable GitHub Releases update helper instead of a
background auto-updater dependency.

## Runtime Behavior

- Development builds return `disabled` and do not call GitHub.
- Packaged builds call the latest GitHub Release endpoint for
  `EndeavorYen/Rexiano`.
- The checker compares the current app version with the release tag and selects
  the installer artifact that matches the current platform and architecture.
- Downloads are user-triggered from Settings > About. Progress is sent over IPC,
  and Rexiano opens the downloaded installer only after the user chooses to do
  so.
- The app does not show update modals during practice. Child focus mode keeps
  the update affordance contained in the About panel.

## Verification

Automated coverage:

```sh
pnpm test src/main/ipc/updateChecker.test.ts src/main/ipc/updateHandlers.test.ts src/renderer/src/features/settings/appUpdateViewModel.test.ts
pnpm build
pnpm exec playwright test e2e/update-flow.spec.ts
```

Dry packaged check:

```sh
pnpm build:unpack
open dist/mac*/Rexiano.app
```

Then open Settings > About and click **Check for updates**. In a packaged build,
the status should be one of:

- `not-available` when the bundled version is current.
- `available` when GitHub Releases has a newer matching artifact.
- `failed` with a user-visible message if GitHub metadata is unavailable or no
  artifact matches the platform.

Because local dry runs may be unsigned, keep the signing/notarization warnings in
`docs/release-signing.md` in sync with release artifacts.
