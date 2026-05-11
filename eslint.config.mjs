import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// Native Flat-Config-Exports von eslint-config-next 16.
// Beide liefern Array<FlatConfig>, also direkt ausspread'en.
export default [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'data/**',
      'public/**',
      '**/*.config.js',
      '**/*.config.mjs',
    ],
  },
  {
    rules: {
      // Argumente, die per Konvention mit '_' beginnen, sind absichtlich
      // ungenutzt (Signaturen von Framework-Hooks, Mock-Implementationen).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
