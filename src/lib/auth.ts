// Sign-in for Vilarci Teacher goes entirely through Vilarci: the app opens
// Vilarci's own login/consent page (vilarci.in), which handles signup, OTP and
// passwords, then hands back a one-time code that we swap for a session on the
// shared Vilarci-study project. Same flow as the student/parent app.
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

/** Custom OIDC provider registered on the Vilarci-study project. */
const VILARCI_PROVIDER = 'custom:vilarci';
const VILARCI_SCOPES = 'openid profile email phone';

/** Where teachers update their name, number or password — Vilarci's own profile page. */
export const MANAGE_ACCOUNT_URL = 'https://vilarci.in/profile';

export const VILARCI_LOGO_URL = 'https://officialpic.vilarci.in/Icons/web-icon.png';

// Lets the auth browser hand control back on web; a no-op on native.
WebBrowser.maybeCompleteAuthSession();

// Keep tokens fresh only while the app is in the foreground (supabase-js RN guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export type SignInResult = 'signed-in' | 'cancelled';

/**
 * Opens Vilarci's sign-in page in an in-app browser and completes the PKCE
 * exchange. Resolves 'cancelled' if the browser is closed or access denied.
 */
export async function signInWithVilarci(): Promise<SignInResult> {
  const redirectTo = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: VILARCI_PROVIDER,
    options: { redirectTo, scopes: VILARCI_SCOPES, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Could not start Vilarci sign-in.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';

  const { queryParams } = Linking.parse(result.url);
  const param = (key: string) => {
    const value = queryParams?.[key];
    return Array.isArray(value) ? value[0] : value ?? undefined;
  };

  const oauthError = param('error');
  if (oauthError) {
    if (oauthError === 'access_denied') return 'cancelled';
    throw new Error(param('error_description') ?? oauthError);
  }

  const code = param('code');
  if (!code) throw new Error('Vilarci did not return a sign-in code. Please try again.');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return 'signed-in';
}

/** Signs out of Vilarci Teacher on this device only; the Vilarci account is untouched. */
export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' });
}

/** Turns Supabase / network errors into sentences a teacher can act on. */
export function describeAuthError(err: unknown, fallback: string): string {
  const msg = String((err as Error)?.message ?? '');
  if (/provider is not enabled|unsupported provider|custom provider/i.test(msg)) {
    return 'Vilarci sign-in isn’t switched on for this app yet. Please try again later.';
  }
  if (/network|fetch|timed? ?out/i.test(msg)) return 'No connection. Check your internet and try again.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  return msg || fallback;
}
