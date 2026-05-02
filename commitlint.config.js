/**
 * Conventional Commits enforcement.
 *
 * Run manually:  pnpm exec commitlint --edit "$1"
 * Wired up via:  .husky/commit-msg
 */
export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'header-max-length': [2, 'always', 100],
        'body-max-line-length': [1, 'always', 100],
        'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    },
};
