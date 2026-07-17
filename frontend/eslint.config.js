import js from '@eslint/js'
import globals from 'globals'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig, globalIgnores } from 'eslint/config'

const testGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  test: 'readonly',
  vi: 'readonly',
}

export default defineConfig([
  globalIgnores([
    'coverage',
    'dist',
    'node_modules',
  ]),

  /*
   * JavaScript configuration files:
   * eslint.config.js, vite.config.js, and similar files.
   */
  {
    files: ['**/*.{js,mjs,cjs}'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    rules: {
      ...js.configs.recommended.rules,
    },
  },

  /*
   * Base TypeScript configuration.
   */
  {
    files: ['**/*.{ts,tsx}'],

    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 'latest',
      sourceType: 'module',

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },

      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    plugins: {
      '@typescript-eslint': typescriptEslint,
      sonarjs,
    },

    rules: {
      ...js.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,
      ...sonarjs.configs.recommended.rules,

      /*
       * TypeScript handles these more accurately than ESLint.
       */
      'no-undef': 'off',
      'no-unused-vars': 'off',

      '@typescript-eslint/no-explicit-any': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      /*
       * SonarJS code-quality limits.
       */
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-identical-expressions': 'warn',
      'sonarjs/no-nested-conditional': 'warn',
    },
  },

  /*
   * React, TSX, Hooks, accessibility, and Vite Fast Refresh.
   */
  {
    files: ['**/*.{ts,tsx}'],

    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },

    settings: {
      react: {
        version: 'detect',
      },
    },

    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      /*
       * React 17+ and the modern JSX transform do not require
       * importing React into every TSX file.
       */
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',

      /*
       * TypeScript interfaces/types replace runtime PropTypes.
       */
      'react/prop-types': 'off',

      /*
       * Keep accessibility findings visible without blocking builds.
       */
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/aria-role': 'warn',
    },
  },

  /*
   * Vitest test globals.
   */
  {
    files: [
      'tests/**/*.{ts,tsx}',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
    ],

    languageOptions: {
      globals: testGlobals,
    },
  },
])