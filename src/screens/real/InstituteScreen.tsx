import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import {
  describeInstituteError,
  INSTITUTE_LIMITS,
  isInstituteAdmin,
  memberLine,
  ROLE_LABELS,
  useDecideTeacher,
  useDeleteInstitute,
  useInstitute,
  useLeaveInstitute,
  useRemoveTeacher,
  useRestoreInstitute,
  useUpdateMember,
} from '../../lib/api/institutes';
import { gradeBoardLabel, useRestoreBatch } from '../../lib/api/privateBatches';
import type { Institute, InstituteMember, InstituteSection } from '../../lib/local/types';
import { useLocalStore } from '../../lib/local/store';
import { useRefresh } from '../../lib/sync/useRefresh';
import { money } from '../../lib/utils/format';
import { summarizeSchedule } from '../../lib/utils/schedule';
import { AppText, Avatar, Card, CenterMark, Divider, EmptyState, IconName, Pill, PressableCard, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { FormField } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';
import { useWhatsApp } from '../../components/real/WhatsApp';

/** One institute: sections (with their subjects), teachers and requests. */
export function InstituteScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const id: string = useRoute<any>().params?.id;
  const toast = useToast();
  const inst = useInstitute(id);
  const myId = useLocalStore((s) => s.account?.me?.id);
  const { refreshing, refresh } = useRefresh();
  const decide = useDecideTeacher();
  const leave = useLeaveInstitute();
  const remove = useDeleteInstitute();
  const restore = useRestoreInstitute();
  const restoreSection = useRestoreBatch();
  const [menu, setMenu] = useState(false);
  const [member, setMember] = useState<InstituteMember | null>(null);
  const [confirm, setConfirm] = useState<'leave' | 'delete' | 'cancel' | null>(null);

  if (!inst) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Institute" />
        <Screen refreshing={refreshing} onRefresh={refresh}>
          <EmptyState icon="business-outline" title="Institute not found" message="You may have left it, or it was deleted. Pull to refresh." />
        </Screen>
      </View>
    );
  }

  const admin = isInstituteAdmin(inst);
  const owner = inst.my_role === 'owner' && inst.my_status === 'active';
  const pending = inst.my_status === 'pending';
  const deleted = inst.deleted_at != null;
  const sections = (inst.sections ?? []).filter((s) => s.deleted_at == null);
  const deletedSections = (inst.sections ?? []).filter((s) => s.deleted_at != null);
  const members = (inst.members ?? []).filter((m) => m.status === 'active');
  const asking = (inst.members ?? []).filter((m) => m.status === 'pending');
  const mySubjects = sections.flatMap((s) => s.subjects.filter((c) => c.teacher_id === myId).map((c) => ({ section: s, subject: c })));

  const fromMenu = (go: () => void) => () => {
    setMenu(false);
    setTimeout(go, 300);
  };

  const run = async (work: () => Promise<unknown>, done: string, after?: () => void) => {
    try {
      await work();
      toast.toast(done, 'success');
      after?.();
    } catch (err) {
      toast.toast(describeInstituteError(err), 'error');
    }
  };

  const onConfirm = () => {
    const what = confirm;
    setConfirm(null);
    if (what === 'delete') run(() => remove.mutateAsync(inst.id), 'Institute deleted — you can restore it');
    else run(() => leave.mutateAsync(inst.id), what === 'cancel' ? 'Request withdrawn' : `You left ${inst.name}`, () => navigation.goBack());
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar
        title={inst.name}
        right={
          pending ? undefined : (
            <Pressable
              onPress={() => setMenu(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Institute options"
              style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={colors.textMain} />
            </Pressable>
          )
        }
      />
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <SyncBanner />

        {/* ── The institute ────────────────────────────────────────────── */}
        <Card>
          <Row gap={spacing.md} align="flex-start">
            <CenterMark text={inst.logo_text} color={inst.theme_color} size={56} />
            <View style={{ flex: 1 }}>
              <AppText variant="title" numberOfLines={2}>
                {inst.name}
              </AppText>
              {inst.tagline ? (
                <AppText variant="caption" tone="muted" numberOfLines={3}>
                  {inst.tagline}
                </AppText>
              ) : null}
              <Row gap={5} wrap style={{ marginTop: spacing.sm }}>
                <Pill
                  label={pending ? 'Waiting for approval' : ROLE_LABELS[inst.my_role]}
                  tone={pending ? 'warning' : inst.my_role === 'owner' ? 'gold' : 'primary'}
                  icon={pending ? 'time-outline' : inst.my_role === 'owner' ? 'star' : 'briefcase-outline'}
                />
                {inst.established ? <Pill label={`Since ${inst.established}`} tone="neutral" icon="ribbon-outline" /> : null}
              </Row>
            </View>
          </Row>
          {inst.address || inst.phone || inst.email ? (
            <View style={{ marginTop: spacing.md, gap: 4 }}>
              {inst.address ? <InfoLine icon="location-outline" text={inst.address} /> : null}
              {inst.phone ? <InfoLine icon="call-outline" text={inst.phone} /> : null}
              {inst.email ? <InfoLine icon="mail-outline" text={inst.email} /> : null}
            </View>
          ) : null}
        </Card>

        {pending ? (
          <Card muted style={{ marginTop: spacing.lg }}>
            <AppText variant="bodyStrong">Your request is with the institute</AppText>
            <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
              Once the owner or an admin approves you, its sections and your subjects show up here.
            </AppText>
            <Button label="Withdraw request" variant="secondary" size="sm" onPress={() => setConfirm('cancel')} style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} />
          </Card>
        ) : deleted ? (
          <Card accentColor={colors.error} style={{ marginTop: spacing.lg }}>
            <AppText variant="bodyStrong">This institute is deleted</AppText>
            <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
              Students and teachers don’t see it. Restoring brings back every section, subject and record.
            </AppText>
            {owner ? (
              <Button
                label="Restore institute"
                iconName="refresh-outline"
                size="sm"
                loading={restore.isPending}
                onPress={() => run(() => restore.mutateAsync(inst.id), 'Institute restored')}
                style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              />
            ) : null}
          </Card>
        ) : (
          <>
            {/* ── Invite ───────────────────────────────────────────────── */}
            {admin ? (
              <Row gap={spacing.sm} style={{ marginTop: spacing.lg }}>
                <Button
                  label="Students’ code"
                  iconName="qr-code-outline"
                  variant="secondary"
                  size="sm"
                  onPress={() => navigation.navigate('InstituteCodes', { id: inst.id, which: 'students' })}
                  style={{ flex: 1 }}
                  fullWidth
                />
                <Button
                  label="Invite teachers"
                  iconName="person-add-outline"
                  variant="secondary"
                  size="sm"
                  onPress={() => navigation.navigate('InstituteCodes', { id: inst.id, which: 'staff' })}
                  style={{ flex: 1 }}
                  fullWidth
                />
              </Row>
            ) : null}

            {/* ── Teachers asking to join ──────────────────────────────── */}
            {admin && asking.length ? (
              <View style={{ marginTop: spacing.xxl }}>
                <SectionHeader title="Teachers asking to join" subtitle={`${asking.length} waiting for you`} />
                <View style={{ gap: spacing.md }}>
                  {asking.map((m) => (
                    <Card key={m.user_id} accentColor={colors.gold}>
                      <MemberLine member={m} />
                      <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
                        <Button
                          label="Decline"
                          variant="secondary"
                          size="sm"
                          onPress={() => run(() => decide.mutateAsync({ id: inst.id, userId: m.user_id, approve: false }), 'Request declined')}
                          style={{ flex: 1 }}
                          fullWidth
                        />
                        <Button
                          label="Accept"
                          iconName="checkmark"
                          size="sm"
                          loading={decide.isPending}
                          onPress={() => run(() => decide.mutateAsync({ id: inst.id, userId: m.user_id, approve: true }), `${m.name} joined as a teacher`)}
                          style={{ flex: 1 }}
                          fullWidth
                        />
                      </Row>
                    </Card>
                  ))}
                </View>
              </View>
            ) : null}

            {/* ── What I teach here ────────────────────────────────────── */}
            {mySubjects.length ? (
              <View style={{ marginTop: spacing.xxl }}>
                <SectionHeader title="My subjects" subtitle="Attendance, tests and notices" />
                <Card padded={false}>
                  {mySubjects.map(({ section, subject }, i) => (
                    <View key={subject.batch_id}>
                      {i > 0 ? <Divider inset={spacing.lg} /> : null}
                      <Pressable
                        onPress={() => navigation.navigate('BatchDetail', { id: subject.batch_id })}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.7 : 1 }]}
                      >
                        <View style={[styles.dot, { backgroundColor: inst.theme_color }]} />
                        <View style={{ flex: 1 }}>
                          <AppText variant="subheading">{subject.subject}</AppText>
                          <AppText variant="caption" tone="muted" numberOfLines={1}>
                            {section.name} · {summarizeSchedule(subject.weekly_schedule)}
                          </AppText>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}

            {/* ── Sections ─────────────────────────────────────────────── */}
            <View style={{ marginTop: spacing.xxl }}>
              <SectionHeader
                title="Sections"
                subtitle={sections.length ? `${sections.length} · students join a section and get all its subjects` : undefined}
                action={admin && sections.length < INSTITUTE_LIMITS.sectionsPerInstitute ? 'Add' : undefined}
                onAction={() => navigation.navigate('BatchForm', { instituteId: inst.id })}
              />
              {sections.length ? (
                <View style={{ gap: spacing.md }}>
                  {sections.map((s) => (
                    <SectionCard key={s.batch_id} section={s} inst={inst} canOpen={admin} onPress={() => navigation.navigate('BatchDetail', { id: s.batch_id })} />
                  ))}
                </View>
              ) : admin ? (
                <Card muted>
                  <AppText variant="caption" tone="muted">
                    A section is a class students join — like “Class 10-A” — with its own fee and seats. Add its subjects and pick a teacher for each.
                  </AppText>
                  <Button
                    label="Add a section"
                    iconName="add"
                    size="sm"
                    onPress={() => navigation.navigate('BatchForm', { instituteId: inst.id })}
                    style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
                  />
                </Card>
              ) : (
                <EmptyState icon="grid-outline" title="No sections yet" message="The owner or an admin adds sections and gives you subjects." />
              )}
              {admin && deletedSections.length ? (
                <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                  <AppText variant="overline" tone="muted">
                    DELETED SECTIONS
                  </AppText>
                  {deletedSections.map((s) => (
                    <Card key={s.batch_id} muted>
                      <Row gap={spacing.md}>
                        <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                          {s.name}
                        </AppText>
                        <Button
                          label="Restore"
                          iconName="refresh-outline"
                          size="sm"
                          variant="secondary"
                          loading={restoreSection.isPending}
                          onPress={() => run(() => restoreSection.mutateAsync(s.batch_id), `${s.name} restored with its subjects`)}
                        />
                      </Row>
                    </Card>
                  ))}
                </View>
              ) : null}
            </View>

            {/* ── Teachers ─────────────────────────────────────────────── */}
            <View style={{ marginTop: spacing.xxl }}>
              <SectionHeader
                title="Teachers"
                subtitle={`${members.length} in the institute`}
                action={admin ? 'Invite' : undefined}
                onAction={() => navigation.navigate('InstituteCodes', { id: inst.id, which: 'staff' })}
              />
              <Card padded={false}>
                {members.map((m, i) => {
                  const canEdit = admin && m.role !== 'owner' && m.user_id !== myId && (owner || m.role !== 'admin');
                  return (
                    <View key={m.user_id}>
                      {i > 0 ? <Divider inset={spacing.lg} /> : null}
                      <Pressable
                        onPress={canEdit ? () => setMember(m) : undefined}
                        disabled={!canEdit}
                        accessibilityRole={canEdit ? 'button' : undefined}
                        style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.7 : 1 }]}
                      >
                        <View style={{ flex: 1 }}>
                          <MemberLine member={m} subjects={teachesIn(inst, m.user_id)} me={m.user_id === myId} />
                        </View>
                        {canEdit ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
                      </Pressable>
                    </View>
                  );
                })}
              </Card>
            </View>
          </>
        )}
      </Screen>

      {/* ── ⋮ menu ─────────────────────────────────────────────────────── */}
      <Sheet visible={menu} onClose={() => setMenu(false)} title={inst.name} subtitle={ROLE_LABELS[inst.my_role]}>
        <View style={{ paddingBottom: spacing.md }}>
          {admin && !deleted ? (
            <>
              <MenuRow icon="create-outline" title="Edit institute" subtitle="Name, logo, colour, contact" onPress={fromMenu(() => navigation.navigate('InstituteForm', { id: inst.id }))} />
              <MenuRow icon="add-circle-outline" title="Add a section" subtitle="A class students join" onPress={fromMenu(() => navigation.navigate('BatchForm', { instituteId: inst.id }))} />
              <MenuRow icon="qr-code-outline" title="Students’ code" subtitle="Families pick a section and ask to join" onPress={fromMenu(() => navigation.navigate('InstituteCodes', { id: inst.id, which: 'students' }))} />
              <MenuRow icon="person-add-outline" title="Invite teachers" subtitle="The teachers’ code" onPress={fromMenu(() => navigation.navigate('InstituteCodes', { id: inst.id, which: 'staff' }))} />
            </>
          ) : null}
          {owner && !deleted ? (
            <>
              <Divider style={{ marginVertical: spacing.sm }} />
              <MenuRow icon="trash-outline" title="Delete institute" subtitle="Every section and subject with it · can be restored" danger onPress={fromMenu(() => setConfirm('delete'))} />
            </>
          ) : null}
          {!owner ? (
            <MenuRow icon="exit-outline" title="Leave institute" subtitle="You stop seeing its sections and subjects" danger onPress={fromMenu(() => setConfirm('leave'))} />
          ) : null}
        </View>
      </Sheet>

      <MemberSheet inst={inst} member={member} isOwner={owner} onClose={() => setMember(null)} />

      <ConfirmSheet
        visible={confirm != null}
        title={confirm === 'delete' ? `Delete “${inst.name}”?` : confirm === 'cancel' ? 'Withdraw your request?' : `Leave “${inst.name}”?`}
        message={
          confirm === 'delete'
            ? 'Students, parents and teachers stop seeing every section and subject. You can restore it later with everything in it. Needs the internet.'
            : confirm === 'cancel'
              ? 'You can ask again later with the same code.'
              : 'You stop seeing its sections and subjects. An admin can give your subjects to another teacher. Needs the internet.'
        }
        confirmLabel={confirm === 'delete' ? 'Delete institute' : confirm === 'cancel' ? 'Withdraw' : 'Leave'}
        onClose={() => setConfirm(null)}
        onConfirm={onConfirm}
      />
    </View>
  );
}

/** The subjects a teacher takes in this institute, e.g. "Physics (10-A), Chemistry (10-A)". */
function teachesIn(inst: Institute, userId: string): string[] {
  return (inst.sections ?? [])
    .filter((s) => s.deleted_at == null)
    .flatMap((s) => s.subjects.filter((c) => c.teacher_id === userId).map((c) => `${c.subject} (${s.name})`));
}

function SectionCard({ section: s, inst, canOpen, onPress }: { section: InstituteSection; inst: Institute; canOpen: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const level = gradeBoardLabel(s);
  const body = (
    <>
      <Row gap={spacing.md} align="flex-start">
        <View style={[styles.sectionBadge, { backgroundColor: `${inst.theme_color}1A` }]}>
          <Ionicons name="people" size={18} color={inst.theme_color} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="subheading" numberOfLines={1}>
            {s.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {[level, `${s.students} of ${s.capacity} students`, s.monthly_fee ? `${money(s.monthly_fee)}/month` : null].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        {s.requests && canOpen ? <Pill label={`${s.requests} waiting`} tone="accent" /> : null}
        {canOpen ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
      </Row>
      {s.subjects.length ? (
        <Row gap={5} wrap style={{ marginTop: spacing.md }}>
          {s.subjects.map((c) => (
            <Pill key={c.batch_id} label={c.teacher_name ? `${c.subject} · ${c.teacher_name.split(' ')[0]}` : `${c.subject} · no teacher`} tone={c.teacher_name ? 'neutral' : 'warning'} />
          ))}
        </Row>
      ) : (
        <AppText variant="caption" tone="gold" style={{ marginTop: spacing.sm }}>
          No subjects yet
        </AppText>
      )}
    </>
  );
  return canOpen ? (
    <PressableCard level={1} onPress={onPress}>
      {body}
    </PressableCard>
  ) : (
    <Card>{body}</Card>
  );
}

function MemberLine({ member: m, subjects, me }: { member: InstituteMember; subjects?: string[]; me?: boolean }) {
  const initials = m.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <Row gap={spacing.md}>
      <Avatar initials={initials} gradient={m.role === 'owner' ? ['#B8860B', '#E0B23C'] : ['#1E5AA8', '#4F8FE0']} size={40} />
      <View style={{ flex: 1 }}>
        <AppText variant="subheading" numberOfLines={1}>
          {m.name}
          {me ? ' (you)' : ''}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {memberLine(m)}
        </AppText>
        {subjects?.length ? (
          <AppText variant="caption" tone="secondary" numberOfLines={2}>
            Teaches {subjects.join(', ')}
          </AppText>
        ) : null}
      </View>
    </Row>
  );
}

/** Owner / admin: a teacher's title, admin rights (owner only), WhatsApp, remove. */
function MemberSheet({ inst, member, isOwner, onClose }: { inst: Institute; member: InstituteMember | null; isOwner: boolean; onClose: () => void }) {
  const whatsApp = useWhatsApp();
  return (
    <>
      <Sheet visible={member != null} onClose={onClose} title={member?.name ?? ''} subtitle={member ? memberLine(member) : undefined}>
        {member ? <MemberForm key={member.user_id} inst={inst} member={member} isOwner={isOwner} onDone={onClose} onWhatsApp={whatsApp.send} /> : null}
      </Sheet>
      {whatsApp.sheet}
    </>
  );
}

function MemberForm({
  inst,
  member,
  isOwner,
  onDone,
  onWhatsApp,
}: {
  inst: Institute;
  member: InstituteMember;
  isOwner: boolean;
  onDone: () => void;
  onWhatsApp: ReturnType<typeof useWhatsApp>['send'];
}) {
  const toast = useToast();
  const update = useUpdateMember();
  const remove = useRemoveTeacher();
  const [title, setTitle] = useState(member.title);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const act = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      toast.toast(done, 'success');
      onDone();
    } catch (err) {
      toast.toast(describeInstituteError(err), 'error');
    }
  };

  return (
    <View>
      <FormField label="Title" placeholder="e.g. Physics faculty" maxLength={INSTITUTE_LIMITS.titleMax} value={title} onChangeText={setTitle} />
      <Button
        label="Save title"
        size="sm"
        variant="secondary"
        disabled={title.trim() === member.title}
        loading={update.isPending}
        onPress={() => act(() => update.mutateAsync({ id: inst.id, userId: member.user_id, data: { title: title.trim() } }), 'Title saved')}
        style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
      />
      {isOwner ? (
        <Card muted style={{ marginTop: spacing.lg }}>
          <AppText variant="bodyStrong">{member.role === 'admin' ? 'Admin' : 'Teacher'}</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
            Admins add sections, subjects and teachers, approve students and record fees. Teachers take attendance, tests and notices in their subjects.
          </AppText>
          <Button
            label={member.role === 'admin' ? 'Make a teacher' : 'Make an admin'}
            iconName="shield-checkmark-outline"
            size="sm"
            variant="secondary"
            loading={update.isPending}
            onPress={() =>
              act(
                () => update.mutateAsync({ id: inst.id, userId: member.user_id, data: { role: member.role === 'admin' ? 'teacher' : 'admin' } }),
                member.role === 'admin' ? `${member.name} is a teacher now` : `${member.name} is an admin now`,
              )
            }
            style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
          />
        </Card>
      ) : null}
      <Row gap={spacing.sm} style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
        {member.whatsapp ? (
          <Button
            label="WhatsApp"
            iconName="logo-whatsapp"
            variant="secondary"
            size="sm"
            onPress={() => {
              onDone();
              onWhatsApp([{ name: member.name, whatsapp: member.whatsapp, relation: 'teacher', relation_other: null }], () => `Hello ${member.name.split(' ')[0]}, `);
            }}
            style={{ flex: 1 }}
            fullWidth
          />
        ) : null}
        {confirmRemove ? (
          <Button
            label="Yes, remove"
            variant="danger"
            size="sm"
            loading={remove.isPending}
            onPress={() => act(() => remove.mutateAsync({ id: inst.id, userId: member.user_id }), `${member.name} removed`)}
            style={{ flex: 1 }}
            fullWidth
          />
        ) : (
          <Button label="Remove from institute" variant="secondary" size="sm" onPress={() => setConfirmRemove(true)} style={{ flex: 1 }} fullWidth />
        )}
      </Row>
      {confirmRemove ? (
        <AppText variant="caption" tone="error" style={{ marginBottom: spacing.md }}>
          They stop seeing the institute. Their subjects keep their records; give them to another teacher from the section.
        </AppText>
      ) : null}
    </View>
  );
}

function InfoLine({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <Row gap={6} align="flex-start">
      <Ionicons name={icon} size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
      <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
        {text}
      </AppText>
    </Row>
  );
}

function MenuRow({ icon, title, subtitle, danger, onPress }: { icon: IconName; title: string; subtitle?: string; danger?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const tint = danger ? colors.error : colors.primary;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.menuRow, { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' }]}>
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

const styles = StyleSheet.create({
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sectionBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  menuIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
