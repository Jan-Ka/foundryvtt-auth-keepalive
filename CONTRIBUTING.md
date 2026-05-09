# Contributing to foundryvtt-auth-keepalive

Thanks for your interest in helping out! Bug reports and pull requests
are welcome.

## Quick links

- Bugs and feature requests: <https://github.com/Jan-Ka/foundryvtt-auth-keepalive/issues>
- Security issues: see [SECURITY.md](SECURITY.md) — please **do not**
  file public issues for those.

## Development setup

You need Node.js ≥ 24 and pnpm 10 (the version is pinned via
`packageManager` in `package.json` — corepack will pick it up
automatically).

```bash
pnpm install         # installs deps and wires up git hooks via husky
pnpm run build       # bundle the ES module entry script
pnpm run watch       # rebuild on change
pnpm run check       # lint + typecheck + tests + build
```

The first `pnpm install` runs `husky` and configures `core.hooksPath`,
which enables:

- **pre-commit**: blocks staged paths that look like AI-coding-tool
  workspace files (`.claude/`, `CLAUDE.md`, `.cursor/`, etc.), then
  runs `lint-staged` (ESLint with `--fix`) on staged TypeScript files.
  Bypass with `--no-verify` only when intentional.

## Branching and pull requests

- Target `main` with pull requests.
- Keep PRs focused — one logical change per PR is much easier to review.
- Run `pnpm run check` locally before pushing.
- For runtime changes, please verify in a live Foundry world behind a
  real forward-auth proxy; the type checker can't catch broken
  keepalive flows or dialog regressions.

## Code style

- TypeScript across `src/module/`. The bundle is built with esbuild.
- Vanilla DOM (`addEventListener`, `querySelector`) — no jQuery.
- AI coding tool files (`CLAUDE.md`, `.cursor/`, etc.) are gitignored
  intentionally and the pre-commit hook hard-fails if they slip through.

## Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org).
`commitlint` runs in CI on every PR.

```text
<type>(<optional scope>): <subject>

<optional body>

<optional footers>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`,
`build`, `ci`, `perf`, `style`. Examples:

```text
fix(ping): treat opaqueredirect as session expiry
feat(dialog): add re-auth button label override setting
docs(contributing): document the commitlint rules
```

Other rules:

- Imperative mood in the subject ("fix", not "fixed" or "fixes").
- The body should explain *why*, not *what* — the diff shows what.

## Cutting a release

1. Bump `"version"` in `src/module.json` and `package.json` to the
   next semver string.
2. Populate the `[Unreleased]` section in `CHANGELOG.md` with the
   changes since the last release, then rename it to the new version.
3. Commit: `chore(release): v0.2.0`
4. Run the appropriate task:

   ```bash
   task release:patch   # v0.1.0 → v0.1.1
   task release:minor   # v0.1.0 → v0.2.0
   task release:major   # v0.1.0 → v1.0.0
   ```

   The task verifies that `src/module.json` and `package.json` already
   carry the computed next version, then creates and pushes the tag.
   CI triggers automatically on `v*` tags and produces the signed
   `foundryvtt-auth-keepalive.zip`, SBOM, `module.json`, and checksum.

## Verifying a release

Release artifacts are signed with [cosign](https://docs.sigstore.dev/)
keyless signing via GitHub Actions OIDC. To verify a downloaded
`foundryvtt-auth-keepalive.zip` using the published bundle:

<!-- markdownlint-disable MD013 -->
```bash
cosign verify-blob \
  --bundle foundryvtt-auth-keepalive.zip.bundle \
  --certificate-identity-regexp 'https://github\.com/Jan-Ka/foundryvtt-auth-keepalive/\.github/workflows/release\.yml@refs/tags/.+' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  foundryvtt-auth-keepalive.zip
```
<!-- markdownlint-enable MD013 -->

Each release also includes a CycloneDX SBOM (`sbom.cdx.json`) and a
SHA-256 checksum file (`foundryvtt-auth-keepalive.zip.sha256`).
