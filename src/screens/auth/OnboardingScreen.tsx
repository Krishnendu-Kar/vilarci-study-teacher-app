import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';
import { accountName, accountPhone, useAuth } from '../../lib/AuthProvider';
import { AppText, IconName, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { AuthCard, AuthHero, ErrorBanner } from '../../components/auth/AuthKit';

const NEXT_STEPS: { icon: IconName; text: string }[] = [
  { icon: 'business-outline', text: 'Join your institutes with their invite codes' },
  { icon: 'people-outline', text: 'Set up batches and add students' },
  { icon: 'checkmark-done-outline', text: 'Take attendance, publish marks and award points' },
];

/**
 * First visit after "Continue with Vilarci": confirm the Vilarci account and
 * create the teacher record. Independent of the Study app, so the same person
 * can also be a parent there.
 */
export function OnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session, profile, refreshAccount } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const name = accountName(profile, session);
  const phone = accountPhone(profile, session);
  const firstName = name.split(' ')[0];

  const confirm = async () => {
    if (!session) return;
    setBusy(true);
    setFailure(null);
    try {
      const { error } = await supabase.from('teacher_accounts').insert({ id: session.user.id });
      // A duplicate means another device already finished onboarding — just reload.
      if (error && error.code !== '23505') throw error;
      await refreshAccount();
      toast.toast(`Welcome to Vilarci Teacher, ${firstName}!`, 'success');
    } catch (err) {
      setFailure(String((err as Error)?.message || 'Couldn’t set up your teacher profile. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <AuthHero title={`Hi, ${firstName}`} subtitle="Let’s set up your teacher profile." />

        <AuthCard>
          <Row gap={spacing.sm} style={{ marginBottom: spacing.lg }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
              Signed in with Vilarci as <AppText variant="captionStrong">{name}</AppText>
              {phone ? ` · ${phone}` : ''}
            </AppText>
          </Row>

          <AppText variant="title">Teach with Vilarci</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.lg }}>
            Students and institutes will see you by your Vilarci name. You can change it on vilarci.in.
          </AppText>

          <ErrorBanner message={failure} />

          <View style={{ gap: spacing.md }}>
            {NEXT_STEPS.map((s) => (
              <Row key={s.text} gap={spacing.md} align="flex-start">
                <Ionicons name={s.icon} size={18} color={colors.primary} style={{ marginTop: 1 }} />
                <AppText variant="body" tone="secondary" style={{ flex: 1 }}>
                  {s.text}
                </AppText>
              </Row>
            ))}
          </View>
        </AuthCard>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md }}>
        <Button label="Create teacher profile" iconName="arrow-forward" size="lg" fullWidth loading={busy} onPress={confirm} />
        <Pressable onPress={() => signOut().catch(() => {})} hitSlop={8} style={{ alignSelf: 'center', marginTop: spacing.md }}>
          <AppText variant="caption" tone="secondary">
            Not you? <AppText variant="captionStrong" tone="primary">Use another Vilarci account</AppText>
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
