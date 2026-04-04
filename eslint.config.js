import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: [
          './services/capture-worker/src/tsconfig.json',
          './services/capture-worker/local/tsconfig.json',
          './services/capture-worker/dev/tsconfig.json',
          './services/capture-worker/tests/tsconfig.json',
          './services/capture-worker/scripts/tsconfig.json',
          './packages/shared-types/tsconfig.json'
        ],
        extraFileExtensions: ['.test.ts'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
      'no-trailing-spaces': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/dist-local/**',
      '**/dist-dev/**',
      '**/dist-scripts/**',
      '**/node_modules/**',
      '**/local-queue.json',
      '**/output/**',
      '**/*.tsbuildinfo'
    ],
  }
);
