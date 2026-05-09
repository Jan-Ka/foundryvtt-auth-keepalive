// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks for Foundry runtime globals. Set these on globalThis BEFORE
// importing the module — its top-level Hooks.once registrations run
// at import time and would crash without them.

interface MockNotification {
    id: number;
}

interface MockDialog {
    rendered: boolean;
    closed: boolean;
    config: unknown;
}

const mockUi = {
    notifications: {
        error: vi.fn((_msg: string, _opts?: unknown): MockNotification => ({ id: 1 })),
        info: vi.fn((_msg: string) => undefined),
        remove: vi.fn((_n: MockNotification | number) => undefined),
    },
};

const mockGame: {
    user: { name: string };
    userId: string;
    i18n: { localize: (key: string) => string };
    settings: { register: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
    settingsStore: Map<string, unknown>;
} = {
    user: { name: 'tester' },
    userId: 'tester',
    i18n: { localize: (key: string) => key },
    settings: {
        register: vi.fn(),
        get: vi.fn((_id: string, key: string): unknown => mockGame.settingsStore.get(key)),
    },
    settingsStore: new Map<string, unknown>(),
};

const mockHooks = { once: vi.fn() };

class MockDialogV2 implements MockDialog {
    rendered = false;
    closed = false;
    config: unknown;
    constructor(config: unknown) { this.config = config; }
    async render(_opts?: unknown): Promise<this> { this.rendered = true; return this; }
    async close(_opts?: unknown): Promise<this> { this.closed = true; return this; }
}

const dialogConstructorSpy = vi.fn();
class TrackingDialogV2 extends MockDialogV2 {
    constructor(config: unknown) {
        super(config);
        dialogConstructorSpy(config);
    }
}

const mockFoundry = { applications: { api: { DialogV2: TrackingDialogV2 } } };

(globalThis as Record<string, unknown>).Hooks = mockHooks;
(globalThis as Record<string, unknown>).game = mockGame;
(globalThis as Record<string, unknown>).ui = mockUi;
(globalThis as Record<string, unknown>).foundry = mockFoundry;

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

// Dynamic import — must happen AFTER globals are wired up. Top-level
// `await import(...)` would also work but pulling it inside beforeAll
// keeps the dependency on globals explicit.
import type * as AuthKeepalive from './auth-keepalive.js';

let mod: typeof AuthKeepalive;

beforeEach(async () => {
    if (!mod) mod = await import('./auth-keepalive.js');
    mod.__resetStateForTests();
    mockUi.notifications.error.mockClear();
    mockUi.notifications.info.mockClear();
    mockUi.notifications.remove.mockClear();
    mockGame.settingsStore.clear();
    fetchMock.mockReset();
    dialogConstructorSpy.mockClear();
    mockHooks.once.mockClear();
});

afterEach(() => {
    mod.stop();
    mod.detachMediaErrorListener();
});

function okResponse(): Response {
    return { ok: true, type: 'basic' } as unknown as Response;
}

function expiredResponse(): Response {
    return { ok: false, type: 'opaqueredirect' } as unknown as Response;
}

describe('tick', () => {
    it('coalesces concurrent ticks into a single fetch', async () => {
        fetchMock.mockResolvedValue(okResponse());
        await Promise.all([mod.tick(), mod.tick(), mod.tick()]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('shows expiry UI on a failed ping', async () => {
        fetchMock.mockResolvedValue(expiredResponse());
        await mod.tick();
        expect(mod.state.expired).toBe(true);
        expect(mockUi.notifications.error).toHaveBeenCalledTimes(1);
        expect(dialogConstructorSpy).toHaveBeenCalledTimes(1);
    });

    it('treats a thrown fetch as an expired session', async () => {
        fetchMock.mockRejectedValue(new TypeError('network'));
        await mod.tick();
        expect(mod.state.expired).toBe(true);
    });

    it('clears UI and shows recovery toast on fail→ok transition', async () => {
        mockGame.settingsStore.set('showRecoveryToast', true);
        fetchMock.mockResolvedValueOnce(expiredResponse());
        await mod.tick();
        expect(mod.state.expired).toBe(true);

        fetchMock.mockResolvedValueOnce(okResponse());
        await mod.tick();
        expect(mod.state.expired).toBe(false);
        expect(mockUi.notifications.remove).toHaveBeenCalledTimes(1);
        expect(mockUi.notifications.info).toHaveBeenCalledTimes(1);
    });

    it('suppresses recovery toast when the setting is disabled', async () => {
        mockGame.settingsStore.set('showRecoveryToast', false);
        fetchMock.mockResolvedValueOnce(expiredResponse());
        await mod.tick();
        fetchMock.mockResolvedValueOnce(okResponse());
        await mod.tick();
        expect(mockUi.notifications.info).not.toHaveBeenCalled();
    });

    it('does not re-show the dialog while already expired', async () => {
        fetchMock.mockResolvedValue(expiredResponse());
        await mod.tick();
        await mod.tick();
        expect(dialogConstructorSpy).toHaveBeenCalledTimes(1);
    });

    it('clears state.dialog when the closeDialogV2 hook fires for our instance', async () => {
        fetchMock.mockResolvedValue(expiredResponse());
        await mod.tick();
        const dialog = mod.state.dialog;
        expect(dialog).not.toBeNull();

        const closeHookCall = mockHooks.once.mock.calls.find(
            (call: unknown[]) => call[0] === 'closeDialogV2',
        );
        expect(closeHookCall).toBeDefined();
        const callback = closeHookCall![1] as (app: unknown) => void;
        callback(dialog);
        expect(mod.state.dialog).toBeNull();
    });

    it('does not clear state.dialog for an unrelated DialogV2 close', async () => {
        fetchMock.mockResolvedValue(expiredResponse());
        await mod.tick();
        const dialog = mod.state.dialog;

        const closeHookCall = mockHooks.once.mock.calls.find(
            (call: unknown[]) => call[0] === 'closeDialogV2',
        );
        const callback = closeHookCall![1] as (app: unknown) => void;
        callback({ unrelated: true });
        expect(mod.state.dialog).toBe(dialog);
    });
});

describe('start / stop / restart', () => {
    it('start sets an interval and a first-probe timeout', () => {
        mod.start();
        expect(mod.state.intervalId).not.toBeNull();
        expect(mod.state.firstProbeTimeoutId).not.toBeNull();
    });

    it('start is idempotent', () => {
        mod.start();
        const id = mod.state.intervalId;
        mod.start();
        expect(mod.state.intervalId).toBe(id);
    });

    it('stop clears both timers', () => {
        mod.start();
        mod.stop();
        expect(mod.state.intervalId).toBeNull();
        expect(mod.state.firstProbeTimeoutId).toBeNull();
    });

    it('restart re-arms the interval', () => {
        mod.start();
        const before = mod.state.intervalId;
        mod.restart();
        expect(mod.state.intervalId).not.toBeNull();
        expect(mod.state.intervalId).not.toBe(before);
    });
});

describe('media error listener', () => {
    it('attaches when detectMediaErrors is enabled', () => {
        mockGame.settingsStore.set('detectMediaErrors', true);
        mod.attachMediaErrorListener();
        expect(mod.state.mediaListener).not.toBeNull();
    });

    it('skips when detectMediaErrors is disabled', () => {
        mockGame.settingsStore.set('detectMediaErrors', false);
        mod.attachMediaErrorListener();
        expect(mod.state.mediaListener).toBeNull();
    });

    it('triggers a tick on an <img> error', async () => {
        mockGame.settingsStore.set('detectMediaErrors', true);
        fetchMock.mockResolvedValue(okResponse());
        mod.attachMediaErrorListener();

        const img = document.createElement('img');
        document.body.appendChild(img);
        const event = new Event('error');
        Object.defineProperty(event, 'target', { value: img });
        window.dispatchEvent(event);

        // Allow the queued microtask in tick() to settle.
        await Promise.resolve();
        await Promise.resolve();
        expect(fetchMock).toHaveBeenCalled();
    });

    it('ignores non-media error targets', async () => {
        mockGame.settingsStore.set('detectMediaErrors', true);
        mod.attachMediaErrorListener();

        const div = document.createElement('div');
        const event = new Event('error');
        Object.defineProperty(event, 'target', { value: div });
        window.dispatchEvent(event);

        await Promise.resolve();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('detach removes the listener', () => {
        mockGame.settingsStore.set('detectMediaErrors', true);
        mod.attachMediaErrorListener();
        mod.detachMediaErrorListener();
        expect(mod.state.mediaListener).toBeNull();
    });
});
