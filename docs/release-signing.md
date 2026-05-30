# Release Signing and Notarization

Rexiano keeps unsigned community builds possible by default. Official release
jobs are now secret-aware: they sign and notarize only when maintainers provide
the required GitHub Actions secrets, and otherwise keep producing unsigned
artifacts.

This setup follows electron-builder's documented environment-variable flow:
Windows signing can use `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`, macOS signing
can use `CSC_LINK` / `CSC_KEY_PASSWORD`, and notarization requires one complete
Apple credential set.

## Current CI Policy

- Windows release builds read optional `WINDOWS_CSC_LINK` and
  `WINDOWS_CSC_KEY_PASSWORD` secrets. If either value is missing, the job clears
  signing certificate variables, sets `CSC_IDENTITY_AUTO_DISCOVERY=false`, and
  produces an unsigned installer.
- macOS release builds read optional certificate and Apple notarization secrets.
  If either the certificate or notarization credentials are incomplete, the job
  clears certificate variables and runs
  `electron-builder --mac -c.mac.identity=null -c.mac.notarize=false`.
- `electron-builder.yml` keeps `mac.notarize: false` for local builds. The
  release workflow passes `-c.mac.notarize=true` only when the required macOS
  signing and notarization secrets are present.

## Windows Signing Path

Required maintainer assets:

- EV or OV code-signing certificate in an electron-builder-supported form, such
  as a base64-encoded `.pfx` / `.p12` certificate or a secure HTTPS download URL.
- `WINDOWS_CSC_LINK` GitHub secret containing the certificate value or URL.
- `WINDOWS_CSC_KEY_PASSWORD` GitHub secret containing the certificate password.

For EV certificates that cannot be exported from a hardware token, use the
certificate vendor's cloud signing flow or add a custom electron-builder signing
hook before enabling official signed Windows releases.

Verification commands after a signed Windows release build:

```powershell
Get-AuthenticodeSignature .\dist\Rexiano-*-setup.exe
signtool verify /pa /tw .\dist\Rexiano-*-setup.exe
```

## macOS Signing and Notarization Path

Required maintainer assets:

- Apple Developer ID Application certificate exported in an
  electron-builder-supported form.
- `MACOS_CSC_LINK` GitHub secret containing the certificate value or URL.
- `MACOS_CSC_KEY_PASSWORD` GitHub secret containing the certificate password.

Preferred notarization secrets:

- `APPLE_API_KEY_BASE64`: base64-encoded App Store Connect API key `.p8` file.
- `APPLE_API_KEY_ID`: App Store Connect API key ID.
- `APPLE_API_ISSUER`: App Store Connect issuer UUID.

Alternative notarization secrets:

- `APPLE_ID`: Apple Developer account email.
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password for that Apple ID.
- `APPLE_TEAM_ID`: Apple Developer Team ID.

The workflow materializes `APPLE_API_KEY_BASE64` into a temporary `.p8` file,
then exports `APPLE_API_KEY` only when that file and its companion API key
metadata are present. If the API key set is missing or incomplete, the workflow
can still notarize with the Apple ID app-specific password set.

Verification commands after a signed and notarized macOS build:

```bash
codesign --verify --deep --strict --verbose=2 "dist/mac/Rexiano.app"
spctl --assess --type execute --verbose "dist/mac/Rexiano.app"
xcrun stapler validate "dist/Rexiano-"*.dmg
```

## Unsigned Fallback Evidence

The release workflow contract is covered by:

```bash
pnpm vitest run scripts/releaseWorkflow.test.ts
```

That test asserts Windows and macOS signing secrets are optional and that the
macOS job keeps an explicit unsigned fallback path. PR CI still runs without
private signing secrets.

## User-Facing Copy

Installation docs should continue to describe SmartScreen and Gatekeeper
workarounds for unsigned local/dev builds. Once official releases are actually
signed and notarized with maintainer credentials, update those warnings to
distinguish official releases from local or fork builds.
