import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig, loadEnv } from 'vite';
import inlineEditPlugin from './plugins/visual-editor/vite-plugin-react-inline-editor.js';
import editModeDevPlugin from './plugins/visual-editor/vite-plugin-edit-mode.js';
import iframeRouteRestorationPlugin from './plugins/vite-plugin-iframe-route-restoration.js';
import selectionModePlugin from './plugins/selection-mode/vite-plugin-selection-mode.js';

const isDev = process.env.NODE_ENV !== 'production';

// Hostinger Horizons dev-tooling scripts injected into index.html.
// Kept as real files under plugins/horizons/scripts/ so they are lintable/editable.
const readHorizonsScript = (name) =>
  fs.readFileSync(new URL(`./plugins/horizons/scripts/${name}`, import.meta.url), 'utf8');

const configHorizonsViteErrorHandler = readHorizonsScript('vite-error-handler.js');
const configHorizonsRuntimeErrorHandler = readHorizonsScript('runtime-error-handler.js');
const configHorizonsConsoleErrorHandler = readHorizonsScript('console-error-handler.js');
const configWindowFetchMonkeyPatch = readHorizonsScript('window-fetch-monkey-patch.js');
const configNavigationHandler = readHorizonsScript('navigation-handler.js');

const addTransformIndexHtml = {
  name: 'add-transform-index-html',
  transformIndexHtml(html) {
    const tags = [
      {
        tag: 'script',
        attrs: { type: 'module' },
        children: configHorizonsRuntimeErrorHandler,
        injectTo: 'head',
      },
      {
        tag: 'script',
        attrs: { type: 'module' },
        children: configHorizonsViteErrorHandler,
        injectTo: 'head',
      },
      {
        tag: 'script',
        attrs: {type: 'module'},
        children: configHorizonsConsoleErrorHandler,
        injectTo: 'head',
      },
      {
        tag: 'script',
        attrs: { type: 'module' },
        children: configWindowFetchMonkeyPatch,
        injectTo: 'head',
      },
      {
        tag: 'script',
        attrs: { type: 'module' },
        children: configNavigationHandler,
        injectTo: 'head',
      },
    ];

    if (!isDev && process.env.TEMPLATE_BANNER_SCRIPT_URL && process.env.TEMPLATE_REDIRECT_URL) {
      tags.push(
        {
          tag: 'script',
          attrs: {
            src: process.env.TEMPLATE_BANNER_SCRIPT_URL,
            'template-redirect-url': process.env.TEMPLATE_REDIRECT_URL,
          },
          injectTo: 'head',
        }
      );
    }

    return {
      html,
      tags,
    };
  },
};

console.warn = () => {};

const logger = createLogger()
const loggerError = logger.error

logger.error = (msg, options) => {
  if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
    return;
  }

  loggerError(msg, options);
}

/** Read Supabase env vars from process.env (Vercel injects these at build time)
 *  and from .env files (local dev). Vite only auto-inlines import.meta.env.*
 *  when the vars are visible during config — explicit `define` avoids silent
 *  empty strings in Preview/Production builds. */
function resolveSupabaseEnv(mode) {
  const fileEnv = loadEnv(mode, process.cwd(), '');
  return {
    url: process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY || '',
  };
}

export default defineConfig(({ mode }) => {
  const supabaseEnv = resolveSupabaseEnv(mode);

  if (mode === 'production' && (!supabaseEnv.url || !supabaseEnv.anonKey)) {
    const viteKeys = Object.keys(process.env).filter((k) => k.startsWith('VITE_'));
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for production build. '
      + 'On Vercel: Project → Settings → Environment Variables → enable Preview + Production. '
      + `VITE_ keys visible to build: ${viteKeys.join(', ') || '(none)'}`
    );
  }

  return {
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseEnv.url),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseEnv.anonKey),
  },
  customLogger: logger,
  plugins: [
    ...(isDev ? [inlineEditPlugin(), editModeDevPlugin(), iframeRouteRestorationPlugin(), selectionModePlugin()] : []),
    react(),
    addTransformIndexHtml
  ],
  server: {
    cors: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    allowedHosts: [
      '.app-preview.com',
      '.app-preview.io',
    ],
  },
  resolve: {
    extensions: ['.jsx', '.js', '.tsx', '.ts', '.json', ],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        '@babel/parser',
        '@babel/traverse',
        '@babel/generator',
        '@babel/types'
      ]
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  }
  };
});
