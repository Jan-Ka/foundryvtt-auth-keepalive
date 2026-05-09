## Summary

<!-- One paragraph: what does this change and why. -->

## Linked issues

Closes #

## How to test

<!-- Concrete steps a reviewer can run. Runtime changes need a manual
     check in a live Foundry world behind a real forward-auth proxy;
     the type checker can't catch broken keepalive flows. -->

1.
2.

## Checklist

- [ ] `pnpm run check` passes (lint + typecheck + tests + build)
- [ ] If the change affects the keepalive ping, expiry detection, or
      re-auth dialog, I tested it in a live Foundry world behind a
      forward-auth proxy.
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org).

## Notes for the reviewer

<!-- Anything unusual: tradeoffs you considered, things you weren't
     sure about, follow-ups deferred to a later PR. -->
