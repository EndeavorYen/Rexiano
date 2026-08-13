# Release Signing and Notarization

Official production releases fail closed. A missing credential, failed test,
unexpected artifact, invalid signature, failed notarization check, or changed tag
stops the workflow before a GitHub Release becomes public. Release Please first
creates a draft and an immutable tag; the release workflow publishes that draft
only after every platform gate succeeds.

Local and fork builds may remain unsigned. `electron-builder.yml` deliberately
keeps `mac.notarize: false` so contributors can package the application without
maintainer credentials. That local setting is not an official release path: the
GitHub release workflow overrides it with mandatory signing and notarization and
has no unsigned fallback.

## Production release gates

The workflow accepts only a strict `vMAJOR.MINOR.PATCH` tag. It resolves annotated
and lightweight tags to a full commit SHA, requires that commit to be reachable
from `origin/main`, and checks that `package.json` contains the same version.
Release Please dispatches the workflow from `main` with both the tag and expected
SHA. Every later job checks out and verifies that exact SHA.

Release Please also dispatches CI and Windows Playwright for the exact commit of
every generated or updated release pull request. This explicit dispatch avoids
GitHub's `GITHUB_TOKEN` recursion suppression without storing a maintainer PAT.
Main branch protection requires `Lint`, `Typecheck`, `Test`, and
`Playwright (Windows)` from the GitHub Actions app, so a release pull request
cannot merge when those jobs are absent, stale, or failing. The artifact workflow
has a single authoritative release trigger: Release Please dispatches it from
`main` with the immutable tag commit; a tag push does not start a second build.

Before packaging, CI must pass the frozen install, lint, typecheck, and unit test
gate. A Windows runner also executes the real Playwright player-flow suite. The
release stays in draft state until all three platform packages have passed their
platform-specific checks:

- Windows: exact setup, portable executable, and portable zip inventory;
  Authenticode must report `Valid`, and `signtool verify /pa /tw /v` must pass for
  both published executables and the `Rexiano.exe` inside the zip.
- macOS: exactly two architecture-specific DMGs; both intermediate apps and the
  apps mounted from each DMG must have a Developer ID Application authority and
  consistent TeamIdentifier, pass Gatekeeper assessment, and contain a valid
  stapled notarization ticket.
- Linux: exact `x86_64`-named AppImage and `amd64`-named Debian package inventory
  from a checked build.

The publish job re-fetches the tag and requires exactly one matching draft. A
missing, duplicate, or already-public release fails closed, so the upload action
cannot create a replacement release without the notes prepared by Release
Please. It then downloads only verified artifacts, checks the exact seven
package files, creates a locale-stable `SHA256SUMS.txt`, and verifies that file
before making the prepared draft public. It appends the checksums without
replacing the Release Please notes.

## Required GitHub Actions secrets

### Windows Authenticode

Both values are mandatory for an official release:

- `WINDOWS_CSC_LINK`: an electron-builder-supported certificate value or secure
  URL, normally a base64-encoded `.pfx` or `.p12` certificate.
- `WINDOWS_CSC_KEY_PASSWORD`: the certificate password.

For non-exportable EV certificates, configure the certificate vendor's supported
cloud-signing integration before attempting an official release. The workflow
does not substitute an unsigned installer.

### macOS Developer ID and notarization

Both Developer ID certificate values are mandatory:

- `MACOS_CSC_LINK`: an electron-builder-supported Developer ID Application
  certificate value or secure URL.
- `MACOS_CSC_KEY_PASSWORD`: the certificate password.

Exactly one complete notarization credential set is mandatory. Partial sets,
both sets, and no set are all rejected.

App Store Connect API key set:

- `APPLE_API_KEY_BASE64`: base64-encoded `.p8` API key.
- `APPLE_API_KEY_ID`: API key ID.
- `APPLE_API_ISSUER`: issuer UUID.

Apple ID set:

- `APPLE_ID`: Apple Developer account email.
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password.
- `APPLE_TEAM_ID`: Developer Team ID.

For the API-key path, the runner decodes the key into a permission-restricted
temporary directory and deletes it after the single authoritative
electron-builder signing/notarization invocation.

## Failure behavior

- Missing or incomplete signing credentials fail the relevant build job.
- Providing both macOS notarization sets fails rather than choosing one
  implicitly.
- Any lint, typecheck, unit, Windows E2E, package inventory, signature,
  Gatekeeper, stapler, or checksum failure prevents publication.
- A tag that moves after initial resolution is rejected again by the publish
  job.
- The explicit workflow-dispatch run must find exactly one matching draft; it
  never creates a missing release as a fallback.
- A failed run may leave the Release Please draft available for diagnosis, but
  it cannot turn that draft into a public release.
- Pull-request CI does not need private signing secrets because it verifies the
  workflow contract without running the production release workflow.

## Issue #187 production evidence checklist

Do not close Issue #187 from configuration or unit-test evidence alone. It needs
one real production run using maintainer credentials and the following retained
evidence:

- Release workflow URL and run ID, with the tag, resolved SHA, `origin/main`, and
  `package.json` version shown to match.
- Green preflight and Windows player E2E jobs.
- Windows logs showing Authenticode `Valid` and successful `signtool` checks for
  setup, portable, and zip-contained executables.
- macOS logs showing Developer ID authority and TeamIdentifier plus successful
  `codesign`, Gatekeeper, and stapler checks for both intermediate and mounted
  DMG applications.
- Exact seven-package inventory and a published `SHA256SUMS.txt` that passes
  verification after download.
- Download, install, launch, and basic MIDI-player smoke evidence on supported
  Windows, Intel/Apple Silicon macOS, and Linux environments.
- A public GitHub Release whose target tag and commit remain identical to the
  validated values.

The contract itself is covered by:

```bash
pnpm vitest run scripts/releaseWorkflow.test.ts
```
