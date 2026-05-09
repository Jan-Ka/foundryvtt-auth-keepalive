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
   `fetch('/api/status', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' })`.
   A successful 200 touches the upstream session cookie and keeps it alive.
2. **Failure detection.** Treats fetch errors (network failure, blocked
   redirect), any non-2xx status, or `response.type === 'opaqueredirect'`
   (the IdP 302 surfaced by `redirect: 'manual'`) as session expiry.
3. **Surface the failure.** On expiry, shows a permanent
   `ui.notifications.error` and a modal `Dialog` with a re-auth button that
   opens the configured URL in a new tab.
4. **Auto-recovery.** Once the user re-authenticates and the next ping
   succeeds, the notification and dialog dismiss themselves and Foundry's
   normal asset fetching recovers.
5. **Polish.** Listens for `error` events on `<audio>`/`<video>`/`<img>`
   elements to probe the session immediately when an asset fails to load.

## Requirements

- **Foundry VTT** v14.
- **A forward-auth proxy that refreshes the IdP cookie on each authenticated
  request.** Authentik's embedded outpost does this by default (sliding
  session) — the keepalive ping only works because every successful pass
  through the proxy resets the cookie's lifetime. If your proxy is
  configured for fixed-lifetime sessions, this module will fail to extend
  them and you'll see the dialog instead.
- **Same-origin keepalive endpoint.** The module only sends credentials
  to the same origin as the Foundry tab. A cross-origin URL in the
  endpoint setting is silently dropped back to the default.

## Install

1. In the Foundry **Setup** screen, open *Add-on Modules → Install Module*.
2. Paste this manifest URL into *Manifest URL* and click **Install**:

   ```text
   https://github.com/Jan-Ka/foundryvtt-auth-keepalive/releases/latest/download/module.json
   ```

3. Launch your world, open *Game Settings → Manage Modules*, tick
   **Auth Keepalive**, click *Save Module Settings*, and let the world
   reload. Every connected client (GM and players) now runs the keepalive
   automatically — there's nothing to install per-player.

## Settings

All exposed in the in-app **Configure Settings** UI.

| Setting                 | Scope  | Default       | Notes                                                                                                                                                                                                                          |
| ----------------------- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Keepalive interval (ms) | client | `240000`      | Values below `30000` are ignored. Changes take effect immediately.                                                                                                                                                             |
| Keepalive endpoint      | world  | `/api/status` | Path or same-origin absolute URL the ping hits. Cross-origin absolute URLs are silently rejected and fall back to the default. Endpoint must return a 2xx for an authenticated session.                                        |
| Re-authentication URL   | world  | *(empty)*     | URL the dialog opens. Empty falls back to `/outpost.goauthentik.io/start?rd=<current-url>` (right default for an Authentik embedded outpost on the same hostname). Only `http(s)://` absolute URLs and relative URLs (root-relative `/foo`, `./foo`, `../foo`) are accepted; anything else (e.g. `javascript:`, `data:`) falls back to the default. |
| First probe delay (ms)  | client | `5000`        | Delay after `ready` before the first probe runs.                                                                                                                                                                               |
| Show recovery toast     | client | `true`        | Info toast when a previously-expired session is restored.                                                                                                                                                                      |
| Probe on media errors   | client | `true`        | Probe immediately when an `<audio>`/`<video>`/`<img>` fails to load.                                                                                                                                                            |

## Verify it's working

1. Open the browser devtools console (`F12`). On world load you should see
   one log line per tab:

   ```text
   [foundryvtt-auth-keepalive] ready, starting keepalive for <user-name>
   ```

2. The module exposes a small debug API on the global scope. From the
   console:

   ```js
   // Force an immediate probe — useful right after a config change.
   globalThis['foundryvtt-auth-keepalive'].tick();

   // Inspect current state (interval id, expired flag, in-flight promise).
   globalThis['foundryvtt-auth-keepalive'].state;

   // Stop and restart the timer (e.g. after editing the interval setting).
   globalThis['foundryvtt-auth-keepalive'].restart();
   ```

3. To rehearse the failure flow without waiting for a real expiry, point the
   *Keepalive endpoint* setting at a path you know returns a non-2xx (e.g.
   `/api/does-not-exist`) and run `tick()`. The dialog and toast should
   appear within one tick. Restore the setting and run `tick()` again to
   confirm recovery.

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
