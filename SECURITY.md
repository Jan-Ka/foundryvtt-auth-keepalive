# Security Policy

## Supported versions

Only the latest released version of this module receives security fixes.
The module targets the current stable Foundry VTT (v12/v13) line.

## Reporting a vulnerability

If you believe you have found a security vulnerability — whether a code
flaw, a dependency CVE that affects this module, or a runtime issue that
could harm a Foundry world or leak session credentials — please report
it privately rather than opening a public issue.

**Preferred channel:**

- GitHub: open a private security advisory at
  <https://github.com/Jan-Ka/foundryvtt-auth-keepalive/security/advisories/new>.
  This is the most reliable channel and the response stays threaded.

Please include:

- A description of the issue and the impact you observed.
- Steps to reproduce, or a minimal proof-of-concept.
- The version of the module, Foundry, and your forward-auth proxy
  (Authentik / Traefik versions where relevant).

We aim to acknowledge reports within 7 days and to ship a fix or
mitigation within 30 days for actionable vulnerabilities. Coordinated
disclosure is welcome.

## Out of scope

- Vulnerabilities in Foundry VTT core, Authentik, Traefik, or other
  third-party software (please report those to their respective
  maintainers).
- Issues that depend on a malicious GM or world owner — Foundry's trust
  model already grants those roles full control.
- Misconfigured forward-auth proxies (e.g. fixed-lifetime sessions, a
  cross-origin keepalive endpoint) — those are deployment issues, not
  module vulnerabilities.
