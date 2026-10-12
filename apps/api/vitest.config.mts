import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * The one place this project's test setup differs from the others.
 *
 * Nest resolves constructor dependencies by reading `design:paramtypes`, which
 * only exists if the compiler wrote it. `tsc` does, under
 * `emitDecoratorMetadata`; vitest's own esbuild transform does not, and would
 * silently produce a container that cannot inject anything. swc reproduces what
 * the build emits, so what the tests exercise is what ships.
 */
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api',
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        // The two that matter: `legacyDecorator` is the proposal Nest is built
        // on, and `decoratorMetadata` is the part esbuild cannot do at all.
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    name: 'api',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
