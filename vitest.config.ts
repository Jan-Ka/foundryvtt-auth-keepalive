import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
    },
    resolve: {
        alias: {
            // The build emits src/module/auth-keepalive.js next to its
            // .ts source. Without this alias, an import of
            // `./auth-keepalive.js` from a test would load the stale
            // bundle instead of the source. Force .js → .ts for this
            // single module.
            './auth-keepalive.js': fileURLToPath(
                new URL('./src/module/auth-keepalive.ts', import.meta.url),
            ),
        },
    },
});
