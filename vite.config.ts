import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import eslint from 'vite-plugin-eslint';

const root = import.meta.dirname;
const outDir = resolve(root, 'dist');

interface PackageJson {
  version: string;
}

/**
 * Emits `manifest.json`, stamped with the version from package.json
 */
function manifestPlugin(): Plugin {
  return {
    name: 'extension-manifest',
    generateBundle() {
      const pkg = JSON.parse(
        readFileSync(resolve(root, 'package.json'), 'utf8')
      ) as PackageJson;
      const manifest = JSON.parse(
        readFileSync(resolve(root, 'src/manifest.json'), 'utf8')
      ) as Record<string, unknown>;
      manifest.version = pkg.version;
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}

const eslintPlugin = eslint({
  include: ['src/**/*.ts'],
  emitWarning: true,
  emitError: false, // error doesn't block compilation
  failOnWarning: false,
  failOnError: false, // error doesn't block compilation
});

/**
 * Two builds, selected by `--mode`:
 *  - `popup`: the extension popup page (+ static files and manifest)
 *  - `content`: the exporter injected into LinkedIn pages. This must be a single
 *    self-contained classic script (IIFE), since it's injected with
 *    `scripting.executeScript({ files })`
 */
export default defineConfig(({ mode }) => {
  if (mode === 'content') {
    return {
      publicDir: false,
      plugins: [eslintPlugin],
      build: {
        outDir,
        emptyOutDir: false,
        lib: {
          entry: resolve(root, 'src/content/index.ts'),
          formats: ['iife'],
          name: 'LinkedinToResumeJson',
          fileName: () => 'exporter.js',
        },
      },
    };
  }

  return {
    root: resolve(root, 'src/popup'),
    base: './',
    publicDir: resolve(root, 'public'),
    plugins: [eslintPlugin, manifestPlugin()],
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(root, 'src/popup/popup.html'),
      },
    },
  };
});
