import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { BATCH_LIMITS, gradeBoardLabel, PrivateBatchRow, useBatchCounts, usePrivateBatches } from '../../lib/api/privateBatches';
import { useTeacherProfile } from '../../lib/api/teacherProfile';
import { useRefresh } from '../../lib/sync/useRefresh';
import { summarizeSchedule } from '../../lib/utils/schedule';
import { money } from '../../lib/utils/format';
import { AppText, Card, EmptyState, Pill, PressableCard, ProgressBar, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';

/** The teacher's batches from the phone's copy, newest first. */
export function BatchesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const teacher = useTeacherProfile();
  const batches = usePrivateBatches();
  const counts = useBatchCounts();
  const { refreshing, refresh } = useRefresh();
  const list = batches.data;
  const atLimit = list.length >= BATCH_LIMITS.perTeacher;

  const newBatchButton = teacher.data && list.length > 0 && !atLimit ? (
    <Button label="New" iconName="add" size="sm" onPress={() => navigation.navigate('BatchForm')} />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title="Private batches" right={newBatchButton} />
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <SyncBanner />
        {teacher.isLoading || batches.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : !teacher.data ? (
          <Card>
            <AppText variant="subheading">Create your teacher profile first</AppText>
            <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
              Batches belong to your teacher profile — your subject and qualification are shown to students who join.
            </AppText>
            <Button
              label="Create teacher profile"
              iconName="school-outline"
              fullWidth
              onPress={() => navigation.navigate('Home', { screen: 'TeacherProfileForm' })}
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        ) : list.length === 0 ? (
          <View>
            <EmptyState
              icon="people-outline"
              title="No private batches yet"
              message="Create one batch per timing — morning, evening or weekend — for any class you teach. Each gets a join code to share with students."
            />
            <Button
              label="Create your first batch"
              iconName="add-circle-outline"
              fullWidth
              onPress={() => navigation.navigate('BatchForm')}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <AppText variant="caption" tone="muted">
              {list.length} batch{list.length === 1 ? '' : 'es'}
              {atLimit ? ` · limit of ${BATCH_LIMITS.perTeacher} reached` : ''}
            </AppText>
            {list.map((b) => (
              <BatchCard
                key={b.id}
                batch={b}
                approved={counts[b.id]?.approved ?? 0}
                pending={counts[b.id]?.pending ?? 0}
                onPress={() => navigation.navigate('BatchDetail', { id: b.id })}
              />
            ))}
          </View>
        )}
      </Screen>
    </View>
  );
}

export function BatchCard({
  batch: b,
  approved,
  pending,
  onPress,
}: {
  batch: PrivateBatchRow;
  approved: number;
  pending: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const enrolled = approved;
  const level = gradeBoardLabel(b);
  const fill = b.capacity ? (enrolled / b.capacity) * 100 : 0;
  return (
    <PressableCard level={1} onPress={onPress}>
      <Row justify="space-between" align="flex-start" gap={spacing.md}>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{b.name}</AppText>
          <Row gap={5} wrap style={{ marginTop: 6 }}>
            <Pill label={b.subject} tone="primary" />
            {level ? <Pill label={level} /> : null}
            {pending ? <Pill label={`${pending} request${pending === 1 ? '' : 's'}`} tone="gold" icon="person-add-outline" /> : null}
          </Row>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Row>

      <View style={{ marginTop: spacing.md, gap: 4 }}>
        <Row gap={6}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <AppText variant="caption" tone="secondary" style={{ flex: 1 }} numberOfLines={2}>
            {summarizeSchedule(b.weekly_schedule)}
          </AppText>
        </Row>
        {b.room ? (
          <Row gap={6}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {b.room}
            </AppText>
          </Row>
        ) : null}
      </View>

      <View style={{ marginTop: spacing.md }}>
        <Row justify="space-between" style={{ marginBottom: 5 }}>
          <AppText variant="caption" tone="muted">
            Enrolled
          </AppText>
          <AppText variant="captionStrong">
            {enrolled} of {b.capacity} seats
          </AppText>
        </Row>
        <ProgressBar value={fill} color={fill >= 90 ? colors.gold : colors.primary} />
      </View>

      <Row justify="space-between" style={{ marginTop: spacing.md }}>
        <AppText variant="bodyStrong">
          {money(b.monthly_fee)}
          <AppText variant="caption" tone="muted">
            {' '}
            / month
          </AppText>
        </AppText>
        <Pill label={b.join_code} tone="success" icon="key-outline" />
      </Row>
    </PressableCard>
  );
}
