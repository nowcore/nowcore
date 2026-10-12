#!/usr/bin/env bash
# Usage: tools/scaffold-lib.sh <dir-name> <scope-tag> [jsx]
# Writes the boilerplate every lib shares, in the classroom-metaverse shape:
# package.json with an `nx` block, solution-style tsconfig, lib + spec configs,
# vitest and eslint configs. Domain code is written by hand afterwards.
set -euo pipefail
name="$1"; scope="$2"; jsx="${3:-}"
dir="libs/$name"
mkdir -p "$dir/src"
env_kind="node"; jsx_opt=""; inc='"src/**/*.ts"'
if [ "$jsx" = "jsx" ]; then env_kind="jsdom"; jsx_opt='"jsx": "react-jsx",'; inc='"src/**/*.ts", "src/**/*.tsx"'; fi

cat > "$dir/package.json" <<JSON
{
  "name": "@nowcore/$name",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "nx": {
    "name": "$name",
    "tags": ["scope:$scope", "type:lib"]
  },
  "dependencies": {
    "tslib": "^2.3.0"
  }
}
JSON

cat > "$dir/tsconfig.json" <<JSON
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
JSON

cat > "$dir/tsconfig.lib.json" <<JSON
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
    "emitDeclarationOnly": false,
    $jsx_opt
    "types": ["node"]
  },
  "include": [$inc],
  "references": [],
  "exclude": ["vitest.config.mts", "src/**/*.spec.ts", "src/**/*.spec.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"]
}
JSON

cat > "$dir/tsconfig.spec.json" <<JSON
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./out-tsc/vitest",
    $jsx_opt
    "types": ["vitest/globals", "vitest/importMeta", "vite/client", "node", "vitest"]
  },
  "include": ["vitest.config.mts", "src/**/*.spec.ts", "src/**/*.spec.tsx", "src/**/*.test.ts", "src/**/*.d.ts"],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
JSON

cat > "$dir/vitest.config.mts" <<TS
import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/$name',
  test: {
    name: '$name',
    watch: false,
    globals: true,
    environment: '$env_kind',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: false,
  },
}));
TS

cat > "$dir/eslint.config.mjs" <<'JS'
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
          ignoredDependencies: ['vitest'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    ignores: ['**/out-tsc', '**/test-output'],
  },
];
JS
echo "scaffolded $dir ($scope)"
