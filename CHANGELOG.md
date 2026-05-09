# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-05-09

Foundry VTT v14 release. Drops support for v12 and v13.

### Changed

- Migrated the re-auth dialog from the deprecated `Dialog` class to
  `foundry.applications.api.DialogV2`.
- Tightened the notification-removal path to the v14
  `ui.notifications.remove(notification)` shape; dropped the
  three-way polymorphic fallback that papered over older Foundry
  versions.
- Re-auth dialog now closes on button activation (the previous
  `return false` hack to keep it open is gone). The permanent error
  notification banner remains as the persistent indicator until
  recovery dismisses it.
- Compatibility raised to `minimum: 14`, `verified: 14`,
  `maximum: 14`.

### Added

- Test coverage for `auth-keepalive.ts` orchestration: inflight
  coalescing, expired/recovered state machine, recovery toast gating,
  start/stop/restart timer hygiene, media-error listener attach/skip
  and target filtering.
- `happy-dom` test environment for the orchestration tests; the
  `internal.ts` helpers continue to run under Node.

### Removed

- Foundry v12 and v13 support. Use a 0.2.x release if you need
  either.

## [0.2.0] - 2026-05-09

No runtime behavior changes. Maintenance release covering repository
hygiene, hardened release pipeline, and devDependency bumps.

### Changed

- Tightened TypeScript compiler options (`noUnusedLocals`,
  `noImplicitReturns`, `noFallthroughCasesInSwitch`).
- Expanded ESLint rule set (`no-constant-condition`,
  `no-constant-binary-expression`, `no-duplicate-case`, `no-empty`,
  `no-fallthrough`, `no-useless-assignment`, `no-useless-escape`,
  `no-self-assign`).
- Release workflow now extracts the matching `CHANGELOG.md` section
  into the GitHub Release body, with paragraph reflow to avoid GFM
  hard-wrap rendering as `<br>`.
- Pre-commit hook also blocks staged `.vscode/` and `.idea/` paths.
- Renovate groups non-major runtime `dependencies` into a single PR.
- Suppressed `no-explicit-any` on Foundry runtime globals (`Hooks`,
  `game`, `ui`, `Dialog`) with intent-bearing comments instead of
  importing heavy community type packages.

### Added

- `.editorconfig`, `.markdownlint.json`.
- Issue and pull-request templates.
- `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`.
- README install / verify guidance.

### Fixed

- README accuracy issues.

### Chore

- Bumped `@cyclonedx/cdxgen` to 12.3.3 and refreshed `fast-uri` to
  3.1.2.
