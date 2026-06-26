import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jokjxpogvwxbwdaroqkc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2p4cG9ndnd4YndkYXJvcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNzM5MjUsImV4cCI6MjA3Nzc0OTkyNX0.Y8mtJNVFpnSOUnEZV83OBaCldacW9N-khDVO7Mewxeg';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
