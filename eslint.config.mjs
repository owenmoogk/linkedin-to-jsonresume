/* eslint-disable import/no-unresolved */
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import typescriptEslint from 'typescript-eslint';
import prettierPluginRecommended from 'eslint-plugin-prettier/recommended';
import typescriptParser from '@typescript-eslint/parser';
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default [
  js.configs.recommended,
  importPlugin.flatConfigs.recommended,
  typescriptEslint.configs.eslintRecommended,
  prettierPluginRecommended,

  // https://stackoverflow.com/questions/58510287/parseroptions-project-has-been-set-for-typescript-eslint-parser
  ...typescriptEslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),

  {
    ignores: [
      '**/node_modules/',
      '**/build/',
      '**/dist/',
      '**/web-ext-artifacts/',
      '**/*d.ts',
    ],
  },

  // Node scripts (CI helpers)
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: ['**/*.ts'],

    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
    },

    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },

    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },

    rules: {
      // typescript eslint
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/member-ordering': 'error',
      '@typescript-eslint/promise-function-async': 'error',

      'import/no-named-as-default': 'error',

      // javascript
      'no-useless-return': 'error',
      eqeqeq: 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-promise-reject-errors': 'error',
      'prefer-regex-literals': 'error',
      radix: 'error',
    },
  },
];
