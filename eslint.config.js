import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'services/browser-orchestrator/scripts/*.ts',
            'services/browser-orchestrator/tests/*.test.ts',
            'services/ingress-api/tests/*.test.ts',
            'packages/azure-adapters/tests/*.test.ts'
          ],
        },
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
