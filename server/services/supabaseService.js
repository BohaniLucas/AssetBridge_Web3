import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve the server's own .env instead of relying on the shell's current
// directory. This makes `npm run dev` work when launched from either the repo
// root or the server directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const isUsableValue = (value, placeholders = []) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !placeholders.some((placeholder) => value.toLowerCase().includes(placeholder));

export const isSupabaseConfigured = () => {
  return isUsableValue(supabaseUrl, ['your-project-id']) &&
    isUsableValue(supabaseKey, ['your-supabase-', 'your_anon_key']);
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        transport: ws,
      },
    })
  : null;
