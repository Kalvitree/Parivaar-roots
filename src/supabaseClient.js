import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Helpful console warning for missing env values during development.
  // This is the most common cause of JSON / network errors when calling the API.
  // Developers should set these in a local `.env` file (see .env.example).
  // Keep this non-fatal so the app can still load in the dev environment.
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const SUPABASE_CONFIG_OK = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
