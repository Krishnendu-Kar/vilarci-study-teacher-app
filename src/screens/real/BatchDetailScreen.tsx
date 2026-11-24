import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import {
  describeBatchError,
  describeMemberError,
  feeFor,
  gradeBoardLabel,
  joinLinkFor,
  RosterRow,
  studentName,
  useBatchRoster,
  useDecideRequest,
  useDeleteBatch,
  usePrivateBatch,
  useRemoveMember,
} from '../../lib/api/privateBatches';
import type { ContactCard } from '../../lib/local/types';
import { useRefresh } from '../../lib/sync/useRefresh';
import { formatDateLong, money, todayIso } from '../../lib/utils/format';
import { courseLabel, monthLabel } from '../../lib/utils/months';
import { monthOf } from '../../lib/utils/attendance';
import { AppText, Avatar, Card, Divider, EmptyState, HeroCard, IconName, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Screen } from '../../components/ui/Screen';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';
import { BatchAttendanceCard } from '../../components/real/ClassAttendance';
import { NoticeCard } from '../../components/real/NoticeParts';
import { useBatchNotices } from '../../lib/api/notices';

const RELATION_LABELS: Record<string, string> = {
  self: 'Self',
  father: 'Father',
  mother: 'Mother',
  friend: 'Friend',
  teacher: 'Teacher',
};

/** A millisecond time as "14 Oct 2026". */
const dayOf = (ms: number) => formatDateLong(todayIso(new Date(ms)));

/** One batch: today's attendance, requests to approve and students. Everything else is in the ⋮ menu. */
export function BatchDetailScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const id: string = useRoute<any>().params?.id;
  const toast = useToast();
  const { data: b, isLoading } = usePrivateBatch(id);
  const roster = useBatchRoster(id);
  const decide = useDecideRequest();
  const removeMember = useRemoveMember();
  const remove = useDeleteBatch();
  const notices = useBatchNotices(id);
  const { refreshing, refresh } = useRefresh();
  const [menu, setMenu] = useState(false);
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

  const rows = roster.data;
  const requests = rows.filter((r) => r.status === 'pending');
  const members = rows.filter((r) => r.status === 'approved');
  const level = gradeBoardLabel(b);
  const course = courseLabel(b.course_start, b.course_end);

  const shareLink = () =>
    Share.share({
      message:
        `Join my ${b.subject} batch "${b.name}"${level ? ` (${level})` : ''} on Vilarci Study.\n\n` +
        `Tap to join: ${joinLinkFor(b.join_code)}\nJoin code: ${b.join_code}`,
    }).catch(() => {});

  /** Close the menu, then go — after its slide-out, so two sheets never overlap (iOS refuses that). */
  const fromMenu = (go: () => void) => () => {
    setMenu(false);
    setTimeout(go, 300);
  };

  const onDecide = async (r: RosterRow, approve: boolean) => {
    const first = r.student_card.first_name;
    try {
      await decide.mutateAsync({ id: r.id, approve });
      toast.toast(approve ? `${first} added to the batch` : `Request from ${first} declined`, approve ? 'success' : 'info');
    } catch (err) {
      toast.toast(describeMemberError(err), 'error');
    }
  };

  const onRemove = async (r: RosterRow) => {
    try {
      await removeMember.mutateAsync(r.id);
      setConfirmRemove(null);
      toast.toast(`${r.student_card.first_name} removed from the batch`, 'info');
    } catch (err) {
      toast.toast(describeMemberError(err), 'error');
    }
  };

  const doDelete = async () => {
    setConfirmDelete(false);
    try {
      await remove.mutateAsync(b.id);
      toast.toast('Batch deleted — restore it from Private batches', 'info');
      navigation.goBack();
    } catch (err) {
      toast.toast(describeBatchError(err), 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar
        title={b.name}
        right={
          <Pressable
            onPress={() => setMenu(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Batch options"
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textMain} />
          </Pressable>
        }
      />
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <SyncBanner />

        {/* ── The batch at a glance ────────────────────────────────────── */}
        <HeroCard>
          <AppText variant="overline" style={{ color: colors.goldBright }} numberOfLines={1}>
            {[b.subject, level].filter(Boolean).join(' · ').toUpperCase()}
          </AppText>
          <AppText variant="display" numberOfLines={2} style={{ color: '#FDFBF9', marginTop: 2 }}>
            {b.name}
          </AppText>
          <View style={{ marginTop: spacing.md, gap: 6 }}>
            <HeroLine icon="people-outline" text={`${members.length} of ${b.capacity} students${requests.length ? ` · ${requests.length} waiting` : ''}`} />
            {course ? <HeroLine icon="calendar-outline" text={course} /> : null}
            {b.room ? <HeroLine icon="location-outline" text={b.room} /> : null}
            <HeroLine icon="key-outline" text={`Join code ${b.join_code}`} />
          </View>
          <Pressable
            onPress={() => navigation.navigate('BatchInvite', { id: b.id })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.heroBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="person-add-outline" size={16} color="#3B0A1A" />
            <AppText variant="captionStrong" style={{ color: '#3B0A1A' }}>
              Add students
            </AppText>
          </Pressable>
        </HeroCard>

        {/* ── Attendance: today's class and the register ───────────────── */}
        <BatchAttendanceCard batch={b} />

        {/* ── Notices: the latest two, the rest one tap away ───────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader
            title="Notices"
            subtitle={notices.length ? `${notices.length} for parents` : undefined}
            action={notices.length ? 'All' : undefined}
            onAction={() => navigation.navigate('BatchNotices', { id: b.id })}
          />
          {notices.length ? (
            <View style={{ gap: spacing.md }}>
              {notices.slice(0, 2).map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => navigation.navigate('BatchNotices', { id: b.id })}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <NoticeCard notice={n} lines={3} />
                </Pressable>
              ))}
              <Button
                label="Post a notice"
                iconName="send-outline"
                variant="secondary"
                size="sm"
                onPress={() => navigation.navigate('BatchNotices', { id: b.id, compose: true })}
                style={{ alignSelf: 'flex-start' }}
              />
            </View>
          ) : (
            <Card muted>
              <AppText variant="caption" tone="muted">
                Tell every parent about holidays, test dates and reminders in one go.
              </AppText>
              <Button
                label="Post a notice"
                iconName="send-outline"
                size="sm"
                onPress={() => navigation.navigate('BatchNotices', { id: b.id, compose: true })}
                style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              />
            </Card>
          )}
        </View>

        {/* ── Requests ─────────────────────────────────────────────────── */}
        {requests.length ? (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionHeader title="Join requests" subtitle={`${requests.length} waiting for you`} />
            <View style={{ gap: spacing.md }}>
              {requests.map((r) => (
                <Card key={r.id} accentColor={colors.gold}>
                  <StudentLine row={r} />
                  <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                    Requested on {dayOf(r.requested_at)}
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

        {/* ── Students ─────────────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader
            title="Students"
            subtitle={`${members.length} of ${b.capacity} seats filled`}
            action="Add"
            onAction={() => navigation.navigate('BatchInvite', { id: b.id })}
          />
          {roster.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : members.length ? (
            <Card padded={false}>
              {members.map((r, i) => (
                <View key={r.id} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
                  {i > 0 ? <Divider style={{ marginBottom: spacing.md }} /> : null}
                  <Pressable
                    onPress={() => navigation.navigate('StudentFees', { batchId: b.id, enrolmentId: r.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.student_card.first_name}'s fees`}
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
                      {contactLine(r.contact)}
                      {r.fee_override != null ? ` · ${money(feeFor(r, b))}/month` : ''}
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
            <>
              <EmptyState
                icon="people-outline"
                title="No students yet"
                message="Show them the QR or share the join link. Requests show up here for you to accept."
              />
              <Button
                label="Add students"
                iconName="person-add-outline"
                fullWidth
                onPress={() => navigation.navigate('BatchInvite', { id: b.id })}
                style={{ marginTop: spacing.md }}
              />
            </>
          )}
        </View>
      </Screen>

      {/* ── ⋮ menu ─────────────────────────────────────────────────────── */}
      <Sheet visible={menu} onClose={() => setMenu(false)} title={b.name} subtitle={[b.subject, level].filter(Boolean).join(' · ')}>
        <View style={{ paddingBottom: spacing.md }}>
          <MenuRow
            icon="person-add-outline"
            title="Add students"
            subtitle="QR code, join link and code"
            onPress={fromMenu(() => navigation.navigate('BatchInvite', { id: b.id }))}
          />
          <MenuRow
            icon="megaphone-outline"
            title="Post a notice"
            subtitle="Every parent in the batch sees it"
            onPress={fromMenu(() => navigation.navigate('BatchNotices', { id: b.id, compose: true }))}
          />
          <MenuRow
            icon="create-outline"
            title="Edit batch"
            subtitle="Name, timetable, fee, seats, course"
            onPress={fromMenu(() => navigation.navigate('BatchForm', { id: b.id }))}
          />
          <MenuRow
            icon="information-circle-outline"
            title="Batch info"
            subtitle="Everything set on this batch"
            onPress={fromMenu(() => navigation.navigate('BatchInfo', { id: b.id }))}
          />
          <MenuRow
            icon="calendar-outline"
            title="Attendance register"
            subtitle="Month view of classes and students"
            onPress={fromMenu(() => navigation.navigate('AttendanceRegister', { batchId: b.id, month: monthOf(todayIso()) }))}
          />
          <MenuRow icon="share-social-outline" title="Share join link" onPress={fromMenu(shareLink)} />
          <Divider style={{ marginVertical: spacing.sm }} />
          <MenuRow
            icon="trash-outline"
            title="Delete batch"
            subtitle="Students stop seeing it · needs the internet"
            danger
            onPress={fromMenu(() => setConfirmDelete(true))}
          />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={confirmDelete}
        title={`Delete “${b.name}”?`}
        message="Students stop seeing it and the join link stops working. You can restore it later from Private batches — students, attendance and fees come back with it. Needs the internet."
        confirmLabel="Delete batch"
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  danger,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tint = danger ? colors.error : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.menuRow, { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' }]}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? colors.errorBg : colors.primarySubtle }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" style={{ color: danger ? colors.error : colors.textMain }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {danger ? null : <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </Pressable>
  );
}

function HeroLine({ icon, text }: { icon: IconName; text: string }) {
  return (
    <Row gap={6}>
      <Ionicons name={icon} size={14} color="rgba(253,251,249,0.7)" />
      <AppText variant="caption" numberOfLines={1} style={{ color: 'rgba(253,251,249,0.85)', flex: 1 }}>
        {text}
      </AppText>
    </Row>
  );
}

function StudentLine({ row: r }: { row: RosterRow }) {
  const c = r.student_card;
  const initials = `${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`.toUpperCase() || '?';
  return (
    <Row gap={spacing.md}>
      <Avatar initials={initials} gradient={['#1E5AA8', '#4F8FE0']} size={40} />
      <View style={{ flex: 1 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {studentName(r)}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {[c.class_name, c.board, r.joined_month && r.status === 'approved' ? `Since ${monthLabel(r.joined_month)}` : null]
            .filter(Boolean)
            .join(' · ') || 'Student'}
        </AppText>
      </View>
    </Row>
  );
}

/** "Father · Ravi Sen · +91 98…" for the first guardian, "+1" for more. */
function contactLine(contact: ContactCard[] | null): string {
  const first = contact?.[0];
  if (!first) return 'No contact shared';
  const relation = first.relation === 'other' ? first.relation_other ?? 'Guardian' : RELATION_LABELS[first.relation] ?? first.relation;
  const more = contact!.length > 1 ? ` +${contact!.length - 1}` : '';
  return [relation, first.name, first.whatsapp].filter(Boolean).join(' · ') + more;
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroBtn: {
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
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  menuIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
