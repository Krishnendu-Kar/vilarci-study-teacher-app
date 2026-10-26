import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { useAppStore } from '../../lib/store/useAppStore';
import { billingMonths, ledgerCell, LedgerState, monthFeeSummary, studentLedger } from '../../lib/api/selectors';
import type { Student } from '../../lib/data/types';
import { formatDate, monthKeyLabel, monthKeyShort, monthRange, rupees, shiftMonth, todayIso } from '../../lib/utils/format';
import { openWhatsApp } from '../../lib/utils/contact';
import { AppText, Avatar, Card, Chip, Divider, EmptyState, Pill, PillTone, Row, StatTile } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ChoiceChips } from '../../components/ui/ChoiceChips';
import { FormField } from '../../components/ui/Field';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import type { DeckViewProps } from '../DeckScreen';

const PAY_MODES = ['UPI (Google Pay)', 'UPI (PhonePe)', 'UPI (Paytm)', 'Cash / Offline Desk', 'Net Banking / IMPS', 'Bank Cheque'];

const STATE: Record<LedgerState, { label: string; tone: PillTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  pending: { label: 'Due', tone: 'warning' },
  overdue: { label: 'Overdue', tone: 'error' },
  not_billed: { label: 'Not enrolled', tone: 'neutral' },
};

/**
 * Personalised month-by-month tuition ledger. Vilarci is an academic record
 * keeper: it logs payments but never issues legal fee receipts.
 */
export function FeesView({ data }: DeckViewProps) {
  const { colors } = useTheme();
  const { deck, roster } = data;
  const current = todayIso().slice(0, 7);
  const months = useMemo(() => {
    const ms = billingMonths(roster);
    return ms.length ? ms : [current];
  }, [roster, current]);
  const [month, setMonth] = useState(months.includes(current) ? current : months[months.length - 1]);
  const [paying, setPaying] = useState<{ student: Student; month: string } | null>(null);
  const [ledgerFor, setLedgerFor] = useState<Student | null>(null);
  const [configFor, setConfigFor] = useState<Student | null>(null);

  const summary = monthFeeSummary(roster, month, current);
  const canEdit = deck.canManageFees;

  if (!roster.length) {
    return <EmptyState icon="card-outline" title="No students enrolled" message="Fee ledgers appear once students join." />;
  }

  return (
    <View>
      {!canEdit ? (
        <Card muted style={{ marginBottom: spacing.lg }}>
          <Row gap={spacing.sm}>
            <Ionicons name="lock-closed-outline" size={15} color={colors.textMuted} />
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              {deck.institute?.name ?? 'This institute'} manages fees centrally. You can view the ledger but not record
              payments.
            </AppText>
          </Row>
        </Card>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {months.map((m) => (
          <Chip key={m} label={m === current ? `${monthKeyShort(m)} · now` : monthKeyShort(m)} selected={m === month} onPress={() => setMonth(m)} />
        ))}
      </ScrollView>

      <Row gap={spacing.md} wrap style={{ marginTop: spacing.lg }}>
        <StatTile label="Collected" value={rupees(summary.collected)} sub={`${summary.paidCount} of ${summary.billed} settled`} tone="success" />
        <StatTile
          label="Pending"
          value={rupees(summary.pending)}
          sub={`${summary.billed - summary.paidCount} students`}
          tone={summary.pending ? 'error' : 'success'}
        />
      </Row>
      <Card style={{ marginTop: spacing.md }}>
        <Row justify="space-between">
          <AppText variant="captionStrong">{monthKeyLabel(month)}</AppText>
          <AppText variant="caption" tone="muted">
            {summary.rate.toFixed(0)}% of {rupees(summary.expected)} expected
          </AppText>
        </Row>
        <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
          <View style={{ width: `${Math.min(100, summary.rate)}%`, height: '100%', backgroundColor: colors.success, borderRadius: 4 }} />
        </View>
      </Card>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        {roster.map((s) => {
          const cell = ledgerCell(s, month, current);
          const st = STATE[cell.state];
          return (
            <Card key={s.id} padded={false}>
              <Row gap={spacing.md} style={{ padding: spacing.md }}>
                <Avatar initials={s.photo_initials} gradient={s.avatar_gradient} size={38} />
                <View style={{ flex: 1 }}>
                  <AppText variant="subheading" numberOfLines={1}>
                    {s.name}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {cell.state === 'paid' && cell.entry
                      ? `${formatDate(cell.entry.paid_date)} · ${cell.entry.payment_mode ?? ''}`
                      : `${rupees(s.custom_monthly_fee)}/mo · ${monthKeyShort(s.admission_start_month)} – ${monthKeyShort(s.course_end_month)}`}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {cell.state !== 'not_billed' ? <AppText variant="bodyStrong">{rupees(cell.amount)}</AppText> : null}
                  <Pill label={st.label} tone={st.tone} />
                </View>
              </Row>
              <Divider />
              <Row gap={spacing.xs} style={{ paddingHorizontal: spacing.sm, paddingVertical: 6 }}>
                {canEdit && (cell.state === 'pending' || cell.state === 'overdue') ? (
                  <Button label="Record paid" iconName="card-outline" size="sm" variant="ghost" onPress={() => setPaying({ student: s, month })} />
                ) : null}
                <Button label="Ledger" iconName="list-outline" size="sm" variant="ghost" onPress={() => setLedgerFor(s)} />
                {canEdit ? (
                  <Button label="Fee setup" iconName="options-outline" size="sm" variant="ghost" onPress={() => setConfigFor(s)} />
                ) : null}
                {cell.state === 'overdue' || cell.state === 'pending' ? (
                  <Pressable
                    hitSlop={8}
                    accessibilityLabel={`Remind ${s.father_name}`}
                    onPress={() =>
                      openWhatsApp(
                        s.father_phone,
                        `Dear ${s.father_name}, a gentle reminder that ${s.name}'s tuition fee of ₹${cell.amount.toLocaleString('en-IN')} for ${monthKeyLabel(month)} (${deck.title}) is due. Thank you.`,
                      )
                    }
                    style={{ marginLeft: 'auto', padding: 6 }}
                  >
                    <Ionicons name="logo-whatsapp" size={19} color={colors.success} />
                  </Pressable>
                ) : null}
              </Row>
            </Card>
          );
        })}
      </View>

      <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.lg }}>
        Vilarci keeps an academic fee ledger only — no legal receipts are generated.
      </AppText>

      <RecordPaymentSheet target={paying} onClose={() => setPaying(null)} />
      <LedgerSheet
        student={ledgerFor}
        canEdit={canEdit}
        onClose={() => setLedgerFor(null)}
        onPay={(student, m) => {
          setLedgerFor(null);
          setPaying({ student, month: m });
        }}
      />
      <ConfigureFeeSheet student={configFor} onClose={() => setConfigFor(null)} />
    </View>
  );
}

function RecordPaymentSheet({ target, onClose }: { target: { student: Student; month: string } | null; onClose: () => void }) {
  const recordPayment = useAppStore((s) => s.recordPayment);
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [mode, setMode] = useState(PAY_MODES[0]);
  const [ref, setRef] = useState('');
  const [lastKey, setLastKey] = useState('');

  // Prefill whenever a different student-month is opened.
  const key = target ? `${target.student.id}:${target.month}` : '';
  if (key && key !== lastKey) {
    setLastKey(key);
    setAmount(String(target!.student.fee_ledger[target!.month]?.amount ?? target!.student.custom_monthly_fee));
    setDate(todayIso());
    setRef('');
  }

  if (!target) return null;
  const amt = parseInt(amount, 10);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Record payment"
      subtitle={`${target.student.name} · ${monthKeyLabel(target.month)}`}
    >
      <View style={{ gap: spacing.lg }}>
        <Row gap={spacing.md} align="flex-start">
          <FormField
            label="Amount (₹)"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
          <FormField label="Paid on" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" containerStyle={{ flex: 1.3 }} />
        </Row>
        <ChoiceChips label="Mode" options={PAY_MODES.map((m) => ({ value: m, label: m }))} value={mode} onChange={setMode} />
        <FormField
          label="Transaction reference (optional)"
          placeholder="UPI ref / cheque no."
          value={ref}
          onChangeText={setRef}
          autoCapitalize="characters"
        />
        <Button
          label={`Mark ${monthKeyShort(target.month)} as paid`}
          iconName="checkmark-circle-outline"
          variant="success"
          fullWidth
          disabled={!(amt > 0) || !validDate}
          onPress={() => {
            recordPayment(target.student.id, target.month, {
              amount: amt,
              paid_date: date,
              payment_mode: mode,
              receipt_ref: ref.trim() || null,
            });
            toast(`Recorded ${rupees(amt)} from ${target.student.name} for ${monthKeyLabel(target.month)}`, 'success');
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

function LedgerSheet({
  student,
  canEdit,
  onClose,
  onPay,
}: {
  student: Student | null;
  canEdit: boolean;
  onClose: () => void;
  onPay: (student: Student, month: string) => void;
}) {
  if (!student) return null;
  const current = todayIso().slice(0, 7);
  const cells = studentLedger(student, current);
  const paid = cells.filter((c) => c.state === 'paid').reduce((s, c) => s + c.amount, 0);
  const due = cells.filter((c) => c.state === 'overdue' || (c.state === 'pending' && c.monthKey <= current));

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`${student.name} · fee ledger`}
      subtitle={`${monthKeyLabel(student.admission_start_month)} to ${monthKeyLabel(student.course_end_month)} · ${rupees(student.custom_monthly_fee)}/mo`}
    >
      <Row gap={spacing.md} wrap>
        <StatTile label="Paid to date" value={rupees(paid)} tone="success" />
        <StatTile label="Arrears" value={rupees(due.reduce((s, c) => s + c.amount, 0))} sub={`${due.length} months`} tone={due.length ? 'error' : 'success'} />
      </Row>
      <Card padded={false} style={{ marginTop: spacing.lg }}>
        {cells.map((c, idx) => (
          <View key={c.monthKey}>
            {idx > 0 ? <Divider inset={spacing.lg} /> : null}
            <Row gap={spacing.md} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
              <View style={{ flex: 1 }}>
                <AppText variant="subheading">{monthKeyLabel(c.monthKey)}</AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {c.state === 'paid' && c.entry
                    ? `${formatDate(c.entry.paid_date)} · ${c.entry.payment_mode ?? ''}${c.entry.receipt_ref ? ` · ${c.entry.receipt_ref}` : ''}`
                    : rupees(c.amount)}
                </AppText>
              </View>
              {canEdit && (c.state === 'pending' || c.state === 'overdue') ? (
                <Button label="Record" size="sm" variant="secondary" onPress={() => onPay(student, c.monthKey)} />
              ) : (
                <Pill label={STATE[c.state].label} tone={STATE[c.state].tone} />
              )}
            </Row>
          </View>
        ))}
      </Card>
    </Sheet>
  );
}

function ConfigureFeeSheet({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const configureStudentFee = useAppStore((s) => s.configureStudentFee);
  const { toast } = useToast();
  const [fee, setFee] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [lastId, setLastId] = useState('');

  if (student && student.id !== lastId) {
    setLastId(student.id);
    setFee(String(student.custom_monthly_fee));
    setStart(student.admission_start_month);
    setEnd(student.course_end_month);
  }
  if (!student) return null;

  const base = todayIso().slice(0, 7);
  const startOptions = monthRange(shiftMonth(base, -8), shiftMonth(base, 2));
  const endOptions = monthRange(shiftMonth(base, 1), shiftMonth(base, 12));
  const feeNum = parseInt(fee, 10);

  return (
    <Sheet visible onClose={onClose} title="Fee setup" subtitle={`${student.name} · ${student.roll}`}>
      <View style={{ gap: spacing.lg }}>
        <FormField
          label="Personalised monthly fee (₹)"
          value={fee}
          onChangeText={(t) => setFee(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          hint="Unpaid months follow the new amount; settled months keep what was paid."
        />
        <ChoiceChips
          label="Admission month"
          options={[...new Set([start, ...startOptions])].sort().map((m) => ({ value: m, label: monthKeyShort(m) }))}
          value={start}
          onChange={setStart}
        />
        <ChoiceChips
          label="Course ends"
          options={[...new Set([end, ...endOptions])].sort().map((m) => ({ value: m, label: monthKeyShort(m) }))}
          value={end}
          onChange={setEnd}
        />
        {end < start ? (
          <AppText variant="caption" tone="error">
            The course must end after admission.
          </AppText>
        ) : null}
        <Button
          label="Save fee setup"
          iconName="checkmark"
          fullWidth
          disabled={!(feeNum > 0) || end < start}
          onPress={() => {
            configureStudentFee(student.id, feeNum, start, end);
            toast(`${student.name}: ${rupees(feeNum)}/mo, ${monthKeyShort(start)} – ${monthKeyShort(end)}`, 'success');
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  track: { height: 7, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.sm },
});
