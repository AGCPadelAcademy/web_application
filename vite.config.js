import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig, loadEnv } from 'vite';

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
    react(),
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
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  }
  };
});
