import typescriptParser from '@typescript-eslint/parser';
import eslintPluginAstro from 'eslint-plugin-astro';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/'] },

  // TypeScript recommended rules for .ts/.tsx
  ...tseslint.configs.recommended.map(conf => ({
    files: ['**/*.{ts,tsx}'],
    ...conf,
  })),

  // Parser + reglas custom para TypeScript
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Astro: flat configs recomendados + accesibilidad
  ...eslintPluginAstro.configs['flat/recommended'],
  ...eslintPluginAstro.configs['flat/jsx-a11y-recommended'],

  // Allow triple-slash references in .d.ts (Astro standard)
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },

  // Prettier — reporta diferencias de formato como errores de ESLint
  {
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },

  // Imports: orden + detectar imports sin uso
  {
    plugins: {
      'unused-imports': unusedImports,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
    },
  },

  // Evita error en virtual files <script> dentro de .astro
  // prettier-plugin-astro ya formatea el .astro completo
  {
    files: ['**/*.astro/*', '*.astro/*'],
    rules: { 'prettier/prettier': 'off' },
  },
];
