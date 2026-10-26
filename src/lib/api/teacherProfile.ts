// The signed-in account's teacher profile (public.teachers). One account = one
// teacher: the row's primary key IS the account id, so a second profile can't
// exist. Name, WhatsApp and email live on public.users, not here.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../AuthProvider';

export interface TeacherProfile {
  id: string;
  qualification: string;
  primary_subject: string;
  experience_years: number | null;
  bio: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type TeacherProfileInput = Pick<TeacherProfile, 'qualification' | 'primary_subject' | 'experience_years' | 'bio'>;

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

const key = (accountId: string | undefined) => ['teacher-profile', accountId] as const;

export function useTeacherProfile() {
  const { session } = useAuth();
  const accountId = session?.user.id;
  return useQuery({
    queryKey: key(accountId),
    enabled: Boolean(accountId),
    queryFn: async (): Promise<TeacherProfile | null> => {
      const { data, error } = await supabase.from('teachers').select('*').eq('id', accountId!).maybeSingle();
      if (error) throw error;
      return (data as TeacherProfile | null) ?? null;
    },
  });
}

/** Creates the profile the first time, updates it afterwards. */
export function useSaveTeacherProfile() {
  const { session } = useAuth();
  const accountId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ exists, input }: { exists: boolean; input: TeacherProfileInput }) => {
      if (!accountId) throw new Error('Please log in again.');
      const query = exists
        ? supabase.from('teachers').update(input).eq('id', accountId)
        : supabase.from('teachers').insert({ id: accountId, ...input });
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(accountId) }),
  });
}

export function describeTeacherError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  if (/duplicate key|teachers_pkey/i.test(msg)) return 'This account already has a teacher profile.';
  if (/experience_years/i.test(msg)) return `Experience must be between 0 and ${EXPERIENCE_MAX} years.`;
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg || 'Something went wrong. Please try again.';
}
