/**
 * Pure helpers — no Foundry globals, no DOM side effects.
 *
 * Split out so they can be unit-tested under Node. Anything that touches
 * `game`, `ui`, `Hooks`, `Dialog`, or installs listeners stays in
 * auth-keepalive.ts.
 */

export type ExpiryClassification = 'ok' | 'expired';

/**
 * Decide whether a keepalive response indicates a live session or an
 * expired one. With `redirect: 'manual'`, a cross-origin 302 to the IdP
 * surfaces as `type === 'opaqueredirect'`; treat that — and any non-2xx —
 * as expired.
 */
export function classifyResponse(res: Pick<Response, 'ok' | 'type'>): ExpiryClassification {
    if (res.type === 'opaqueredirect') return 'expired';
    return res.ok ? 'ok' : 'expired';
}

/**
 * Coerce + validate a numeric setting. Returns `fallback` for non-finite
 * values or anything below `min`.
 */
export function parseNumberSetting(raw: unknown, fallback: number, min: number): number {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n < min) return fallback;
    return n;
}

/**
 * True when `value` is safe to pass to `window.open()` — allow only
 * absolute http(s) URLs or path-relative URLs. Rejects javascript:, data:,
 * vbscript:, and other script-bearing schemes that would execute in the
 * new window's context.
 */
export function isSafeNavigationUrl(value: string): boolean {
    if (value.length === 0) return false;
    // Path-relative or root-relative URLs are always safe; they resolve
    // against the current origin and cannot carry a scheme.
    if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) return true;
    // Anything else must be a parseable absolute URL with an http(s) scheme.
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Build the URL to send the user to for re-authentication. If the operator
 * configured one explicitly *and* it passes the safety check, use it.
 * Otherwise default to the Authentik forward-auth outpost start endpoint
 * with the current page as the return URL — right default for an embedded
 * outpost on the same host.
 */
export function buildReauthUrl(configured: string | undefined | null, currentHref: string): string {
    const trimmed = (configured ?? '').trim();
    if (trimmed.length > 0 && isSafeNavigationUrl(trimmed)) return trimmed;
    return `/outpost.goauthentik.io/start?rd=${encodeURIComponent(currentHref)}`;
}

/**
 * Resolve the keepalive endpoint. Falls back to `fallback` when the
 * configured value is empty/whitespace, or when it resolves to a
 * different origin than `currentOrigin` — keeping the session cookie
 * we're trying to refresh from leaking cross-site.
 */
export function resolvePingPath(
    configured: string | undefined | null,
    fallback: string,
    currentOrigin?: string,
): string {
    const trimmed = (configured ?? '').trim();
    if (trimmed.length === 0) return fallback;
    if (currentOrigin) {
        try {
            const resolved = new URL(trimmed, currentOrigin);
            if (resolved.origin !== currentOrigin) return fallback;
        } catch {
            return fallback;
        }
    }
    return trimmed;
}

/**
 * Whether a media element should trigger an opportunistic session probe
 * when its load fails. Audio/video/img are the elements Foundry uses for
 * playlist tracks, scene backgrounds, and tokens — the loud symptoms of
 * an expired cookie.
 */
export function isMediaErrorTarget(target: EventTarget | null): boolean {
    if (!target) return false;
    const tag = (target as { tagName?: string }).tagName;
    if (!tag) return false;
    const upper = tag.toUpperCase();
    return upper === 'AUDIO' || upper === 'VIDEO' || upper === 'IMG';
}
