import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: [
          './services/browser-orchestrator/src/tsconfig.json',
          './services/browser-orchestrator/scripts/tsconfig.json',
          './services/browser-orchestrator/tests/tsconfig.json',
          './packages/shared-types/tsconfig.json',
          './packages/azure-adapters/tsconfig.json'
        ],
        extraFileExtensions: ['.test.ts'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1 }],
      'no-trailing-spaces': 'error',
      'lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/scripts/**/*.ts', '**/scripts/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/dist-*/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      'eslint.config.js',
      'packages/azure-adapters/src/**/*.js',
      'packages/azure-adapters/src/**/*.d.ts'
    ],
  }
);
