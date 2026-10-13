import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vitest.config.{js,ts,mjs,mts}',
          ],
          // Test tooling is a workspace-root devDependency and must never
          // appear in a package's runtime dependencies.
          // rxjs is a required peer of @nestjs/common: imported by Nest, not by
          // us, and this app is what has to provide it.
          ignoredDependencies: ['vitest', '@nestjs/testing', 'rxjs'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    // The renderer produces pixels from garment colours that are data (a
    // variant's colour_hex), not UI styling — the raw-colour rule is for apps.
    files: ['src/render/**'],
    rules: { 'nowcore/no-raw-design-values': 'off' },
  },
  {
    ignores: ['**/out-tsc', '**/test-output'],
  },
];
