import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { elevation, radius, spacing } from '../../theme/tokens';
import { accountName, accountWhatsapp, useAuth } from '../../lib/AuthProvider';
import { describeTeacherError, useTeacherProfile } from '../../lib/api/teacherProfile';
import { AppText, Avatar, Card, Divider, HeroCard, IconName, KeyValue, Pill, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';

/** Teacher features that still live only in the demo. */
const COMING_NEXT: { icon: IconName; title: string }[] = [
  { icon: 'business-outline', title: 'Institutes & invite codes' },
  { icon: 'albums-outline', title: 'Batches & students' },
  { icon: 'checkmark-done-outline', title: 'Attendance & check-in codes' },
  { icon: 'document-text-outline', title: 'Tests, marks & homework' },
  { icon: 'wallet-outline', title: 'Fees' },
];

/**
 * Home of the real, database-connected teacher app: the account (public.users)
 * and its single teacher profile (public.teachers).
 */
export function TeacherHomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { session, profile, enterDemo } = useAuth();
  const teacher = useTeacherProfile();

  const name = accountName(profile, session);
  const initials = `${profile?.first_name?.[0] ?? name[0] ?? 'V'}${profile?.last_name?.[0] ?? ''}`.toUpperCase();
  const t = teacher.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <Row
        justify="space-between"
        gap={spacing.md}
        style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
      >
        <Pressable
          onPress={() => navigation.navigate('Account')}
          accessibilityRole="button"
          accessibilityLabel="Your account"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, opacity: pressed ? 0.7 : 1 })}
        >
          <Avatar initials={initials} gradient={['#5a0812', '#8E1437']} size={40} ring />
          <View style={{ flex: 1 }}>
            <AppText variant="overline" tone="muted">
              MY ACCOUNT
            </AppText>
            <AppText variant="subheading" numberOfLines={1}>
              {name}
            </AppText>
          </View>
        </Pressable>
        <Pressable
          onPress={enterDemo}
          accessibilityRole="button"
          accessibilityLabel="Open demo screens"
          hitSlop={6}
          style={({ pressed }) => [
            styles.demoBtn,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1, ...elevation(1, colors.shadowColor, colors.shadowOpacity) },
          ]}
        >
          <Ionicons name="play-circle-outline" size={17} color={colors.primary} />
          <AppText variant="captionStrong" tone="primary">
            Demo
          </AppText>
        </Pressable>
      </Row>

      <Screen refreshing={teacher.isRefetching} onRefresh={() => teacher.refetch()}>
        <HeroCard>
          <AppText variant="overline" style={{ color: colors.goldBright }}>
            VILARCI TEACHER
          </AppText>
          <AppText variant="display" style={{ color: '#FDFBF9', marginTop: 2 }}>
            Hi, {profile?.first_name || name.split(' ')[0]}
          </AppText>
          <AppText variant="caption" style={{ color: 'rgba(253,251,249,0.7)', marginTop: 2 }}>
            {t ? `${t.primary_subject} educator · profile live` : 'Set up your teacher profile to get started.'}
          </AppText>
        </HeroCard>

        {/* ── Teacher profile ───────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader
            title="Teacher profile"
            subtitle="Shown to students and institutes"
            action={t ? 'Edit' : undefined}
            onAction={() => navigation.navigate('TeacherProfileForm')}
          />
          {teacher.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : teacher.isError ? (
            <Card>
              <AppText variant="caption" tone="error">
                {describeTeacherError(teacher.error)}
              </AppText>
              <Button label="Try again" variant="secondary" size="sm" onPress={() => teacher.refetch()} style={{ marginTop: spacing.md }} />
            </Card>
          ) : t ? (
            <Card>
              <Row gap={spacing.md}>
                <Avatar initials={initials} gradient={['#0F7A52', '#3DB385']} size={52} />
                <View style={{ flex: 1 }}>
                  <AppText variant="heading" numberOfLines={1}>
                    {name}
                  </AppText>
                  <Row gap={6} style={{ marginTop: 3 }}>
                    <Pill label={t.primary_subject || 'Subject not set'} tone="primary" />
                    {t.experience_years !== null ? <Pill label={`${t.experience_years} yrs exp`} tone="gold" /> : null}
                  </Row>
                </View>
              </Row>
              <Divider style={{ marginVertical: spacing.md }} />
              <KeyValue label="Qualification" value={t.qualification || '—'} />
              <KeyValue label="WhatsApp" value={accountWhatsapp(profile, session) ?? '—'} />
              <KeyValue label="Email" value={profile?.email ?? session?.user.email ?? '—'} />
              {t.bio ? (
                <AppText variant="body" tone="secondary" style={{ marginTop: spacing.md }}>
                  {t.bio}
                </AppText>
              ) : null}
            </Card>
          ) : (
            <Card>
              <Row gap={spacing.md} align="flex-start">
                <View style={[styles.ctaIcon, { backgroundColor: colors.primarySubtle }]}>
                  <Ionicons name="school-outline" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="subheading">Create your teacher profile</AppText>
                  <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
                    Your subject, qualification and experience. One profile per account.
                  </AppText>
                </View>
              </Row>
              <Button
                label="Create teacher profile"
                iconName="add-circle-outline"
                fullWidth
                onPress={() => navigation.navigate('TeacherProfileForm')}
                style={{ marginTop: spacing.lg }}
              />
            </Card>
          )}
        </View>

        {/* ── Build progress ────────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Coming next" subtitle="Already designed — try them in the demo" />
          <Card>
            {COMING_NEXT.map((f, i) => (
              <Row
                key={f.title}
                gap={spacing.md}
                style={{ paddingVertical: spacing.sm, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border }}
              >
                <Ionicons name={f.icon} size={18} color={colors.textMuted} />
                <AppText variant="bodyStrong" tone="secondary" style={{ flex: 1 }}>
                  {f.title}
                </AppText>
                <Pill label="Demo" tone="neutral" />
              </Row>
            ))}
            <Button label="Open the demo" variant="secondary" size="sm" iconName="play-circle-outline" fullWidth onPress={enterDemo} style={{ marginTop: spacing.md }} />
          </Card>
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
