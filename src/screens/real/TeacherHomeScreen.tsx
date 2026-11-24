import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { elevation, radius, spacing } from '../../theme/tokens';
import { accountName, useAuth } from '../../lib/AuthProvider';
import { useTeacherProfile } from '../../lib/api/teacherProfile';
import { useBatchCounts, usePrivateBatches } from '../../lib/api/privateBatches';
import { useLocalStore } from '../../lib/local/store';
import { useRefresh } from '../../lib/sync/useRefresh';
import { AppText, Avatar, Card, EmptyState, Pill, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { RealMenuButton } from '../../components/real/RealSideMenu';
import { SyncBanner } from '../../components/real/SyncBanner';
import { TodayClasses } from '../../components/real/ClassAttendance';

/**
 * Home of the real teacher app, read from the phone's copy: the account,
 * its teacher profile and its batches.
 */
export function TeacherHomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { session, profile, enterDemo } = useAuth();
  const teacher = useTeacherProfile();
  const batches = usePrivateBatches();
  const counts = useBatchCounts();
  const batchCount = batches.data.length;
  const { refreshing, refresh } = useRefresh();
  const syncing = useLocalStore((s) => s.syncing);
  const noCopy = useLocalStore((s) => s.ready && !s.account);

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
        <RealMenuButton />
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

      <Screen refreshing={refreshing} onRefresh={refresh}>
        <SyncBanner />

        {/* ── A new phone that hasn't reached the server yet ─────────────── */}
        {noCopy ? (
          syncing ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : (
            <EmptyState
              icon="cloud-download-outline"
              title="Connect to the internet once"
              message="Your batches and students download to this phone the first time. After that they open even without internet."
            />
          )
        ) : null}

        {/* ── Only when there's no teacher profile yet (batches need one) ── */}
        {!teacher.isLoading && !teacher.isError && !t ? (
          <Pressable
            onPress={() => navigation.navigate('TeacherProfileForm')}
            accessibilityRole="button"
            style={({ pressed }) => ({ marginBottom: spacing.xl, opacity: pressed ? 0.85 : 1 })}
          >
            <Card accentColor={colors.gold}>
              <Row gap={spacing.md}>
                <View style={[styles.ctaIcon, { backgroundColor: colors.primarySubtle }]}>
                  <Ionicons name="school-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="subheading">Create your teacher profile</AppText>
                  <AppText variant="caption" tone="muted">
                    Needed before you create batches.
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
              </Row>
            </Card>
          </Pressable>
        ) : null}

        {/* ── Today's classes: one tap to take attendance ──────────────── */}
        {t ? <TodayClasses /> : null}

        {/* ── Private batches ───────────────────────────────────────────── */}
        {t ? (
          <View style={{ marginBottom: spacing.xxl }}>
            <SectionHeader
              title="Private batches"
              subtitle={batchCount ? `${batchCount} batch${batchCount === 1 ? '' : 'es'}` : 'Your own tuition batches'}
              action={batchCount ? 'View all' : undefined}
              onAction={() => navigation.navigate('Batches')}
            />
            <Card>
              {batchCount ? (
                <View style={{ gap: spacing.sm }}>
                  {batches.data.slice(0, 3).map((b) => {
                    const pending = counts[b.id]?.pending ?? 0;
                    return (
                    <Pressable
                      key={b.id}
                      onPress={() => navigation.navigate('Batches', { screen: 'BatchDetail', params: { id: b.id }, initial: false })}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Row gap={spacing.md}>
                        <Ionicons name="people-outline" size={18} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <AppText variant="bodyStrong" numberOfLines={1}>
                            {b.name}
                          </AppText>
                          <AppText variant="caption" tone="muted" numberOfLines={1}>
                            {[b.subject, b.grade, b.board].filter(Boolean).join(' · ')}
                          </AppText>
                        </View>
                        {pending ? (
                          <Pill label={`${pending} request${pending === 1 ? '' : 's'}`} tone="gold" icon="person-add-outline" />
                        ) : (
                          <Pill label={b.join_code} tone="success" />
                        )}
                      </Row>
                    </Pressable>
                    );
                  })}
                </View>
              ) : (
                <AppText variant="caption" tone="muted">
                  Create a batch for each timing you teach. Students join with its code.
                </AppText>
              )}
              <Button
                label={batchCount ? 'Manage batches' : 'Create a batch'}
                iconName={batchCount ? 'arrow-forward' : 'add-circle-outline'}
                variant={batchCount ? 'secondary' : 'primary'}
                size="sm"
                fullWidth
                onPress={() => navigation.navigate('Batches', batchCount ? undefined : { screen: 'BatchForm', initial: false })}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          </View>
        ) : null}
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
