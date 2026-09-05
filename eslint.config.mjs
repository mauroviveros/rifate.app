import typescriptParser from '@typescript-eslint/parser';
import eslintPluginAstro from 'eslint-plugin-astro';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'src/components/starwind/',
      'src/components/starwind-primitives/',
    ],
  },

  // TypeScript recommended rules for .ts/.tsx
  ...tseslint.configs.recommended.map((conf) => ({
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
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

  // Defensa nº3 de docs/04: el binding crudo no se usa fuera de src/lib/db/.
  // Las páginas y actions no ven env.DB nunca — pasan por un repositorio,
  // cuya firma exige un `actor` y por lo tanto no deja olvidarse de filtrar.
  {
    files: ['src/pages/**', 'src/actions/**', 'src/components/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='DB']",
          message:
            'No accedas a env.DB directamente. Usá un repositorio de src/lib/db/.',
        },
        {
          selector: "MemberExpression[property.name='RAFFLE']",
          message:
            'No accedas a env.RAFFLE directamente. Usá un flujo de src/lib/raffles/.',
        },
      ],
    },
  },
];
