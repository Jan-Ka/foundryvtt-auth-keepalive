/**
 * foundryvtt-auth-keepalive
 *
 * Pings a Foundry endpoint on an interval so the upstream Authentik
 * forward-auth proxy keeps the session cookie warm. If the cookie ever
 * expires (the proxy answers with a cross-origin redirect to the IdP, or
 * the network call fails), surfaces a persistent notification + dialog
 * pointing the user at a re-auth URL. Recovers automatically once the
 * next ping succeeds.
 */

import {
    buildReauthUrl,
    classifyResponse,
    isMediaErrorTarget,
    parseNumberSetting,
    resolvePingPath,
} from './internal.js';

const MODULE_ID = 'foundryvtt-auth-keepalive';

const DEFAULTS = {
    pingPath: '/api/status',
    intervalMs: 240_000,
    minIntervalMs: 30_000,
    firstProbeDelayMs: 5_000,
    dialogWidth: 480,
    showRecoveryToast: true,
    detectMediaErrors: true,
} as const;

// Foundry v14 runtime globals. No first-party types ship with Foundry,
// and the community @league-of-foundry-developers types would be a heavy
// dependency for a tiny module — keep these as `any` and live with it.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const Hooks: any;
declare const game: any;
declare const ui: any;
declare const foundry: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface KeepaliveState {
    intervalId: number | null;
    firstProbeTimeoutId: number | null;
    expired: boolean;
    notification: unknown;
    // Foundry Dialog instance — see note on the global declarations above.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dialog: any;
    mediaListener: ((event: Event) => void) | null;
    inflight: Promise<void> | null;
}

const state: KeepaliveState = {
    intervalId: null,
    firstProbeTimeoutId: null,
    expired: false,
    notification: null,
    dialog: null,
    mediaListener: null,
    inflight: null,
};

let warnedSettingsRead = false;

function log(...args: unknown[]): void {
    console.log(`[${MODULE_ID}]`, ...args);
}

function userTag(): string {
    return game?.user?.name ?? game?.userId ?? 'unknown';
}

function getSetting<T>(key: string, fallback: T): T {
    try {
        const value = game?.settings?.get?.(MODULE_ID, key);
        return (value === undefined || value === null) ? fallback : (value as T);
    } catch (err) {
        // Reads can throw before `init` finishes registering settings.
        // That's expected during early bootstrap, but a persistent
        // failure points at a misconfigured Foundry — log once so it
        // shows up in support reports without spamming the console.
        if (!warnedSettingsRead) {
            warnedSettingsRead = true;
            log('settings read failed, falling back to defaults', err);
        }
        return fallback;
    }
}

function getNumberSetting(key: string, fallback: number, min: number): number {
    return parseNumberSetting(getSetting<unknown>(key, fallback), fallback, min);
}

function getPingPath(): string {
    return resolvePingPath(
        getSetting<string>('pingPath', DEFAULTS.pingPath),
        DEFAULTS.pingPath,
        window.location.origin,
    );
}

function getIntervalMs(): number {
    return getNumberSetting('interval', DEFAULTS.intervalMs, DEFAULTS.minIntervalMs);
}

function getFirstProbeDelayMs(): number {
    return getNumberSetting('firstProbeDelay', DEFAULTS.firstProbeDelayMs, 0);
}

function reauthUrl(): string {
    return buildReauthUrl(getSetting<string>('reauthUrl', ''), window.location.href);
}

async function ping(): Promise<boolean> {
    try {
        const res = await fetch(getPingPath(), {
            // The cookie we're refreshing is on the Foundry origin. Same-origin
            // is the safe default; resolvePingPath() already rejects cross-
            // origin endpoints, so this is also the only valid mode.
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'manual',
            headers: { Accept: 'application/json' },
        });
        return classifyResponse(res) === 'ok';
    } catch (err) {
        log('keepalive fetch failed', err);
        return false;
    }
}

function showExpiryUi(): void {
    // If the dialog is still rendered, nothing to do. If it was
    // dismissed manually (X/ESC), fall through and re-render — the
    // user just gets the banner otherwise, which is easy to miss.
    if (state.expired && state.dialog) return;

    if (!state.expired) {
        state.expired = true;
        log('session expired for', userTag());
        const message = game.i18n.localize(`${MODULE_ID}.notification.expired`);
        state.notification = ui.notifications.error(message, { permanent: true });
    }

    const url = reauthUrl();
    const title = game.i18n.localize(`${MODULE_ID}.dialog.title`);
    const body = game.i18n.localize(`${MODULE_ID}.dialog.body`);
    const buttonLabel = game.i18n.localize(`${MODULE_ID}.dialog.button`);

    // DialogV2 renders `content` as HTML. The body string is plain
    // prose (no markup), so build the <p> via the DOM and serialize —
    // outerHTML escapes entities for us. Avoids putting translator
    // strings into a template literal that would interpret tags.
    const bodyEl = document.createElement('p');
    bodyEl.textContent = body;
    const dialog = new foundry.applications.api.DialogV2({
        window: { title },
        position: { width: DEFAULTS.dialogWidth },
        content: bodyEl.outerHTML,
        // DialogV2 closes the dialog after a button activation. The
        // permanent error notification remains as the persistent
        // indicator until clearExpiryUi() removes it on recovery.
        buttons: [
            {
                action: 'reauth',
                label: buttonLabel,
                default: true,
                callback: () => {
                    window.open(url, '_blank', 'noopener,noreferrer');
                },
            },
        ],
        // Don't reject the promise if the user dismisses without clicking.
        rejectClose: false,
    });
    state.dialog = dialog;
    // Clear the reference when the dialog closes by any path — button
    // activation, X dismissal, ESC. Without this, manual dismissal
    // would leave a stale reference until the next recovery.
    Hooks.once('closeDialogV2', (app: unknown) => {
        if (app === dialog) state.dialog = null;
    });
    void dialog.render({ force: true });
}

function clearExpiryUi(): void {
    if (!state.expired) return;
    state.expired = false;
    log('session recovered for', userTag());

    if (state.notification != null) {
        ui.notifications?.remove?.(state.notification);
        state.notification = null;
    }

    // Null state.dialog before closing so the closeDialogV2 hook's
    // `app === dialog` re-assignment is a no-op rather than a redundant
    // write to a field we just cleared.
    const dialog = state.dialog;
    state.dialog = null;
    void dialog?.close?.();

    if (getSetting<boolean>('showRecoveryToast', DEFAULTS.showRecoveryToast)) {
        ui.notifications?.info?.(game.i18n.localize(`${MODULE_ID}.notification.recovered`));
    }
}

async function tick(): Promise<void> {
    // Coalesce overlapping triggers (interval + first-probe timeout +
    // media-error listener can all fire close together). Without this,
    // a slow expired-response could land *after* a faster ok-response
    // and incorrectly re-show the dialog.
    if (state.inflight) return state.inflight;
    const run = (async () => {
        try {
            const ok = await ping();
            if (ok) clearExpiryUi();
            else showExpiryUi();
        } finally {
            state.inflight = null;
        }
    })();
    state.inflight = run;
    return run;
}

function start(): void {
    if (state.intervalId !== null) return;
    state.intervalId = window.setInterval(() => {
        void tick();
    }, getIntervalMs());
    state.firstProbeTimeoutId = window.setTimeout(() => {
        state.firstProbeTimeoutId = null;
        void tick();
    }, getFirstProbeDelayMs());
}

function stop(): void {
    if (state.intervalId !== null) {
        window.clearInterval(state.intervalId);
        state.intervalId = null;
    }
    if (state.firstProbeTimeoutId !== null) {
        window.clearTimeout(state.firstProbeTimeoutId);
        state.firstProbeTimeoutId = null;
    }
}

function restart(): void {
    stop();
    start();
}

/**
 * When an <audio>/<img>/<video> element fails to load, probe the session
 * immediately. Media error events don't bubble, so we use a capture-phase
 * listener on window. If the asset failed because the cookie is gone, the
 * probe surfaces the UI.
 */
function attachMediaErrorListener(): void {
    if (state.mediaListener) return;
    if (!getSetting<boolean>('detectMediaErrors', DEFAULTS.detectMediaErrors)) return;
    const listener = (event: Event): void => {
        if (!isMediaErrorTarget(event.target)) return;
        log('media error detected, probing session', (event.target as HTMLElement).tagName);
        void tick();
    };
    window.addEventListener('error', listener, true);
    state.mediaListener = listener;
}

function detachMediaErrorListener(): void {
    if (!state.mediaListener) return;
    window.removeEventListener('error', state.mediaListener, true);
    state.mediaListener = null;
}

Hooks.once('init', () => {
    // Only `interval` needs an explicit onChange — pingPath, reauthUrl,
    // and firstProbeDelay are read fresh on each tick (or only matter
    // before start), so live edits propagate without a restart.
    const onSettingChange = () => {
        if (state.intervalId !== null) restart();
    };

    game.settings.register(MODULE_ID, 'interval', {
        name: `${MODULE_ID}.settings.interval.name`,
        hint: `${MODULE_ID}.settings.interval.hint`,
        scope: 'client',
        config: true,
        type: Number,
        default: DEFAULTS.intervalMs,
        onChange: onSettingChange,
    });

    game.settings.register(MODULE_ID, 'pingPath', {
        name: `${MODULE_ID}.settings.pingPath.name`,
        hint: `${MODULE_ID}.settings.pingPath.hint`,
        scope: 'world',
        config: true,
        type: String,
        default: DEFAULTS.pingPath,
    });

    game.settings.register(MODULE_ID, 'reauthUrl', {
        name: `${MODULE_ID}.settings.reauthUrl.name`,
        hint: `${MODULE_ID}.settings.reauthUrl.hint`,
        scope: 'world',
        config: true,
        type: String,
        default: '',
    });

    game.settings.register(MODULE_ID, 'firstProbeDelay', {
        name: `${MODULE_ID}.settings.firstProbeDelay.name`,
        hint: `${MODULE_ID}.settings.firstProbeDelay.hint`,
        scope: 'client',
        config: true,
        type: Number,
        default: DEFAULTS.firstProbeDelayMs,
    });

    game.settings.register(MODULE_ID, 'showRecoveryToast', {
        name: `${MODULE_ID}.settings.showRecoveryToast.name`,
        hint: `${MODULE_ID}.settings.showRecoveryToast.hint`,
        scope: 'client',
        config: true,
        type: Boolean,
        default: DEFAULTS.showRecoveryToast,
    });

    game.settings.register(MODULE_ID, 'detectMediaErrors', {
        name: `${MODULE_ID}.settings.detectMediaErrors.name`,
        hint: `${MODULE_ID}.settings.detectMediaErrors.hint`,
        scope: 'client',
        config: true,
        type: Boolean,
        default: DEFAULTS.detectMediaErrors,
        onChange: (enabled: boolean) => {
            if (enabled) attachMediaErrorListener();
            else detachMediaErrorListener();
        },
    });
});

Hooks.once('ready', () => {
    log('ready, starting keepalive for', userTag());
    start();
    attachMediaErrorListener();
    window.addEventListener('beforeunload', stop);
    // Expose for manual debugging from the Foundry console.
    (globalThis as unknown as Record<string, unknown>)[MODULE_ID] = {
        tick,
        start,
        stop,
        restart,
        state,
    };
});

// Test-only surface. Foundry doesn't import this module — it loads the
// bundled .js via module.json — so these named exports have no runtime
// cost in production.
export {
    attachMediaErrorListener,
    clearExpiryUi,
    detachMediaErrorListener,
    restart,
    showExpiryUi,
    start,
    state,
    stop,
    tick,
};

export function __resetStateForTests(): void {
    state.intervalId = null;
    state.firstProbeTimeoutId = null;
    state.expired = false;
    state.notification = null;
    state.dialog = null;
    if (state.mediaListener) {
        window.removeEventListener('error', state.mediaListener, true);
        state.mediaListener = null;
    }
    state.inflight = null;
}
