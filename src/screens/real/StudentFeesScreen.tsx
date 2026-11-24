import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import {
  describeMemberError,
  feeFor,
  studentName,
  useBatchRoster,
  usePrivateBatch,
  useSetStudentFee,
} from '../../lib/api/privateBatches';
import { useLocalStore } from '../../lib/local/store';
import { firstName } from '../../lib/utils/whatsapp';
import { useWhatsApp } from '../../components/real/WhatsApp';
import {
  buildLedger,
  describeFeeError,
  LedgerMonth,
  PAY_MODES,
  PayMode,
  setMonthFee,
  useEnrolmentMonths,
} from '../../lib/api/batchFees';
import { useRefresh } from '../../lib/sync/useRefresh';
import { courseLabel, monthLabel } from '../../lib/utils/months';
import { formatDate, formatDateLong, money, todayIso } from '../../lib/utils/format';
import { AppText, Card, Chip, EmptyState, HeroCard, Pill, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';

const STATE_TONE = { paid: 'success', waived: 'neutral', due: 'error', upcoming: 'neutral' } as const;
const STATE_LABEL = { paid: 'Paid', waived: 'Waived', due: 'Due', upcoming: 'Upcoming' } as const;

/** One student's month-by-month fee ledger for a batch (teacher records; works offline). */
export function StudentFeesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { batchId, enrolmentId } = useRoute<any>().params as { batchId: string; enrolmentId: string };
  const { data: batch } = usePrivateBatch(batchId);
  const { data: roster } = useBatchRoster(batchId);
  const months = useEnrolmentMonths(enrolmentId);
  const { refreshing, refresh } = useRefresh();
  const [open, setOpen] = useState<LedgerMonth | null>(null);
  const [feeOpen, setFeeOpen] = useState(false);
  const setFee = useSetStudentFee();
  const toast = useToast();
  const whatsApp = useWhatsApp();
  const me = useLocalStore((s) => s.account?.me);
  const teacherName = me ? [me.first_name, me.last_name].filter(Boolean).join(' ') : '';

  const member = roster.find((r) => r.id === enrolmentId);
  const name = member ? studentName(member) : 'Student';

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

  const monthly = member ? feeFor(member, batch) : batch.monthly_fee;
  const ownFee = member?.fee_override != null;
  const ledger = buildLedger(batch.course_start, batch.course_end, months, monthly);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title={`${name} · Fees`} />
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <SyncBanner />
        <HeroCard>
          <AppText variant="overline" style={{ color: colors.goldBright }}>
            {batch.name.toUpperCase()}
          </AppText>
          <AppText variant="caption" style={{ color: 'rgba(253,251,249,0.72)', marginTop: 2 }}>
            {courseLabel(batch.course_start, batch.course_end)} · {money(monthly)}/month
          </AppText>
          <Row style={{ marginTop: spacing.lg }} gap={spacing.lg}>
            <Stat value={money(ledger.paid)} label="COLLECTED" />
            <Stat value={money(ledger.dueAmount)} label={`DUE · ${ledger.dueMonths} MO`} warn={ledger.dueMonths > 0} />
            <Stat value={money(ledger.totalCourse)} label="COURSE" />
          </Row>
        </HeroCard>

        {/* ── This student's monthly fee ─────────────────────────────────── */}
        <Card style={{ marginTop: spacing.lg }}>
          <Row justify="space-between" gap={spacing.md}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" tone="muted">
                {ownFee ? 'Own monthly fee' : 'Monthly fee · same as the batch'}
              </AppText>
              <AppText variant="subheading">{money(monthly)} / month</AppText>
              {ownFee ? (
                <AppText variant="caption" tone="muted">
                  Batch fee {money(batch.monthly_fee)}
                </AppText>
              ) : null}
            </View>
            <Button label="Change" iconName="create-outline" size="sm" variant="secondary" onPress={() => setFeeOpen(true)} />
          </Row>
        </Card>

        {/* ── Due: a reminder on WhatsApp ────────────────────────────────── */}
        {ledger.dueMonths && member ? (
          <Button
            label={`Remind on WhatsApp · ${money(ledger.dueAmount)} due`}
            iconName="logo-whatsapp"
            variant="success"
            fullWidth
            onPress={() => {
              const due = ledger.months.filter((m) => m.state === 'due').map((m) => monthLabel(m.month));
              const first = member.student_card.first_name;
              whatsApp.send(
                member.contact,
                (c) =>
                  `Hello ${firstName(c)}, a gentle reminder${teacherName ? ` from ${teacherName}` : ''}: ` +
                  `${first}'s fee for ${batch.name} is due for ${due.join(', ')} (${money(ledger.dueAmount)} in all). ` +
                  'Please ignore this if it is already paid. Thank you!',
              );
            }}
            style={{ marginTop: spacing.md }}
          />
        ) : null}

        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          Tap a month to record a payment, waive it, or undo. Works without internet too.
        </AppText>
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
                {m.fee?.status === 'paid' ? (
                  <AppText variant="caption" tone="muted">
                    {money(m.fee.amount)}
                    {m.fee.mode ? ` · ${PAY_MODES.find((p) => p.value === m.fee!.mode)?.label}` : ''}
                    {m.fee.paid_on ? ` · ${formatDate(m.fee.paid_on)}` : ''}
                    {m.fee.note ? ` · ${m.fee.note}` : ''}
                  </AppText>
                ) : m.fee?.note ? (
                  <AppText variant="caption" tone="muted">
                    {m.fee.note}
                  </AppText>
                ) : null}
              </View>
              <Pill label={STATE_LABEL[m.state]} tone={STATE_TONE[m.state]} />
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>
      </Screen>

      {open ? (
        <MonthSheet
          key={open.month}
          month={open}
          batchId={batch.id}
          enrolmentId={enrolmentId}
          fee={monthly}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {feeOpen && member ? (
        <FeeSheet
          name={member.student_card.first_name}
          current={member.fee_override}
          batchFee={batch.monthly_fee}
          busy={setFee.isPending}
          onClose={() => setFeeOpen(false)}
          onSave={async (fee) => {
            try {
              await setFee.mutateAsync({ id: member.id, fee });
              setFeeOpen(false);
              toast.toast(fee == null ? 'Back to the batch fee' : `Fee set to ${money(fee)} a month`, 'success');
            } catch (err) {
              toast.toast(describeMemberError(err), 'error');
            }
          }}
        />
      ) : null}
      {whatsApp.sheet}
    </View>
  );
}

/** Set a student's own monthly fee (online), or go back to the batch fee. */
function FeeSheet({
  name,
  current,
  batchFee,
  busy,
  onClose,
  onSave,
}: {
  name: string;
  current: number | null;
  batchFee: number;
  busy: boolean;
  onClose: () => void;
  onSave: (fee: number | null) => void;
}) {
  // The form takes whole rupees; the server keeps paise.
  const [rupees, setRupees] = useState(String(Math.round((current ?? batchFee) / 100)));
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const n = Number(rupees);
    if (!rupees || !Number.isInteger(n) || n < 0 || n > 1_000_000) {
      setError('Enter the monthly fee in rupees (0 to 10,00,000).');
      return;
    }
    onSave(n * 100 === batchFee ? null : n * 100);
  };
  return (
    <Sheet visible onClose={onClose} title={`${name}'s monthly fee`} subtitle={`Batch fee ${money(batchFee)} a month`}>
      <FormField
        label="Monthly fee (₹)"
        keyboardType="number-pad"
        maxLength={7}
        value={rupees}
        onChangeText={(t) => {
          setRupees(t.replace(/\D/g, ''));
          if (error) setError(null);
        }}
        error={error}
        hint="For a sibling discount or scholarship. 0 = free."
      />
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
        Changes what’s due for every unpaid month. Paid months keep what was recorded. Needs the internet.
      </AppText>
      <Button label="Save fee" iconName="checkmark" fullWidth loading={busy} onPress={save} style={{ marginTop: spacing.lg }} />
      {current != null ? (
        <Button
          label={`Use the batch fee (${money(batchFee)})`}
          variant="ghost"
          iconName="arrow-undo-outline"
          fullWidth
          disabled={busy}
          onPress={() => onSave(null)}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}
    </Sheet>
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
  batchId,
  enrolmentId,
  fee,
  onClose,
}: {
  month: LedgerMonth;
  batchId: string;
  enrolmentId: string;
  /** This student's monthly fee, in paise. */
  fee: number;
  onClose: () => void;
}) {
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const saved = month.fee;
  const [mode, setMode] = useState<PayMode>(saved?.mode ?? 'upi');
  // The form takes whole rupees; the server keeps paise.
  const [amount, setAmount] = useState(String(Math.round((saved?.status === 'paid' ? saved.amount : fee) / 100)));
  const [note, setNote] = useState(saved?.note ?? '');
  // Paid-on date: the saved one when editing, otherwise today; never in the future.
  const [paidOn, setPaidOn] = useState(saved?.paid_on ?? todayIso());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayIso();

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.toast(done, 'success');
      onClose();
    } catch (err) {
      toast.toast(describeFeeError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const markPaid = () => {
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt < 0) {
      toast.toast('Enter the amount in rupees', 'error');
      return;
    }
    run(
      () =>
        setMonthFee(batchId, enrolmentId, month.month, {
          status: 'paid',
          amount: amt * 100,
          paid_on: paidOn,
          mode,
          note: note.trim() || null,
        }),
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

        <Button
          label={month.state === 'paid' ? 'Update payment' : 'Mark as paid'}
          iconName="checkmark-circle-outline"
          fullWidth
          loading={busy}
          disabled={busy}
          onPress={markPaid}
        />
        {month.state !== 'waived' ? (
          <Button
            label="Waive this month"
            variant="secondary"
            iconName="remove-circle-outline"
            fullWidth
            disabled={busy}
            onPress={() =>
              run(
                () =>
                  setMonthFee(batchId, enrolmentId, month.month, {
                    status: 'waived',
                    amount: 0,
                    note: note.trim() || null,
                  }),
                `${monthLabel(month.month)} waived`,
              )
            }
          />
        ) : null}
        {saved ? (
          <Button
            label={month.state === 'paid' ? 'Undo payment' : 'Undo waiver'}
            variant="ghost"
            iconName="arrow-undo-outline"
            fullWidth
            disabled={busy}
            onPress={() => run(() => setMonthFee(batchId, enrolmentId, month.month, null), `${monthLabel(month.month)} reset`)}
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
