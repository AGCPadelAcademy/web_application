import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file (see .env.example).'
  );
}

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage (Supabase default) and auto-detect
    // auth tokens in the URL so the email-confirmation and password-reset
    // redirect flows work without a dedicated server route.
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
});

export default customSupabaseClient;

export {
  customSupabaseClient,
  customSupabaseClient as supabase,
};
