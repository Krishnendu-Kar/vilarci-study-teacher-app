import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { nextRollNumber, useAppStore } from '../../lib/store/useAppStore';
import { useDb } from '../../lib/api/hooks';
import { ledgerCell } from '../../lib/api/selectors';
import type { Student } from '../../lib/data/types';
import { todayIso } from '../../lib/utils/format';
import { callPhone, openWhatsApp, shareOnWhatsApp, shareText } from '../../lib/utils/contact';
import {
  AppText,
  Avatar,
  Card,
  Divider,
  EmptyState,
  IconName,
  KeyValue,
  Pill,
  Row,
  StatTile,
  VerifiedTick,
} from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ChoiceChips } from '../../components/ui/ChoiceChips';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Field, FormField } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { Streak } from '../../components/Marks';
import { weekdayDate } from '../../components/ClassDate';
import { HW_STATUS } from './HomeworkView';
import type { DeckViewProps } from '../DeckScreen';

/** Students roster: who is enrolled, their standing, and their families. */
export function StudentsView({ data, goTo }: DeckViewProps) {
  const { colors } = useTheme();
  const { deck, roster, rateOf } = data;
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const month = todayIso().slice(0, 7);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((s) => s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q));
  }, [roster, query]);

  const avgRate = roster.length ? roster.reduce((sum, s) => sum + rateOf(s.id), 0) / roster.length : 0;
  const unpaid = roster.filter((s) => {
    const c = ledgerCell(s, month, month);
    return c.state === 'pending' || c.state === 'overdue';
  }).length;
  const open = roster.find((s) => s.id === openId) ?? null;

  return (
    <View>
      <Row gap={spacing.md} wrap>
        <StatTile label="Enrolled" value={`${roster.length}`} sub={`of ${deck.capacity} seats`} tone="primary" />
        <StatTile
          label="Attendance"
          value={roster.length ? `${avgRate.toFixed(0)}%` : '—'}
          sub="Batch average"
          tone={avgRate >= 90 ? 'success' : avgRate >= 75 ? 'warning' : 'error'}
        />
      </Row>
      {deck.canManageFees && unpaid ? (
        <Pressable onPress={() => goTo('fees')}>
          <Card muted style={{ marginTop: spacing.md }}>
            <Row gap={spacing.sm}>
              <Ionicons name="wallet-outline" size={16} color={colors.warning} />
              <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
                {unpaid} student{unpaid === 1 ? '' : 's'} yet to pay this month's fee
              </AppText>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </Row>
          </Card>
        </Pressable>
      ) : null}

      <Row gap={spacing.sm} style={{ marginTop: spacing.lg }}>
        <Field placeholder="Search name or roll" value={query} onChangeText={setQuery} style={{ flex: 1 }} />
        <Button label="Add" iconName="person-add-outline" onPress={() => setAdding(true)} />
      </Row>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {visible.length ? (
          visible.map((s) => {
            const fee = ledgerCell(s, month, month);
            const rate = rateOf(s.id);
            const hw = data.homeworkOf(s.id).rate;
            return (
              <Pressable
                key={s.id}
                onPress={() => setOpenId(s.id)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Avatar initials={s.photo_initials} gradient={s.avatar_gradient} size={42} />
                <View style={{ flex: 1 }}>
                  <AppText variant="subheading" numberOfLines={1}>
                    {s.name}
                  </AppText>
                  <Row gap={6}>
                    <AppText variant="caption" tone="muted" numberOfLines={1}>
                      {s.roll} · {s.points.toLocaleString('en-IN')} pts ·
                    </AppText>
                    <Streak days={s.streak} />
                  </Row>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Row gap={8}>
                    <Metric icon="checkbox-outline" value={rate} label="Attendance" />
                    <Metric icon="book-outline" value={hw} label="Homework" />
                  </Row>
                  {fee.state === 'not_billed' ? null : (
                    <Pill
                      label={fee.state === 'paid' ? 'Paid' : fee.state === 'overdue' ? 'Overdue' : 'Due'}
                      tone={fee.state === 'paid' ? 'success' : fee.state === 'overdue' ? 'error' : 'warning'}
                    />
                  )}
                </View>
              </Pressable>
            );
          })
        ) : (
          <EmptyState
            icon="people-outline"
            title={roster.length ? 'No matches' : 'No students yet'}
            message={roster.length ? 'Try a different name or roll number.' : 'Share the invite link or register a student directly.'}
          />
        )}
      </View>

      <StudentSheet
        student={open}
        rate={open ? rateOf(open.id) : 0}
        data={data}
        onClose={() => setOpenId(null)}
        onAward={(id) => {
          setOpenId(null);
          goTo('points', { studentId: id });
        }}
      />
      <AddStudentSheet data={data} visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

// ─── Student detail ───────────────────────────────────────────────────────────

function StudentSheet({
  student,
  rate,
  data,
  onClose,
  onAward,
}: {
  student: Student | null;
  rate: number;
  data: DeckViewProps['data'];
  onClose: () => void;
  onAward: (id: string) => void;
}) {
  const { colors } = useTheme();
  const removeStudentFromDeck = useAppStore((s) => s.removeStudentFromDeck);
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  if (!student) return null;
  const hwStats = data.homeworkOf(student.id);

  const contacts = [
    { label: 'Father', name: student.father_name, phone: student.father_phone, verified: student.father_phone_verified },
    { label: 'Mother', name: student.mother_name, phone: student.mother_phone, verified: student.mother_phone_verified },
    { label: 'Guardian', name: student.guardian_name, phone: student.guardian_phone, verified: student.guardian_phone_verified },
  ].filter((c) => c.phone);

  return (
    <>
      <Sheet visible={!confirming} onClose={onClose} title={student.name} subtitle={`${student.roll} · ${student.grade} · ${student.board}`}>
        <Row gap={spacing.md}>
          <Avatar initials={student.photo_initials} gradient={student.avatar_gradient} size={56} ring />
          <Row style={{ flex: 1 }} justify="space-around">
            <Mini value={student.points.toLocaleString('en-IN')} label="Points" />
            <Mini value={`${student.streak}d`} label="Streak" />
            <Mini value={`${rate.toFixed(0)}%`} label="Attendance" />
            <Mini value={hwStats.rate == null ? '—' : `${hwStats.rate.toFixed(0)}%`} label="Homework" />
          </Row>
        </Row>

        <AppText variant="overline" tone="muted" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          HOMEWORK
        </AppText>
        <Card>
          {hwStats.checked ? (
            <>
              <Row gap={5} wrap>
                <Pill label={`${hwStats.full} done`} tone="success" icon="checkmark-done" />
                <Pill label={`${hwStats.partial} partly`} tone="warning" icon="contrast-outline" />
                <Pill label={`${hwStats.none} not done`} tone="error" icon="close" />
              </Row>
              {hwStats.recent.map(({ homework: h, status }) => (
                <Row key={h.id} gap={spacing.sm} style={{ marginTop: spacing.sm }}>
                  <Ionicons
                    name={HW_STATUS[status].icon}
                    size={15}
                    color={status === 'full' ? colors.success : status === 'partial' ? colors.warning : colors.error}
                  />
                  <AppText variant="caption" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
                    {h.title}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {weekdayDate(h.due_date)}
                  </AppText>
                </Row>
              ))}
            </>
          ) : (
            <AppText variant="caption" tone="muted">
              No homework checked for {student.name.split(' ')[0]} yet.
            </AppText>
          )}
        </Card>

        <AppText variant="overline" tone="muted" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          FAMILY CONTACTS
        </AppText>
        <Card padded={false}>
          {contacts.map((c, idx) => (
            <View key={c.label}>
              {idx > 0 ? <Divider inset={spacing.lg} /> : null}
              <View style={{ padding: spacing.lg }}>
                <Row justify="space-between">
                  <AppText variant="caption" tone="muted">
                    {c.label}
                  </AppText>
                  <VerifiedTick verified={c.verified} />
                </Row>
                <AppText variant="subheading" style={{ marginTop: 2 }}>
                  {c.name || '—'}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {c.phone}
                </AppText>
                <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
                  <Button label="Call" iconName="call-outline" size="sm" variant="secondary" onPress={() => callPhone(c.phone)} />
                  <Button
                    label="WhatsApp"
                    iconName="logo-whatsapp"
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      openWhatsApp(c.phone, `Namaste ${c.name.split(' ')[0]}, this is regarding ${student.name} in ${data.deck.title}.`)
                    }
                  />
                </Row>
              </View>
            </View>
          ))}
        </Card>

        <View style={{ marginTop: spacing.lg }}>
          <KeyValue label="Student phone" value={student.phone || '—'} />
          <KeyValue label="Monthly fee" value={`₹${student.custom_monthly_fee.toLocaleString('en-IN')}`} />
        </View>

        <Row gap={spacing.sm} style={{ marginTop: spacing.lg }}>
          <Button label="Award points" iconName="ribbon-outline" onPress={() => onAward(student.id)} style={{ flex: 1 }} fullWidth />
          <Button
            label="Remove"
            iconName="person-remove-outline"
            variant="secondary"
            onPress={() => setConfirming(true)}
            style={{ flex: 1 }}
            fullWidth
          />
        </Row>
      </Sheet>

      <ConfirmSheet
        visible={confirming}
        title={`Remove ${student.name}?`}
        message={`Use this when a student has left tuition. ${student.name} is unenrolled from ${data.deck.name}; their history stays in the Vilarci directory.`}
        onConfirm={() => {
          removeStudentFromDeck(data.deck.ref, student.id);
          toast(`Removed ${student.name} from ${data.deck.name}`, 'info');
          onClose();
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}

/** Compact percentage with an icon, coloured by health. */
function Metric({ icon, value, label }: { icon: IconName; value: number | null; label: string }) {
  const { colors } = useTheme();
  const color =
    value == null ? colors.textMuted : value >= 85 ? colors.successText : value >= 65 ? colors.warningText : colors.errorText;
  return (
    <View accessibilityLabel={`${label} ${value == null ? 'not recorded' : `${value.toFixed(0)} percent`}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon} size={12} color={colors.textMuted} />
      <AppText variant="captionStrong" style={{ color }}>
        {value == null ? '—' : `${value.toFixed(0)}%`}
      </AppText>
    </View>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <AppText variant="metricSm" tone="primary">
        {value}
      </AppText>
      <AppText variant="overline" tone="muted">
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}

// ─── Add student (invite link or manual) ──────────────────────────────────────

function AddStudentSheet({ data, visible, onClose }: { data: DeckViewProps['data']; visible: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'invite' | 'manual'>('invite');
  return (
    <Sheet visible={visible} onClose={onClose} title="Add student" subtitle={`Enrolling into ${data.deck.name}`}>
      <Segmented
        options={[
          { value: 'invite', label: 'Invite link', icon: 'link-outline' },
          { value: 'manual', label: 'Register', icon: 'create-outline' },
        ]}
        value={mode}
        onChange={(v) => setMode(v as 'invite' | 'manual')}
      />
      <View style={{ marginTop: spacing.lg }}>
        {mode === 'invite' ? <InvitePanel data={data} onDone={onClose} /> : <ManualForm data={data} onDone={onClose} />}
      </View>
    </Sheet>
  );
}

function InvitePanel({ data, onDone }: { data: DeckViewProps['data']; onDone: () => void }) {
  const { colors } = useTheme();
  const simulateInviteJoin = useAppStore((s) => s.simulateInviteJoin);
  const { toast } = useToast();
  const { deck } = data;
  const message = `Invitation to join ${deck.title} on Vilarci Study.\n\nTap to enroll: ${deck.inviteLink}\n\nBatch join code: ${deck.joinCode}`;

  return (
    <View>
      <View style={[styles.codeBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <AppText variant="overline" tone="muted">
          BATCH JOIN CODE
        </AppText>
        <AppText style={{ fontFamily: fonts.sansBold, fontSize: 24, letterSpacing: 2, color: colors.primary, marginTop: 4 }}>
          {deck.joinCode}
        </AppText>
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }} numberOfLines={2}>
          {deck.inviteLink}
        </AppText>
      </View>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
        Students who open the link or enter the code in the Vilarci Study app join this batch with their verified
        parent contacts.
      </AppText>
      <Row gap={spacing.sm} style={{ marginTop: spacing.lg }}>
        <Button
          label="Share"
          iconName="share-social-outline"
          variant="secondary"
          style={{ flex: 1 }}
          fullWidth
          onPress={async () => {
            if (!(await shareText(message))) toast(`Join code: ${deck.joinCode}`, 'info');
          }}
        />
        <Button
          label="WhatsApp"
          iconName="logo-whatsapp"
          variant="secondary"
          style={{ flex: 1 }}
          fullWidth
          onPress={() => shareOnWhatsApp(message)}
        />
      </Row>
      <Divider style={{ marginVertical: spacing.lg }} />
      <AppText variant="overline" tone="muted">
        DEMO
      </AppText>
      <Button
        label="Simulate a student joining"
        iconName="sparkles-outline"
        variant="gold"
        fullWidth
        style={{ marginTop: spacing.sm }}
        onPress={() => {
          const name = simulateInviteJoin(deck.ref);
          toast(`${name} joined ${deck.name} via invite link`, 'success', 'person-add');
          onDone();
        }}
      />
    </View>
  );
}

function ManualForm({ data, onDone }: { data: DeckViewProps['data']; onDone: () => void }) {
  const db = useDb();
  const enrollNewStudent = useAppStore((s) => s.enrollNewStudent);
  const { toast } = useToast();
  const { deck } = data;
  const [name, setName] = useState('');
  const [roll, setRoll] = useState(() => nextRollNumber(db.students));
  const [board, setBoard] = useState(deck.board.includes('ICSE') ? 'ICSE' : 'CBSE');
  const [fatherName, setFatherName] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [fee, setFee] = useState(String(deck.monthlyFee));
  const [paid, setPaid] = useState(false);
  const [points, setPoints] = useState(500);

  const phoneOk = (p: string) => p.replace(/\D/g, '').length >= 10;
  const valid = name.trim().length > 2 && roll.trim() && fatherName.trim() && phoneOk(fatherPhone);

  const submit = () => {
    if (!valid) return;
    enrollNewStudent(deck.ref, {
      name: name.trim(),
      roll: roll.trim(),
      grade: deck.grade,
      board,
      father_name: fatherName.trim(),
      father_phone: fatherPhone.trim(),
      mother_name: motherName.trim(),
      mother_phone: motherPhone.trim(),
      guardian_name: guardianName.trim(),
      guardian_phone: guardianPhone.trim(),
      monthly_fee: parseInt(fee, 10) || deck.monthlyFee,
      current_month_paid: paid,
      welcome_points: points,
    });
    toast(`Enrolled ${name.trim()} (${roll.trim()}) in ${deck.name}`, 'success', 'person-add');
    onDone();
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <FormField label="Student name" value={name} onChangeText={setName} />
      <Row gap={spacing.md} align="flex-start">
        <FormField label="Roll no." value={roll} onChangeText={setRoll} containerStyle={{ flex: 1 }} />
        <FormField
          label="Monthly fee (₹)"
          value={fee}
          onChangeText={(t) => setFee(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          containerStyle={{ flex: 1 }}
        />
      </Row>
      <ChoiceChips
        label="Board"
        options={['CBSE', 'ICSE', 'State Board'].map((b) => ({ value: b, label: b }))}
        value={board}
        onChange={setBoard}
      />
      <FormField label="Father's name" value={fatherName} onChangeText={setFatherName} />
      <FormField
        label="Father's phone"
        value={fatherPhone}
        onChangeText={setFatherPhone}
        keyboardType="phone-pad"
        hint="Verified by OTP when the family first opens Vilarci Study"
        error={fatherPhone && !phoneOk(fatherPhone) ? 'Enter a 10-digit number' : null}
      />
      <Row gap={spacing.md} align="flex-start">
        <FormField label="Mother's name" value={motherName} onChangeText={setMotherName} containerStyle={{ flex: 1 }} />
        <FormField
          label="Mother's phone"
          value={motherPhone}
          onChangeText={setMotherPhone}
          keyboardType="phone-pad"
          containerStyle={{ flex: 1 }}
        />
      </Row>
      <Row gap={spacing.md} align="flex-start">
        <FormField label="Guardian (optional)" value={guardianName} onChangeText={setGuardianName} containerStyle={{ flex: 1 }} />
        <FormField
          label="Guardian phone"
          value={guardianPhone}
          onChangeText={setGuardianPhone}
          keyboardType="phone-pad"
          containerStyle={{ flex: 1 }}
        />
      </Row>
      <ChoiceChips
        label="This month's fee"
        options={[
          { value: 'pending', label: 'Pending' },
          { value: 'paid', label: 'Paid' },
        ]}
        value={paid ? 'paid' : 'pending'}
        onChange={(v) => setPaid(v === 'paid')}
      />
      <ChoiceChips
        label="Welcome points"
        options={[0, 250, 500, 1000].map((p) => ({ value: p, label: `+${p}` }))}
        value={points}
        onChange={setPoints}
      />
      <Button label="Enroll student" iconName="checkmark" fullWidth disabled={!valid} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  codeBox: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
