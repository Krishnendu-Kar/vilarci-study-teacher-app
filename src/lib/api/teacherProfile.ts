// The signed-in account's teacher profile (public.teachers). One account = one
// teacher: the row's primary key IS the account id, so a second profile can't
// exist. Name, WhatsApp and email live on public.users, not here. Read from
// the phone's copy (the account snapshot); saved with the teacher_save action.
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useLocalStore } from '../local/store';
import type { TeacherProfile } from '../local/types';
import { requestSync } from '../sync/engine';

export type { TeacherProfile };

export type TeacherProfileInput = Pick<
  TeacherProfile,
  'qualification' | 'primary_subject' | 'experience_years' | 'bio' | 'achievements' | 'authored_books'
>;

export const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Computer Science',
  'Social Science',
  'Hindi',
  'Bengali',
  'Accountancy',
  'Economics',
];

export const QUALIFICATION_MIN = 2;
export const QUALIFICATION_MAX = 80;
export const SUBJECT_MAX = 40;
export const BIO_MAX = 300;
export const EXPERIENCE_MAX = 70;
/** achievements / authored_books: up to 10 items, 3–120 characters each. */
export const LIST_MAX_ITEMS = 10;
export const LIST_ITEM_MIN = 3;
export const LIST_ITEM_MAX = 120;

/**
 * The profile, null when there isn't one yet. isLoading until the phone's
 * copy has come from the server once (a new phone), so "no profile" is never
 * guessed.
 */
export function useTeacherProfile(): { data: TeacherProfile | null | undefined; isLoading: boolean; isError: boolean } {
  const isLoading = useLocalStore((s) => !s.ready || !s.account);
  const data = useLocalStore((s) => (s.account ? s.account.teacher : undefined));
  return { data, isLoading, isError: false };
}

/** Creates the profile the first time, updates it afterwards. Needs the internet. */
export function useSaveTeacherProfile() {
  return useMutation({
    mutationFn: async ({ input }: { exists: boolean; input: TeacherProfileInput }) => {
      const { error } = await supabase.rpc('teacher_save', { p_data: input });
      if (error) throw error;
      await requestSync();
    },
  });
}

export function describeTeacherError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  if (/network|fetch|timed? ?out/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg || 'Something went wrong. Please try again.';
}
