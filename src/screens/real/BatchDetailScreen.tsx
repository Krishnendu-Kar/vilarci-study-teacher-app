import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import {
  describeBatchError,
  describeMemberError,
  gradeBoardLabel,
  joinLinkFor,
  RosterRow,
  useBatchRoster,
  useDecideRequest,
  useDeleteBatch,
  usePrivateBatch,
  useRemoveMember,
} from '../../lib/api/privateBatches';
import { DAY_KEYS, DAY_LABELS, isClosed } from '../../lib/utils/schedule';
import { formatDateLong, rupees } from '../../lib/utils/format';
import { courseLabel } from '../../lib/utils/months';
import { AppText, Avatar, Card, Divider, EmptyState, HeroCard, KeyValue, Pill, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';

const RELATION_LABELS: Record<string, string> = {
  self: 'Self',
  father: 'Father',
  mother: 'Mother',
  friend: 'Friend',
  teacher: 'Teacher',
};

/** One private batch: join link, requests to approve, students, timetable. */
export function BatchDetailScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const id: string = useRoute<any>().params?.id;
  const toast = useToast();
  const { data: b, isLoading } = usePrivateBatch(id);
  const roster = useBatchRoster(id);
  const decide = useDecideRequest(id);
  const removeMember = useRemoveMember(id);
  const remove = useDeleteBatch();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

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

  const rows = roster.data ?? [];
  const requests = rows.filter((r) => r.status === 'pending');
  const members = rows.filter((r) => r.status === 'approved');
  const link = joinLinkFor(b.join_code);
  const level = gradeBoardLabel(b);

  const shareLink = () =>
    Share.share({
      message:
        `Join my ${b.subject} batch "${b.name}"${level ? ` (${level})` : ''} on Vilarci Study.\n\n` +
        `Tap to join: ${link}\nJoin code: ${b.join_code}`,
    }).catch(() => {});

  const onDecide = async (r: RosterRow, approve: boolean) => {
    try {
      await decide.mutateAsync({ id: r.id, approve });
      toast.toast(approve ? `${r.first_name} added to the batch` : `Request from ${r.first_name} declined`, approve ? 'success' : 'info');
    } catch (err) {
      toast.toast(describeMemberError(err), 'error');
    }
  };

  const onRemove = async (r: RosterRow) => {
    try {
      await removeMember.mutateAsync(r.id);
      setConfirmRemove(null);
      toast.toast(`${r.first_name} removed from the batch`, 'info');
    } catch (err) {
      toast.toast(describeMemberError(err), 'error');
    }
  };

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
      <Screen refreshing={roster.isRefetching} onRefresh={() => roster.refetch()}>
        {/* Join link */}
        <HeroCard>
          <AppText variant="overline" style={{ color: colors.goldBright }}>
            INVITE STUDENTS
          </AppText>
          <AppText style={styles.code}>{b.join_code}</AppText>
          <AppText variant="caption" numberOfLines={1} style={{ color: 'rgba(253,251,249,0.7)' }}>
            {link}
          </AppText>
          <AppText variant="caption" style={{ color: 'rgba(253,251,249,0.7)', marginTop: 4 }}>
            Students open the link in Vilarci Study and request to join. You approve each one.
          </AppText>
          <Pressable onPress={shareLink} accessibilityRole="button" style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="share-social-outline" size={16} color="#3B0A1A" />
            <AppText variant="captionStrong" style={{ color: '#3B0A1A' }}>
              Share join link
            </AppText>
          </Pressable>
        </HeroCard>

        {/* Requests */}
        {requests.length ? (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionHeader title="Join requests" subtitle={`${requests.length} waiting for you`} />
            <View style={{ gap: spacing.md }}>
              {requests.map((r) => (
                <Card key={r.id} accentColor={colors.gold}>
                  <StudentLine row={r} />
                  <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                    Requested by {r.account_name} · {formatDateLong(r.requested_at.slice(0, 10))}
                  </AppText>
                  <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
                    <Button label="Decline" variant="secondary" size="sm" onPress={() => onDecide(r, false)} style={{ flex: 1 }} fullWidth />
                    <Button label="Accept" iconName="checkmark" size="sm" loading={decide.isPending} onPress={() => onDecide(r, true)} style={{ flex: 1 }} fullWidth />
                  </Row>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        {/* Students */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Students" subtitle={`${members.length} of ${b.capacity} seats filled`} />
          {roster.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : members.length ? (
            <Card padded={false}>
              {members.map((r, i) => (
                <View key={r.id} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
                  {i > 0 ? <Divider style={{ marginBottom: spacing.md }} /> : null}
                  <Pressable
                    onPress={() => navigation.navigate('StudentFees', { batchId: b.id, membershipId: r.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.first_name}'s fees`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Row gap={spacing.sm}>
                      <View style={{ flex: 1 }}>
                        <StudentLine row={r} />
                      </View>
                      <Row gap={4}>
                        <Ionicons name="wallet-outline" size={15} color={colors.primary} />
                        <AppText variant="captionStrong" tone="primary">
                          Fees
                        </AppText>
                        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                      </Row>
                    </Row>
                  </Pressable>
                  <Row justify="space-between" style={{ marginTop: spacing.sm }}>
                    <AppText variant="caption" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                      {r.account_name}
                      {r.account_whatsapp ? ` · ${r.account_whatsapp}` : ''}
                    </AppText>
                    {confirmRemove === r.id ? (
                      <Row gap={spacing.sm}>
                        <Button label="Keep" variant="secondary" size="sm" onPress={() => setConfirmRemove(null)} />
                        <Button label="Remove" variant="danger" size="sm" onPress={() => onRemove(r)} />
                      </Row>
                    ) : (
                      <Pressable onPress={() => setConfirmRemove(r.id)} hitSlop={8} accessibilityRole="button">
                        <AppText variant="captionStrong" tone="error">
                          Remove
                        </AppText>
                      </Pressable>
                    )}
                  </Row>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState
              icon="people-outline"
              title="No students yet"
              message="Share the join link. Requests show up here for you to accept."
            />
          )}
        </View>

        {/* Overview */}
        <Card style={{ marginTop: spacing.xxl }}>
          <Row gap={5} wrap>
            <Pill label={b.subject} tone="primary" />
            {level ? <Pill label={level} /> : null}
          </Row>
          <Divider style={{ marginVertical: spacing.md }} />
          <KeyValue label="Monthly fee" value={`${rupees(b.monthly_fee)} / month`} />
          <KeyValue label="Course" value={courseLabel(b.course_start, b.course_end) ?? 'Not set — tap Edit'} />
          <KeyValue label="Seats" value={`${members.length} of ${b.capacity} filled`} />
          {b.room ? <KeyValue label="Room / venue" value={b.room} /> : null}
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

        {/* Delete */}
        <View style={{ marginTop: spacing.xxl }}>
          {confirmDelete ? (
            <View style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.errorBg }}>
              <AppText variant="subheading" style={{ color: colors.errorText }}>
                Delete “{b.name}”?
              </AppText>
              <AppText variant="caption" style={{ color: colors.errorText, marginTop: 2 }}>
                Students are removed and the join link stops working. This can’t be undone.
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

function StudentLine({ row: r }: { row: RosterRow }) {
  const name = [r.first_name, r.middle_name, r.last_name].filter((s) => s && s.trim()).join(' ');
  const initials = `${r.first_name[0] ?? ''}${r.last_name[0] ?? ''}`.toUpperCase() || '?';
  const relation = r.relation === 'other' ? r.relation_other ?? 'Other' : RELATION_LABELS[r.relation] ?? r.relation;
  return (
    <Row gap={spacing.md}>
      <Avatar initials={initials} gradient={['#1E5AA8', '#4F8FE0']} size={40} />
      <View style={{ flex: 1 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {[r.class_name, r.relation === 'self' ? 'Joined for self' : `Added by ${relation}`].filter(Boolean).join(' · ')}
        </AppText>
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  code: {
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 3,
    fontWeight: '800',
    color: '#FDFBF9',
    marginTop: 4,
    marginBottom: 2,
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
