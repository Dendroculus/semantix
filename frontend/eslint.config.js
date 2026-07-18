import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import globals from 'globals';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import sonarjs from 'eslint-plugin-sonarjs';
import { defineConfig, globalIgnores } from 'eslint/config';

const configDirectory = dirname(fileURLToPath(import.meta.url));

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
};

export default defineConfig([
  globalIgnores([
    '.vite-cache',
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
   *
   * projectService enables rules that require TypeScript type information.
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

        projectService: true,
        tsconfigRootDir: configDirectory,
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
       * Prevent imports that climb through two or more parent folders.
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./\\.\\./',
              message:
                'Use the @/ alias for imports that traverse two or more parent directories.',
            },
          ],
        },
      ],

      /*
       * TypeScript handles these more accurately than base ESLint.
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
       * Detect redundant union members.
       *
       * Example:
       *   type Action = 'clear' | string;
       *
       * "clear" is redundant because string already includes it.
       */
      '@typescript-eslint/no-redundant-type-constituents': 'warn',

      /*
       * SonarJS code-quality limits.
       */
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-identical-expressions': 'warn',
      'sonarjs/no-nested-conditional': 'warn',

      /*
       * GitRoll/Sonar-compatible TypeScript findings.
       */
      'sonarjs/prefer-read-only-props': 'warn',
      'sonarjs/no-selector-parameter': 'warn',
      'sonarjs/prefer-regexp-exec': 'warn',

      /*
       * GitRoll marks this one as High severity.
       */
      'sonarjs/void-use': 'error',
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
       * TypeScript interfaces and types replace runtime PropTypes.
       */
      'react/prop-types': 'off',

      /*
       * Initial data-loading effects may call asynchronous request
       * functions whose state updates happen after awaiting a response.
       */
      'react-hooks/set-state-in-effect': 'off',

      /*
       * GitRoll: ambiguous spacing between JSX elements and text.
       */
      'react/jsx-child-element-spacing': 'warn',

      /*
       * GitRoll: Context provider values should not be newly constructed
       * during every render.
       *
       * Prefer useMemo/useCallback or a stable value.
       */
      'react/jsx-no-constructed-context-values': 'warn',

      /*
       * GitRoll: destructure useState into a value and setter pair.
       */
      'react/hook-use-state': 'warn',

      /*
       * Prefer native semantic elements over recreating them with ARIA.
       *
       * Examples:
       *   role="button"      -> <button>
       *   role="status"      -> <output>
       *   role="img"         -> <img>
       *   role="progressbar" -> <progress>
       */
      'jsx-a11y/prefer-tag-over-role': 'warn',

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
]);