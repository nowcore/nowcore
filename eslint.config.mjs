import nx from '@nx/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';
import nowcore from './tools/eslint/no-raw-design-values.mjs';

/**
 * Workspace-wide lint rules.
 *
 * The `depConstraints` below are the mechanical enforcement of docs/04-hld.md
 * §4. They are not style preferences. The one that matters most is
 * `scope:web` being unable to reach `scope:pod` or `scope:server`: it makes it
 * structurally impossible for a provider credential or a database client to
 * end up in a browser bundle.
 */
export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],

  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/test-output',
      '**/.next*',
      '**/vitest.config.*.timestamp*',
    ],
  },

  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              // Reachable from everything, so it may depend on nothing with a
              // runtime opinion — or the boundaries below could be walked
              // around one hop at a time.
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
              bannedExternalImports: [
                'react',
                'react-*',
                'next',
                'next/*',
                '@nestjs/*',
                '@prisma/*',
              ],
            },
            {
              sourceTag: 'scope:ui',
              onlyDependOnLibsWithTags: ['scope:ui', 'scope:shared'],
              bannedExternalImports: ['@nestjs/*', '@prisma/*'],
            },
            {
              // Motion knows about scroll and pixels, never about orders,
              // payments or printers (ADR-002).
              sourceTag: 'scope:motion',
              onlyDependOnLibsWithTags: [
                'scope:motion',
                'scope:ui',
                'scope:shared',
              ],
              bannedExternalImports: ['@nestjs/*', '@prisma/*', 'razorpay'],
            },
            {
              // The fulfilment port (ADR-001). Server-side only.
              sourceTag: 'scope:pod',
              onlyDependOnLibsWithTags: ['scope:pod', 'scope:shared'],
              bannedExternalImports: ['react', 'react-*', 'next', 'next/*'],
            },
            {
              // THE CREDENTIAL BOUNDARY. A browser app can never import the
              // database, the printer adapter or the payment SDK.
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: [
                'scope:web',
                'scope:motion',
                'scope:ui',
                'scope:shared',
              ],
              bannedExternalImports: ['@prisma/*', 'razorpay', 'bullmq'],
            },
            {
              sourceTag: 'scope:server',
              onlyDependOnLibsWithTags: [
                'scope:server',
                'scope:pod',
                'scope:shared',
              ],
              bannedExternalImports: ['react', 'react-*', 'next', 'next/*'],
            },
            {
              sourceTag: 'type:lib',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
          ],
        },
      ],
    },
  },

  {
    // The brand is a system (CLAUDE.md, rule 1). libs/ui is where tokens are
    // defined, so it is the one place raw values may appear.
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs'],
    ignores: ['**/*.spec.*', '**/*.test.*'],
    plugins: { nowcore },
    rules: { 'nowcore/no-raw-design-values': 'error' },
  },

  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {
      // `const { dropped: _dropped, ...rest } = x` builds an object missing
      // exactly one field. Without these options the idiom always warns, and
      // warnings that are always present teach people to stop reading them.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Must stay last: turns off every rule that would fight Prettier.
  prettier,
];
