import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { describeBatchError, useDeleteBatch, usePrivateBatch } from '../../lib/api/privateBatches';
import { DAY_KEYS, DAY_LABELS, isClosed } from '../../lib/utils/schedule';
import { formatDateLong, rupees } from '../../lib/utils/format';
import { AppText, Card, Divider, EmptyState, HeroCard, KeyValue, Pill, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';

/** One private batch: join code to share, timetable, fee, seats; edit / delete. */
export function BatchDetailScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const id: string = useRoute<any>().params?.id;
  const toast = useToast();
  const { data: b, isLoading } = usePrivateBatch(id);
  const remove = useDeleteBatch();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Batch" />
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      </View>
    );
  }
  if (!b) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Batch" />
        <Screen>
          <EmptyState icon="alert-circle-outline" title="Batch not found" message="It may have been deleted." />
        </Screen>
      </View>
    );
  }

  const shareCode = () =>
    Share.share({
      message: `Join my ${b.subject} batch "${b.name}" (${b.grade}, ${b.board}) on Vilarci Study.\n\nJoin code: ${b.join_code}`,
    }).catch(() => {});

  const doDelete = async () => {
    try {
      await remove.mutateAsync(b.id);
      toast.toast('Batch deleted', 'info');
      navigation.goBack();
    } catch (err) {
      toast.toast(describeBatchError(err), 'error');
      setConfirmDelete(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar
        title={b.name}
        right={<Button label="Edit" iconName="create-outline" size="sm" variant="secondary" onPress={() => navigation.navigate('BatchForm', { id: b.id })} />}
      />
      <Screen>
        {/* Join code */}
        <HeroCard>
          <AppText variant="overline" style={{ color: colors.goldBright }}>
            JOIN CODE
          </AppText>
          <AppText style={styles.code}>{b.join_code}</AppText>
          <AppText variant="caption" style={{ color: 'rgba(253,251,249,0.7)' }}>
            Students enter this code in Vilarci Study to join the batch.
          </AppText>
          <Pressable
            onPress={shareCode}
            accessibilityRole="button"
            style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="share-social-outline" size={16} color="#3B0A1A" />
            <AppText variant="captionStrong" style={{ color: '#3B0A1A' }}>
              Share code
            </AppText>
          </Pressable>
        </HeroCard>

        {/* Overview */}
        <Card style={{ marginTop: spacing.lg }}>
          <Row gap={5} wrap>
            <Pill label={`${b.grade} · ${b.board}`} tone="primary" />
            <Pill label={b.subject} />
          </Row>
          <Divider style={{ marginVertical: spacing.md }} />
          <KeyValue label="Monthly fee" value={`${rupees(b.monthly_fee)} / month`} />
          <KeyValue label="Seats" value={`0 of ${b.capacity} filled`} />
          <KeyValue label="Room / venue" value={b.room || '—'} />
          <KeyValue label="Created" value={formatDateLong(b.created_at.slice(0, 10))} />
        </Card>

        {/* Timetable */}
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

        {/* Students — enrolment arrives with join-by-code */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Students" subtitle={`0 of ${b.capacity}`} />
          <EmptyState
            icon="people-outline"
            title="No students yet"
            message="Share the join code. Students who join from Vilarci Study will appear here."
          />
        </View>

        {/* Delete */}
        <View style={{ marginTop: spacing.xxl }}>
          {confirmDelete ? (
            <View style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.errorBg }}>
              <AppText variant="subheading" style={{ color: colors.errorText }}>
                Delete “{b.name}”?
              </AppText>
              <AppText variant="caption" style={{ color: colors.errorText, marginTop: 2 }}>
                The join code stops working. This can’t be undone.
              </AppText>
              <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
                <Button label="Cancel" variant="secondary" size="sm" onPress={() => setConfirmDelete(false)} />
                <Button label="Delete batch" variant="danger" size="sm" iconName="trash-outline" loading={remove.isPending} onPress={doDelete} />
              </Row>
            </View>
          ) : (
            <Button label="Delete this batch" variant="ghost" iconName="trash-outline" fullWidth onPress={() => setConfirmDelete(true)} />
          )}
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  code: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 3,
    fontWeight: '800',
    color: '#FDFBF9',
    marginTop: 4,
    marginBottom: 4,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.lg,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#E0B23C',
  },
});
