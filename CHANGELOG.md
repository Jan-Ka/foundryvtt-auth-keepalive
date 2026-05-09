# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
