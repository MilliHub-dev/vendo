import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'docs/openapi.json'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.js'], languageOptions: { globals: { console: 'readonly', process: 'readonly' } } },
  { files: ['**/*.ts'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
