# Release Signing and Notarization

Rexiano keeps unsigned community builds possible by default. Official public
releases can become signed/notarized once maintainers provide the required
secrets to GitHub Actions.

## Current CI Policy

- Windows and macOS release jobs build unsigned artifacts by default.
- `CSC_IDENTITY_AUTO_DISCOVERY=false` prevents accidental signing attempts on CI
  hosts that do not have project credentials.
- `electron-builder.yml` keeps `mac.notarize: false`, so docs must not imply
  notarization is active.

## Windows Signing Path

Required maintainer assets:

- EV or OV code-signing certificate exported in a format supported by
  electron-builder.
- `CSC_LINK` secret containing the certificate or a secure download URL.
- `CSC_KEY_PASSWORD` secret for the certificate password.

When these secrets are present, remove the unsigned override from the Windows
release job and run `pnpm build:win`. Keep local developer builds unsigned.

## macOS Signing and Notarization Path

Required maintainer assets:

- Apple Developer ID Application certificate.
- `CSC_LINK` and `CSC_KEY_PASSWORD` for the certificate.
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` secrets for
  notarization.

When these are available, enable `mac.notarize` in `electron-builder.yml` and
remove the macOS `CSC_IDENTITY_AUTO_DISCOVERY=false` override in the release
workflow.

## User-Facing Copy

Installation docs should continue to describe SmartScreen and Gatekeeper
workarounds for unsigned builds. Once official builds are signed/notarized,
update those warnings to distinguish official releases from local/dev builds.
