import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { useBatchRoster, usePrivateBatch } from '../../lib/api/privateBatches';
import {
  buildLedger,
  describeFeeError,
  LedgerMonth,
  PAY_MODES,
  PayMode,
  useMemberFees,
  useRecordFee,
  useUndoFee,
} from '../../lib/api/batchFees';
import { courseLabel, monthLabel } from '../../lib/utils/months';
import { formatDate, formatDateLong, rupees, todayIso } from '../../lib/utils/format';
import { AppText, Card, Chip, EmptyState, HeroCard, Pill, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';

const STATE_TONE = { paid: 'success', waived: 'neutral', due: 'error', upcoming: 'neutral' } as const;
const STATE_LABEL = { paid: 'Paid', waived: 'Waived', due: 'Due', upcoming: 'Upcoming' } as const;

/** One student's month-by-month fee ledger for a batch (teacher records). */
export function StudentFeesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { batchId, membershipId } = useRoute<any>().params as { batchId: string; membershipId: string };
  const { data: batch } = usePrivateBatch(batchId);
  const { data: roster = [] } = useBatchRoster(batchId);
  const fees = useMemberFees(membershipId);
  const [open, setOpen] = useState<LedgerMonth | null>(null);

  const member = roster.find((r) => r.id === membershipId);
  const name = member ? [member.first_name, member.last_name].filter(Boolean).join(' ') : 'Student';

  if (!batch) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Fees" />
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      </View>
    );
  }

  if (!batch.course_start || !batch.course_end) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title={`${name} · Fees`} />
        <Screen>
          <EmptyState
            icon="calendar-outline"
            title="Set the course duration first"
            message="The fee ledger runs month by month from the course's start to its end."
          />
          <Button
            label="Edit batch"
            iconName="create-outline"
            fullWidth
            onPress={() => navigation.navigate('BatchForm', { id: batch.id })}
            style={{ marginTop: spacing.md }}
          />
        </Screen>
      </View>
    );
  }

  const ledger = buildLedger(batch.course_start, batch.course_end, fees.data ?? [], batch.monthly_fee);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title={`${name} · Fees`} />
      <Screen refreshing={fees.isRefetching} onRefresh={() => fees.refetch()}>
        <HeroCard>
          <AppText variant="overline" style={{ color: colors.goldBright }}>
            {batch.name.toUpperCase()}
          </AppText>
          <AppText variant="caption" style={{ color: 'rgba(253,251,249,0.72)', marginTop: 2 }}>
            {courseLabel(batch.course_start, batch.course_end)} · {rupees(batch.monthly_fee)}/month
          </AppText>
          <Row style={{ marginTop: spacing.lg }} gap={spacing.lg}>
            <Stat value={rupees(ledger.paid)} label="COLLECTED" />
            <Stat value={rupees(ledger.dueAmount)} label={`DUE · ${ledger.dueMonths} MO`} warn={ledger.dueMonths > 0} />
            <Stat value={rupees(ledger.totalCourse)} label="COURSE" />
          </Row>
        </HeroCard>

        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          Tap a month to record a payment, waive it, or undo.
        </AppText>
        {fees.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Card padded={false}>
            {ledger.months.map((m, i) => (
              <Pressable
                key={m.month}
                onPress={() => setOpen(m)}
                accessibilityRole="button"
                accessibilityLabel={`${monthLabel(m.month)}, ${STATE_LABEL[m.state]}`}
                style={({ pressed }) => [
                  styles.row,
                  { borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="subheading">{monthLabel(m.month)}</AppText>
                  {m.row?.status === 'paid' ? (
                    <AppText variant="caption" tone="muted">
                      {rupees(m.row.amount)}
                      {m.row.mode ? ` · ${PAY_MODES.find((p) => p.value === m.row!.mode)?.label}` : ''}
                      {m.row.paid_on ? ` · ${formatDate(m.row.paid_on)}` : ''}
                      {m.row.note ? ` · ${m.row.note}` : ''}
                    </AppText>
                  ) : m.row?.note ? (
                    <AppText variant="caption" tone="muted">
                      {m.row.note}
                    </AppText>
                  ) : null}
                </View>
                <Pill label={STATE_LABEL[m.state]} tone={STATE_TONE[m.state]} />
                <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
              </Pressable>
            ))}
          </Card>
        )}
      </Screen>

      {open ? (
        <MonthSheet
          key={open.month}
          month={open}
          membershipId={membershipId}
          fee={batch.monthly_fee}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </View>
  );
}

function Stat({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="metricSm" numberOfLines={1} style={{ color: warn ? '#FFD7D2' : '#FDFBF9' }}>
        {value}
      </AppText>
      <AppText variant="overline" style={{ color: colors.goldBright, marginTop: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

/** "2026-10-27" → local Date (no UTC shift). */
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function MonthSheet({
  month,
  membershipId,
  fee,
  onClose,
}: {
  month: LedgerMonth;
  membershipId: string;
  fee: number;
  onClose: () => void;
}) {
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const record = useRecordFee(membershipId);
  const undo = useUndoFee(membershipId);
  const [mode, setMode] = useState<PayMode>(month.row?.mode ?? 'upi');
  const [amount, setAmount] = useState(String(month.row?.status === 'paid' ? month.row.amount : fee));
  const [note, setNote] = useState(month.row?.note ?? '');
  // Paid-on date: the saved one when editing, otherwise today; never in the future.
  const [paidOn, setPaidOn] = useState(month.row?.paid_on ?? todayIso());
  const [pickerOpen, setPickerOpen] = useState(false);
  const busy = record.isPending || undo.isPending;
  const today = todayIso();

  const run = async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      toast.toast(done, 'success');
      onClose();
    } catch (err) {
      toast.toast(describeFeeError(err), 'error');
    }
  };

  const markPaid = () => {
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt < 0) {
      toast.toast('Enter the amount in rupees', 'error');
      return;
    }
    run(
      () => record.mutateAsync({ month: month.month, status: 'paid', amount: amt, paid_on: paidOn, mode, note: note.trim() }),
      `${monthLabel(month.month)} marked paid`,
    );
  };

  return (
    <Sheet visible onClose={onClose} title={monthLabel(month.month)} subtitle={`Currently: ${STATE_LABEL[month.state]}`}>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
        <View style={{ gap: 6 }}>
          <AppText variant="overline" tone="muted">
            PAID BY
          </AppText>
          <Row gap={spacing.sm} wrap>
            {PAY_MODES.map((m) => (
              <Chip key={m.value} label={m.label} selected={mode === m.value} onPress={() => setMode(m.value)} />
            ))}
          </Row>
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="overline" tone="muted">
            PAID ON
          </AppText>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Paid on ${formatDateLong(paidOn)}. Change date`}
            style={({ pressed }) => [styles.dateField, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="calendar-outline" size={17} color={colors.primary} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {formatDateLong(paidOn)}
            </AppText>
            {paidOn === today ? <Pill label="Today" tone="primary" /> : null}
            <Ionicons name="chevron-down" size={15} color={colors.textMuted} />
          </Pressable>
          {pickerOpen ? (
            <DateTimePicker
              value={isoToDate(paidOn)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={isoToDate(today)}
              themeVariant={isDark ? 'dark' : 'light'}
              onValueChange={(_, d) => {
                setPaidOn(todayIso(d));
                if (Platform.OS === 'android') setPickerOpen(false);
              }}
              onDismiss={() => setPickerOpen(false)}
            />
          ) : null}
          {pickerOpen && Platform.OS === 'ios' ? (
            <Button label="Done" size="sm" variant="secondary" onPress={() => setPickerOpen(false)} />
          ) : null}
        </View>
        <FormField
          label="Amount (₹)"
          keyboardType="number-pad"
          maxLength={7}
          value={amount}
          onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
        />
        <FormField label="Note (optional)" placeholder="e.g. paid with Oct" maxLength={120} value={note} onChangeText={setNote} />

        <Button label={month.state === 'paid' ? 'Update payment' : 'Mark as paid'} iconName="checkmark-circle-outline" fullWidth loading={record.isPending} disabled={busy} onPress={markPaid} />
        {month.state !== 'waived' ? (
          <Button
            label="Waive this month"
            variant="secondary"
            iconName="remove-circle-outline"
            fullWidth
            disabled={busy}
            onPress={() =>
              run(
                () => record.mutateAsync({ month: month.month, status: 'waived', amount: 0, paid_on: null, mode: null, note: note.trim() }),
                `${monthLabel(month.month)} waived`,
              )
            }
          />
        ) : null}
        {month.row ? (
          <Button
            label={month.state === 'paid' ? 'Undo payment' : 'Undo waiver'}
            variant="ghost"
            iconName="arrow-undo-outline"
            fullWidth
            disabled={busy}
            onPress={() => run(() => undo.mutateAsync(month.month), `${monthLabel(month.month)} reset`)}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
