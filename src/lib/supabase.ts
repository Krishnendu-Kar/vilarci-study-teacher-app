import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Project "Vilarci-study" — shared with the student/parent app. Values come
// from .env (EXPO_PUBLIC_* vars are inlined by Expo at build time).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Supabase config — copy .env.example to .env, fill in the values, then restart the dev server.',
  );
}

/** Single client for the whole app. Sessions persist until the user logs out. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // "Continue with Vilarci" returns an auth code that we exchange in-app.
    flowType: 'pkce',
  },
});
