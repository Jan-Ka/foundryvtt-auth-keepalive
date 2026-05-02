import { describe, expect, it } from 'vitest';

import {
    buildReauthUrl,
    classifyResponse,
    isMediaErrorTarget,
    isSafeNavigationUrl,
    parseNumberSetting,
    resolvePingPath,
} from './internal.js';

describe('classifyResponse', () => {
    it('treats a 200 with type "basic" as ok', () => {
        expect(classifyResponse({ ok: true, type: 'basic' })).toBe('ok');
    });

    it('treats a 200 with type "cors" as ok', () => {
        expect(classifyResponse({ ok: true, type: 'cors' })).toBe('ok');
    });

    it('treats opaqueredirect as expired even when ok would be true', () => {
        // `redirect: 'manual'` synthesises a Response with status 0 / ok=false
        // *and* type 'opaqueredirect'. Either signal alone implies expiry —
        // but the type check must win regardless of how the runtime fills it.
        expect(classifyResponse({ ok: true, type: 'opaqueredirect' })).toBe('expired');
        expect(classifyResponse({ ok: false, type: 'opaqueredirect' })).toBe('expired');
    });

    it('treats non-2xx responses as expired', () => {
        expect(classifyResponse({ ok: false, type: 'basic' })).toBe('expired');
    });
});

describe('parseNumberSetting', () => {
    it('returns the value when finite and >= min', () => {
        expect(parseNumberSetting(60_000, 240_000, 30_000)).toBe(60_000);
        expect(parseNumberSetting(30_000, 240_000, 30_000)).toBe(30_000);
    });

    it('coerces numeric strings', () => {
        expect(parseNumberSetting('60000', 240_000, 30_000)).toBe(60_000);
    });

    it('falls back when below the minimum', () => {
        expect(parseNumberSetting(1_000, 240_000, 30_000)).toBe(240_000);
    });

    it('falls back on NaN, undefined, null, junk strings', () => {
        expect(parseNumberSetting(NaN, 240_000, 30_000)).toBe(240_000);
        expect(parseNumberSetting(undefined, 240_000, 30_000)).toBe(240_000);
        expect(parseNumberSetting(null, 240_000, 30_000)).toBe(240_000);
        expect(parseNumberSetting('not a number', 240_000, 30_000)).toBe(240_000);
        expect(parseNumberSetting({}, 240_000, 30_000)).toBe(240_000);
    });

    it('falls back on Infinity', () => {
        expect(parseNumberSetting(Infinity, 240_000, 30_000)).toBe(240_000);
    });

    it('allows zero when min is zero', () => {
        expect(parseNumberSetting(0, 5_000, 0)).toBe(0);
    });
});

describe('buildReauthUrl', () => {
    const href = 'https://foundry.example.com/game';
    const fallback = `/outpost.goauthentik.io/start?rd=${encodeURIComponent(href)}`;

    it('uses the configured URL verbatim when set', () => {
        expect(buildReauthUrl('https://auth.example.com/login', href)).toBe(
            'https://auth.example.com/login',
        );
    });

    it('trims whitespace from the configured URL', () => {
        expect(buildReauthUrl('  https://auth.example.com/login  ', href)).toBe(
            'https://auth.example.com/login',
        );
    });

    it('defaults to the Authentik outpost start endpoint with current href as rd', () => {
        expect(buildReauthUrl('', href)).toBe(fallback);
    });

    it('treats whitespace-only / null / undefined as unset', () => {
        expect(buildReauthUrl('   ', href)).toBe(fallback);
        expect(buildReauthUrl(null, href)).toBe(fallback);
        expect(buildReauthUrl(undefined, href)).toBe(fallback);
    });

    it('falls back when the configured URL has an unsafe scheme', () => {
        // window.open('javascript:...') would execute in the new window's
        // context. Reject it and use the safe default instead.
        expect(buildReauthUrl('javascript:alert(1)', href)).toBe(fallback);
        expect(buildReauthUrl('JavaScript:alert(1)', href)).toBe(fallback);
        expect(buildReauthUrl('data:text/html,<script>alert(1)</script>', href)).toBe(fallback);
        expect(buildReauthUrl('vbscript:msgbox', href)).toBe(fallback);
        expect(buildReauthUrl('file:///etc/passwd', href)).toBe(fallback);
    });

    it('encodes hrefs with query strings and fragments safely', () => {
        const dirty = 'https://foundry.example.com/game?foo=bar&baz=1#scene';
        const url = buildReauthUrl('', dirty);
        expect(url).toContain('rd=');
        const rd = new URL(url, 'https://foundry.example.com').searchParams.get('rd');
        expect(rd).toBe(dirty);
    });
});

describe('isSafeNavigationUrl', () => {
    it('accepts http(s) absolute URLs', () => {
        expect(isSafeNavigationUrl('https://auth.example.com/login')).toBe(true);
        expect(isSafeNavigationUrl('http://localhost:8080/x')).toBe(true);
    });

    it('accepts root-relative and path-relative URLs', () => {
        expect(isSafeNavigationUrl('/outpost.goauthentik.io/start')).toBe(true);
        expect(isSafeNavigationUrl('./relative')).toBe(true);
        expect(isSafeNavigationUrl('../up')).toBe(true);
    });

    it('rejects script-bearing schemes', () => {
        expect(isSafeNavigationUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeNavigationUrl('JAVASCRIPT:alert(1)')).toBe(false);
        expect(isSafeNavigationUrl('data:text/html,x')).toBe(false);
        expect(isSafeNavigationUrl('vbscript:x')).toBe(false);
        expect(isSafeNavigationUrl('file:///etc/passwd')).toBe(false);
    });

    it('rejects empty / unparseable values', () => {
        expect(isSafeNavigationUrl('')).toBe(false);
        expect(isSafeNavigationUrl('not a url')).toBe(false);
    });
});

describe('resolvePingPath', () => {
    const origin = 'https://foundry.example.com';

    it('returns the configured value when set', () => {
        expect(resolvePingPath('/api/health', '/api/status')).toBe('/api/health');
    });

    it('trims and falls back on empty / whitespace / null / undefined', () => {
        expect(resolvePingPath('', '/api/status')).toBe('/api/status');
        expect(resolvePingPath('   ', '/api/status')).toBe('/api/status');
        expect(resolvePingPath(null, '/api/status')).toBe('/api/status');
        expect(resolvePingPath(undefined, '/api/status')).toBe('/api/status');
    });

    it('accepts same-origin absolute URLs when an origin is provided', () => {
        expect(resolvePingPath(`${origin}/api/health`, '/api/status', origin)).toBe(
            `${origin}/api/health`,
        );
    });

    it('falls back when the configured URL is cross-origin', () => {
        // Sending credentials cross-site would leak the cookie we're trying
        // to refresh. resolvePingPath() must reject it and use the default.
        expect(resolvePingPath('https://evil.example.com/exfil', '/api/status', origin)).toBe(
            '/api/status',
        );
    });

    it('falls back on unparseable absolute values when an origin is provided', () => {
        expect(resolvePingPath('http://[bad', '/api/status', origin)).toBe('/api/status');
    });

    it('keeps relative paths regardless of origin', () => {
        expect(resolvePingPath('/api/custom', '/api/status', origin)).toBe('/api/custom');
    });
});

describe('isMediaErrorTarget', () => {
    function el(tagName: string): EventTarget {
        return { tagName } as unknown as EventTarget;
    }

    it('matches audio/video/img regardless of case', () => {
        expect(isMediaErrorTarget(el('AUDIO'))).toBe(true);
        expect(isMediaErrorTarget(el('audio'))).toBe(true);
        expect(isMediaErrorTarget(el('VIDEO'))).toBe(true);
        expect(isMediaErrorTarget(el('IMG'))).toBe(true);
    });

    it('rejects other elements', () => {
        expect(isMediaErrorTarget(el('SCRIPT'))).toBe(false);
        expect(isMediaErrorTarget(el('LINK'))).toBe(false);
        expect(isMediaErrorTarget(el('DIV'))).toBe(false);
    });

    it('rejects null/undefined and targets without tagName (e.g. window)', () => {
        expect(isMediaErrorTarget(null)).toBe(false);
        expect(isMediaErrorTarget({} as EventTarget)).toBe(false);
    });
});
