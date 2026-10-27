/**
 * Emit the browser artifact in the format the Harness client module loader
 * executes: a `window.__ModuleLoader__.load({ id, factory(require) })` closure
 * whose factory returns `{ inject, apply }`.
 *
 * The plugin's sources are TypeScript, so esbuild bundles them into CommonJS
 * first and the banner/footer wrap that bundle in the factory. React stays
 * external and comes from the page's module table through `require('react')`;
 * `@deepseek-ai/*` imports are type-only and vanish, the rest is local code.
 */
import { build } from 'esbuild'

const ID = 'dsh-cache-diagnostics'

await build({
  entryPoints: ['src/client/index.tsx'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/*'],
  logLevel: 'info',
  banner: {
    js: [
      `window.__ModuleLoader__.load({`,
      `  id: ${JSON.stringify(ID)},`,
      `  factory(require) {`,
      `    const module = { exports: {} }`,
      `    const exports = module.exports`,
    ].join('\n'),
  },
  footer: {
    js: ['    return module.exports', '  },', '})'].join('\n'),
  },
})
