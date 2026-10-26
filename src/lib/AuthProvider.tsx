import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** The person, mirrored from their Vilarci account. */
export interface AccountProfile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface AuthValue {
  session: Session | null;
  profile: AccountProfile | null;
  /** Has finished teacher onboarding (row in teacher_accounts). */
  isTeacher: boolean;
  /** True until the stored session (and its account rows) have been read. */
  loading: boolean;
  /** Signed in with Vilarci but hasn't set up the teacher profile yet. */
  needsOnboarding: boolean;
  /** Browsing the sample data without an account (not persisted). */
  demo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [demo, setDemo] = useState(false);
  const enterDemo = useCallback(() => setDemo(true), []);
  const exitDemo = useCallback(() => setDemo(false), []);

  useEffect(() => {
    let mounted = true;
    // getSession reads local storage, so a network blip never looks like a logout.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setSessionLoaded(true);
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

  const refreshAccount = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setIsTeacher(false);
      setAccountLoaded(true);
      return;
    }
    const [profileRes, teacherRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, email, avatar_url').eq('id', userId).maybeSingle(),
      supabase.from('teacher_accounts').select('id').eq('id', userId).maybeSingle(),
    ]);
    setProfile((profileRes.data as AccountProfile | null) ?? null);
    setIsTeacher(Boolean(teacherRes.data));
    setAccountLoaded(true);
  }, [userId]);

  useEffect(() => {
    setAccountLoaded(false);
    refreshAccount();
  }, [refreshAccount]);

  const loading = !sessionLoaded || (Boolean(session) && !accountLoaded);
  const needsOnboarding = Boolean(session) && accountLoaded && !isTeacher;

  const value = useMemo<AuthValue>(
    () => ({ session, profile, isTeacher, loading, needsOnboarding, demo, enterDemo, exitDemo, refreshAccount }),
    [session, profile, isTeacher, loading, needsOnboarding, demo, enterDemo, exitDemo, refreshAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Display name for the signed-in person. */
export function accountName(profile: AccountProfile | null, session: Session | null): string {
  if (profile?.full_name) return profile.full_name;
  const meta = session?.user.user_metadata ?? {};
  return meta.name || meta.full_name || 'Vilarci member';
}

/** Best phone number we know for the person. */
export function accountPhone(profile: AccountProfile | null, session: Session | null): string | null {
  return profile?.phone || session?.user.phone || session?.user.user_metadata?.phone_number || null;
}
