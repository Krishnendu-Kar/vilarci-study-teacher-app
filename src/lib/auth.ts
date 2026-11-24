// Auth flows shared with the Vilarci Study app (same Supabase project and
// accounts), originally ported from the Vilarci buyer app.
// Signup verifies the WhatsApp number by OTP (Supabase Phone provider).
// Captcha is intentionally not sent: Turnstile is off on this project. If it
// is ever switched on in Supabase, every call here must pass a captchaToken.
import { AppState } from 'react-native';
import { supabase } from './supabase';
import { useLocalStore } from './local/store';
import { requestSync } from './sync/engine';

// Keep tokens fresh only while the app is in the foreground (supabase-js RN guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// ─── shared validation ────────────────────────────────────────────────────────

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ONE rule table for both the submit gate and the live checklist, so they can
// never disagree. The hyphen must stay last in the class.
const SPECIAL_RE = /[!@#$%^&*(),.?":{}|<>_-]/;

const PASSWORD_RULES: { key: string; label: string; test: (pw: string) => boolean; problem: (pw: string) => string }[] = [
  {
    key: 'length',
    label: '8 to 64 characters',
    test: (pw) => pw.length >= 8 && pw.length <= 64,
    problem: (pw) => (pw.length < 8 ? 'Password must be at least 8 characters long.' : 'Password is too long (max 64).'),
  },
  { key: 'upper', label: 'One capital letter (A–Z)', test: (pw) => /[A-Z]/.test(pw), problem: () => 'Include a capital letter (A–Z).' },
  { key: 'lower', label: 'One small letter (a–z)', test: (pw) => /[a-z]/.test(pw), problem: () => 'Include a small letter (a–z).' },
  { key: 'digit', label: 'One number (0–9)', test: (pw) => /[0-9]/.test(pw), problem: () => 'Include a number (0–9).' },
  {
    key: 'special',
    label: 'One symbol — ! @ # $ % & * ? _ -',
    test: (pw) => SPECIAL_RE.test(pw),
    problem: () => 'Include a symbol such as ! @ # $ % & * ? _ -',
  },
];

export function passwordProblem(pw: string): string | null {
  for (const rule of PASSWORD_RULES) if (!rule.test(pw)) return rule.problem(pw);
  return null;
}

export type PasswordCheck = { key: string; label: string; ok: boolean };

export function passwordChecks(pw: string): PasswordCheck[] {
  return PASSWORD_RULES.map((r) => ({ key: r.key, label: r.label, ok: r.test(pw) }));
}

/** Account holders must be 18+. */
export function isEighteenOrOlder(dob: Date): boolean {
  const now = new Date();
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  return dob <= cutoff;
}

/** "9876543210" → "+919876543210"; leaves an explicit +… untouched. */
export function toE164(mobile: string): string {
  const raw = mobile.replace(/[\s-]/g, '');
  return raw.startsWith('+') ? raw : `+91${raw}`;
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Turns Supabase / network errors into sentences people can act on. */
export function describeAuthError(err: unknown, fallback: string): string {
  const msg = String((err as Error)?.message ?? '');
  if (/invalid login credentials/i.test(msg)) return 'That number/email and password don’t match.';
  if (/phone not confirmed|email not confirmed/i.test(msg)) return 'This account isn’t verified yet. Sign up again to get a fresh code.';
  if (/user already registered|already been registered/i.test(msg)) return 'An account already exists for this number. Log in instead.';
  if (/token has expired|invalid.*otp|otp.*invalid|token.*invalid/i.test(msg)) return 'That code is wrong or has expired. Request a new one.';
  if (/18 years/i.test(msg)) return 'The account holder must be at least 18 years old.';
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (/phone logins are disabled|phone_provider_disabled/i.test(msg)) {
    return 'Mobile-number login isn’t switched on yet. Please try again later.';
  }
  if (/phone.*(provider|disabled)|unsupported phone provider|sms.*(disabled|provider)/i.test(msg)) {
    return 'WhatsApp verification isn’t switched on yet. Please try again later.';
  }
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg || fallback;
}

// Anti-enumeration: a reset for an unknown account must look like success.
function isEnumerationError(err: unknown): boolean {
  return /signups? not allowed|user not found/i.test(String((err as Error)?.message ?? ''));
}

// ─── login ────────────────────────────────────────────────────────────────────

/** An @ means email; anything else is treated as a +91 mobile number. */
export async function loginWithPassword(identifier: string, password: string) {
  const id = identifier.trim();
  const creds = id.includes('@') ? { email: id, password } : { phone: toE164(id), password };
  const { error } = await supabase.auth.signInWithPassword(creds);
  if (error) throw error;
}

// ─── signup ───────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other';

export interface SignupDetails {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: Gender;
  dobISO: string;
  mobile: string;
  email: string;
  password: string;
}

/** Creates the account and sends the WhatsApp OTP. Returns the E.164 phone. */
export async function signupWithWhatsAppOtp(d: SignupDetails): Promise<string> {
  const phone = toE164(d.mobile);
  const data: Record<string, string> = {
    first_name: d.firstName,
    middle_name: d.middleName,
    last_name: d.lastName,
    gender: d.gender,
    dob: d.dobISO,
    whatsapp_number: phone,
  };
  if (d.email) data.email = d.email;

  const { error } = await supabase.auth.signUp({ phone, password: d.password, options: { data } });
  if (error) throw error;
  return phone;
}

export async function verifySignupOtp(phone: string, code: string) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
  if (error) throw error;
  return data;
}

export async function resendSignupOtp(phone: string) {
  const { error } = await supabase.auth.resend({ type: 'sms', phone });
  if (error) throw error;
}

// ─── forgot password ──────────────────────────────────────────────────────────

export type ResetChannel = 'sms' | 'email';

/** Always resolves for unknown accounts — the UI says "if an account exists…". */
export async function requestResetOtp(channel: ResetChannel, target: string) {
  if (channel === 'sms') {
    const { error } = await supabase.auth.signInWithOtp({ phone: target, options: { shouldCreateUser: false } });
    if (error && !isEnumerationError(error)) throw error;
  } else {
    const { error } = await supabase.auth.resetPasswordForEmail(target);
    if (error && !isEnumerationError(error)) throw error;
  }
}

export async function verifyResetOtp(channel: ResetChannel, target: string, code: string) {
  const payload =
    channel === 'sms'
      ? { phone: target, token: code, type: 'sms' as const }
      : { email: target, token: code, type: 'recovery' as const };
  const { data, error } = await supabase.auth.verifyOtp(payload);
  if (error) throw error;
  if (!data?.session) throw new Error('Verification failed. Please try again.');
}

/** Sets the new password on the OTP session, then signs out everywhere. */
export async function saveNewPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  try {
    await supabase.auth.signOut({ scope: 'global' });
  } catch {
    // The password IS changed; a lingering session simply expires.
  }
}

/**
 * Logging out deletes the phone's copy, so edits that haven't reached the
 * server yet are uploaded first; if they can't be, the teacher stays signed in.
 */
export async function signOut() {
  if (useLocalStore.getState().pending) {
    await requestSync();
    const left = useLocalStore.getState().pending;
    if (left) {
      throw new Error(`${left} change${left === 1 ? ' hasn’t' : 's haven’t'} uploaded yet. Connect to the internet, then log out.`);
    }
  }
  await supabase.auth.signOut();
}
