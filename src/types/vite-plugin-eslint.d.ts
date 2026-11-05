// vite-plugin-eslint ships types, but its package.json `exports` doesn't expose
// them, so they can't be resolved with `moduleResolution: "Bundler"`
declare module 'vite-plugin-eslint' {
  import type { ESLint } from 'eslint';
  import type { Plugin } from 'vite';

  interface Options extends ESLint.Options {
    eslintPath?: string;
    lintOnStart?: boolean;
    include?: string | string[];
    exclude?: string | string[];
    formatter?: string;
    emitWarning?: boolean;
    emitError?: boolean;
    failOnWarning?: boolean;
    failOnError?: boolean;
  }

  export default function eslintPlugin(options?: Options): Plugin;
}
