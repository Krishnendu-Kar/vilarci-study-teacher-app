import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** Account owner details — one row in public.users per login. */
export interface AccountProfile {
  id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: 'male' | 'female' | 'other' | null;
  whatsapp_number: string | null;
  email: string | null;
  dob: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthValue {
  session: Session | null;
  profile: AccountProfile | null;
  /** True until the stored session has been read on launch. */
  loading: boolean;
  /**
   * Set while the forgot-password flow holds a verified OTP session, so the
   * navigator keeps the auth screens up until the new password is saved.
   */
  recovering: boolean;
  setRecovering: (value: boolean) => void;
  /** Browsing the sample data without an account (not persisted). */
  demo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [demo, setDemo] = useState(false);
  const enterDemo = useCallback(() => setDemo(true), []);
  const exitDemo = useCallback(() => setDemo(false), []);

  useEffect(() => {
    let mounted = true;
    // getSession reads local storage, so a network blip never looks like a logout.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      if (next) setDemo(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    // A missing table or row is not fatal — the app falls back to the auth user.
    setProfile(error ? null : (data as AccountProfile | null));
  }, [userId]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<AuthValue>(
    () => ({ session, profile, loading, recovering, setRecovering, demo, enterDemo, exitDemo, refreshProfile }),
    [session, profile, loading, recovering, demo, enterDemo, exitDemo, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Display name for the signed-in account holder. */
export function accountName(profile: AccountProfile | null, session: Session | null): string {
  const fromRow = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') : '';
  if (fromRow) return fromRow;
  const meta = session?.user.user_metadata ?? {};
  return [meta.first_name, meta.last_name].filter(Boolean).join(' ') || 'Vilarci member';
}

/** WhatsApp number on file, falling back to the login's phone. */
export function accountWhatsapp(profile: AccountProfile | null, session: Session | null): string | null {
  const phone = session?.user.phone;
  return profile?.whatsapp_number || (phone ? `+${phone.replace(/^\+/, '')}` : null);
}
