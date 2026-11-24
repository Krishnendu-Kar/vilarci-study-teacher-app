import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { feeFor, gradeBoardLabel, useBatchRoster, usePrivateBatch } from '../../lib/api/privateBatches';
import { DAY_KEYS, DAY_LABELS, isClosed } from '../../lib/utils/schedule';
import { formatDateLong, money, todayIso } from '../../lib/utils/format';
import { courseLabel } from '../../lib/utils/months';
import { AppText, Card, Divider, EmptyState, KeyValue, Pill, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { RealTopBar } from '../../components/real/RealTopBar';

/** Everything set on a batch: subject, fee, course, seats, venue, code and the weekly timetable. */
export function BatchInfoScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const id: string = useRoute<any>().params?.id;
  const { data: b, isLoading } = usePrivateBatch(id);
  const { data: roster } = useBatchRoster(id);

  if (isLoading || !b) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Batch info" />
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <Screen>
            <EmptyState icon="alert-circle-outline" title="Batch not found" message="It may have been deleted." />
          </Screen>
        )}
      </View>
    );
  }

  const level = gradeBoardLabel(b);
  const members = roster.filter((r) => r.status === 'approved');
  const waiting = roster.filter((r) => r.status === 'pending').length;
  const ownFee = members.filter((r) => feeFor(r, b) !== b.monthly_fee).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar
        title="Batch info"
        right={<Button label="Edit" iconName="create-outline" size="sm" variant="secondary" onPress={() => navigation.navigate('BatchForm', { id: b.id })} />}
      />
      <Screen>
        <AppText variant="title">{b.name}</AppText>
        <Row gap={5} wrap style={{ marginTop: spacing.sm }}>
          <Pill label={b.subject} tone="primary" />
          {level ? <Pill label={level} /> : null}
        </Row>

        <Card style={{ marginTop: spacing.lg }}>
          <KeyValue label="Monthly fee" value={`${money(b.monthly_fee)} / month`} />
          {ownFee ? <KeyValue label="Own fee" value={`${ownFee} student${ownFee === 1 ? '' : 's'}`} /> : null}
          <KeyValue label="Course" value={courseLabel(b.course_start, b.course_end) ?? 'Not set — tap Edit'} />
          <Divider style={{ marginVertical: spacing.sm }} />
          <KeyValue label="Seats" value={`${members.length} of ${b.capacity} filled`} />
          {waiting ? <KeyValue label="Requests waiting" value={String(waiting)} /> : null}
          <KeyValue label="Room / venue" value={b.room || '—'} />
          <KeyValue label="Join code" value={b.join_code} />
          <KeyValue label="Created" value={formatDateLong(todayIso(new Date(b.created_at)))} />
        </Card>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Weekly timetable" />
          <Card padded={false}>
            {DAY_KEYS.map((d, i) => {
              const v = b.weekly_schedule[d];
              const open = !isClosed(v);
              return (
                <View key={d}>
                  {i > 0 ? <Divider inset={spacing.lg} /> : null}
                  <Row justify="space-between" style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
                    <AppText variant="subheading" style={{ color: open ? colors.textMain : colors.textMuted }}>
                      {DAY_LABELS[d]}
                    </AppText>
                    <AppText variant={open ? 'bodyStrong' : 'caption'} style={{ color: open ? colors.primary : colors.textMuted }}>
                      {open ? v.replace(/\s*-\s*/, ' – ') : 'No class'}
                    </AppText>
                  </Row>
                </View>
              );
            })}
          </Card>
        </View>
      </Screen>
    </View>
  );
}
