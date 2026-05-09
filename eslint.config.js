import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['build/**', 'dist/**', 'node_modules/**', '**/*.js', '**/*.mjs'],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
            '@typescript-eslint/consistent-type-imports': ['warn', {
                prefer: 'type-imports',
                fixStyle: 'separate-type-imports',
            }],
            'no-debugger': 'error',
            'no-unreachable': 'error',
            'no-constant-condition': 'error',
            'no-constant-binary-expression': 'error',
            'no-duplicate-case': 'error',
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-fallthrough': 'error',
            'no-useless-assignment': 'error',
            'no-useless-escape': 'error',
            'no-self-assign': 'error',
            'prefer-const': 'warn',
            'no-var': 'error',
            'eqeqeq': ['warn', 'smart'],
        },
    },
    {
        files: ['src/**/*.test.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
);
