# foundryvtt-auth-keepalive

Foundry VTT module that keeps SSO sessions alive behind an Authentik forward-auth
proxy (Traefik `forwardAuth` → Authentik embedded outpost) and surfaces a clear
re-auth prompt when they expire.

## The problem

Foundry instances behind an OIDC forward-auth proxy share one failure mode: when
a connected player's IdP session cookie expires mid-game, subsequent asset
requests (audio tracks from the Music Player, scene backgrounds, token images)
get a cross-origin 302 to the IdP authorize URL. Browsers can't follow auth-flow
redirects from media elements across origins, so the request fails as a CORS
error and playback silently dies. The bug is per-cookie, so every connected
client (GM and players alike) needs the fix.

## What this module does

1. **Keepalive ping.** From every connected client, every ~4 minutes, performs
   `fetch('/api/status', { credentials: 'include', cache: 'no-store', redirect: 'manual' })`.
   A successful 200 touches the upstream session cookie and keeps it alive.
2. **Failure detection.** Treats network/CORS errors, non-2xx status, or
   `response.type === 'opaqueredirect'` (the IdP 302) as session expiry.
3. **Surface the failure.** On expiry, shows a permanent
   `ui.notifications.error` and a modal `Dialog` with a re-auth button that
   opens the configured URL in a new tab.
4. **Auto-recovery.** Once the user re-authenticates and the next ping
   succeeds, the notification and dialog dismiss themselves and Foundry's
   normal asset fetching recovers.
5. **Polish.** Listens for `error` events on `<audio>`/`<video>`/`<img>`
   elements to probe the session immediately when an asset fails to load.

## Settings

All exposed in the in-app **Configure Settings** UI.

| Setting                 | Scope  | Default       | Notes                                                                                                                                        |
| ----------------------- | ------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Keepalive interval (ms) | client | `240000`      | Values below `30000` are ignored. Changes take effect immediately.                                                                           |
| Keepalive endpoint      | world  | `/api/status` | Path or URL the ping hits. Use a same-origin path so the session cookie is sent.                                                             |
| Re-authentication URL   | world  | *(empty)*     | Empty falls back to `/outpost.goauthentik.io/start?rd=<current-url>` — right default for an Authentik embedded outpost on the same hostname. |
| First probe delay (ms)  | client | `5000`        | Delay after `ready` before the first probe runs.                                                                                             |
| Show recovery toast     | client | `true`        | Info toast when a previously-expired session is restored.                                                                                    |
| Probe on media errors   | client | `true`        | Probe immediately when an `<audio>`/`<video>`/`<img>` fails to load.                                                                         |

## Install

Install at the **world** level so it loads automatically for every connected
client. Use the manifest URL from the
[latest release](https://github.com/Jan-Ka/foundryvtt-auth-keepalive/releases/latest):

```text
https://github.com/Jan-Ka/foundryvtt-auth-keepalive/releases/latest/download/module.json
```

## Develop

```sh
task setup     # install deps + first build
task watch     # rebuild on change
task check     # lint + typecheck + build (mirrors CI)
task package   # produce build/artifacts/foundryvtt-auth-keepalive.zip
```

Tag a release as `vX.Y.Z` to trigger the GitHub Actions release workflow,
which packages the zip, generates a CycloneDX SBOM, signs everything with
cosign keyless, and publishes a GitHub Release.

## Non-goals

- Refreshing the cookie via JS (it's `HttpOnly`).
- Changing the IdP, the proxy, or the deployment.
- Retrying failed media requests — Foundry's normal asset fetching recovers
  once the cookie is back.
