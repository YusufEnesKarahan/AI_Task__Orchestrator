import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const commonGlobals = {
    AbortController: 'readonly',
    Buffer: 'readonly',
    __filename: 'readonly',
    console: 'readonly',
    clearInterval: 'readonly',
    clearTimeout: 'readonly',
    fetch: 'readonly',
    HeadersInit: 'readonly',
    NodeModule: 'readonly',
    process: 'readonly',
    RequestInit: 'readonly',
    Response: 'readonly',
    setInterval: 'readonly',
    setTimeout: 'readonly'
};

export default [
    {
        ignores: ['node_modules/**', 'out/**', 'out-test/**', '*.vsix']
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts', 'test/**/*.ts'],
        languageOptions: {
            globals: commonGlobals
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_'
                }
            ],
            'no-empty': 'off',
            'no-undef': 'off'
        }
    },
    {
        files: ['webview-ui/**/*.js'],
        languageOptions: {
            globals: {
                acquireVsCodeApi: 'readonly',
                console: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                window: 'readonly'
            }
        }
    },
    {
        files: ['eslint.config.mjs'],
        languageOptions: {
            globals: commonGlobals
        }
    }
];
