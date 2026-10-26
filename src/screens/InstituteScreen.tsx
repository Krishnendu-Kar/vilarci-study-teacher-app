import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/tokens';
import { useAppStore } from '../lib/store/useAppStore';
import { useInstitute, useInstituteAnalytics } from '../lib/api/hooks';
import type { CoachingSection, NoticeCategory } from '../lib/data/types';
import { formatDate } from '../lib/utils/format';
import { callPhone, openWhatsApp, shareText } from '../lib/utils/contact';
import {
  AppText,
  Avatar,
  Card,
  CenterMark,
  Chip,
  Divider,
  EmptyState,
  KeyValue,
  Pill,
  IconName,
  PillTone,
  PressableCard,
  ProgressBar,
  Row,
  SectionHeader,
  StatTile,
} from '../components/ui/base';
import { Button } from '../components/ui/Button';
import { ChoiceChips } from '../components/ui/ChoiceChips';
import { ConfirmSheet } from '../components/ui/ConfirmSheet';
import { FormField } from '../components/ui/Field';
import { Screen } from '../components/ui/Screen';
import { Sheet } from '../components/ui/Sheet';
import { useToast } from '../components/ui/Toast';
import { teacherGradient } from '../components/AccountSheet';
import { SidebarButton, type SidebarContext } from '../components/Sidebar';

type Tab = 'mine' | 'all' | 'members' | 'notices' | 'analytics' | 'profile';

type InstituteCtx = NonNullable<ReturnType<typeof useInstitute>>;

const NOTICE_TONE: Record<NoticeCategory, PillTone> = {
  'Important Circular': 'error',
  'Exam & Test Schedule': 'success',
  'Holiday & Vacation Notice': 'gold',
  'General Announcement': 'info',
};

const NOTICE_ICON: Record<NoticeCategory, IconName> = {
  'Important Circular': 'alert-circle-outline',
  'Exam & Test Schedule': 'document-text-outline',
  'Holiday & Vacation Notice': 'sunny-outline',
  'General Announcement': 'megaphone-outline',
};

/** Coaching workspace — the mobile stand-in for the portal's sidebar layout. */
export function InstituteScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const ctx = useInstitute(route.params?.id);
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'mine');

  // Leave if the institute disappears (e.g. after switching accounts).
  useEffect(() => {
    if (!ctx && navigation.canGoBack()) navigation.goBack();
  }, [ctx, navigation]);

  if (!ctx) return <View style={{ flex: 1, backgroundColor: colors.bgApp }} />;
  const { inst } = ctx;

  const tabs: {
    key: Tab;
    label: string;
    show: boolean;
    navIcon: React.ComponentProps<typeof Ionicons>['name'];
    navLabel: string;
    badge?: number;
  }[] = [
    { key: 'mine', label: `My sections · ${ctx.mySections.length}`, show: true, navIcon: 'pin-outline', navLabel: 'My assigned sections', badge: ctx.mySections.length },
    { key: 'all', label: `All sections · ${inst.classes_sections.length}`, show: ctx.canCreateSections, navIcon: 'business-outline', navLabel: 'All classes & sections', badge: inst.classes_sections.length },
    { key: 'members', label: `Faculty · ${inst.members.length}`, show: ctx.canManageMembers, navIcon: 'people-outline', navLabel: 'Faculty & members', badge: inst.members.length },
    { key: 'notices', label: 'Notices', show: true, navIcon: 'megaphone-outline', navLabel: 'Notices & circulars', badge: inst.notices.length },
    { key: 'analytics', label: 'Analytics', show: true, navIcon: 'stats-chart-outline', navLabel: 'Performance analytics' },
    { key: 'profile', label: 'Profile', show: true, navIcon: 'settings-outline', navLabel: 'Institute settings' },
  ];
  const active = tabs.find((t) => t.key === tab && t.show) ? tab : 'mine';

  const sidebar: SidebarContext = {
    overline: ctx.role,
    title: inst.name,
    color: inst.theme_color,
    active,
    onSelect: (key) => setTab(key as Tab),
    items: tabs.filter((t) => t.show).map((t) => ({ key: t.key, label: t.navLabel, icon: t.navIcon, badge: t.badge })),
  };

  const openSection = (sec: CoachingSection) =>
    navigation.navigate('Deck', { type: 'coaching_section', id: sec.id, instituteId: inst.id, tab: 'students' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      {/* ── Institute bar ──────────────────────────────────────────────────── */}
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Row gap={spacing.md}>
          <SidebarButton context={sidebar} />
          <CenterMark text={inst.logo_text} color={inst.theme_color} size={40} />
          <View style={{ flex: 1 }}>
            <AppText variant="heading" numberOfLines={1}>
              {inst.name}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {ctx.role} · code {inst.code}
            </AppText>
          </View>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to institutes"
            hitSlop={10}
            style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="close" size={18} color={colors.textMain} />
          </Pressable>
        </Row>
      </View>

      <View style={{ backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}
        >
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <Chip key={t.key} label={t.label} icon={t.navIcon} selected={active === t.key} onPress={() => setTab(t.key)} />
            ))}
        </ScrollView>
      </View>

      <Screen resetKey={active}>
        {active === 'mine' ? <MySections ctx={ctx} onOpen={openSection} /> : null}
        {active === 'all' ? <AllSections ctx={ctx} onOpen={openSection} /> : null}
        {active === 'members' ? <Members ctx={ctx} /> : null}
        {active === 'notices' ? <Notices ctx={ctx} /> : null}
        {active === 'analytics' ? <Analytics ctx={ctx} onOpen={openSection} /> : null}
        {active === 'profile' ? <Profile ctx={ctx} /> : null}
      </Screen>
    </View>
  );
}

// ─── My assigned sections ─────────────────────────────────────────────────────

function MySections({ ctx, onOpen }: { ctx: InstituteCtx; onOpen: (s: CoachingSection) => void }) {
  if (!ctx.mySections.length) {
    return (
      <EmptyState
        icon="pin-outline"
        title="No sections assigned yet"
        message={
          ctx.isOwner
            ? 'Create a section from All sections and you will be its first subject teacher.'
            : 'The director will allocate your subjects to class sections.'
        }
      />
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      {ctx.mySections.map((sec) => (
        <SectionCard key={sec.id} ctx={ctx} section={sec} onOpen={onOpen} highlightTeacher={ctx.teacherId} />
      ))}
    </View>
  );
}

function SectionCard({
  ctx,
  section,
  onOpen,
  highlightTeacher,
}: {
  ctx: InstituteCtx;
  section: CoachingSection;
  onOpen: (s: CoachingSection) => void;
  highlightTeacher?: string;
}) {
  const { colors } = useTheme();
  const enrolled = section.student_ids.length;
  const slots = highlightTeacher
    ? section.subject_faculty_map.filter((f) => f.teacher_id === highlightTeacher)
    : section.subject_faculty_map;
  return (
    <PressableCard onPress={() => onOpen(section)} rail={ctx.inst.theme_color}>
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1 }}>
          <AppText variant="title">{section.full_code}</AppText>
          <Row gap={5} wrap style={{ marginTop: 4 }}>
            <Pill label={section.board} tone="primary" />
            <Pill label={section.room} icon="location-outline" />
          </Row>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Row>

      <View style={[styles.well, { backgroundColor: colors.surfaceMuted }]}>
        <AppText variant="overline" tone="muted">
          {highlightTeacher ? 'YOUR SUBJECTS' : 'SUBJECT FACULTY'}
        </AppText>
        {slots.map((f) => (
          <Row key={f.subject} justify="space-between" align="flex-start" gap={spacing.md} style={{ marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="captionStrong">{f.subject}</AppText>
              <AppText variant="caption" tone="muted">
                {highlightTeacher ? f.schedule : ctx.teacherName(f.teacher_id)}
              </AppText>
            </View>
            <AppText variant="caption" tone="secondary">
              {f.lectures_per_week}/wk
            </AppText>
          </Row>
        ))}
        {!slots.length ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: 6 }}>
            No faculty allocated yet.
          </AppText>
        ) : null}
      </View>

      <Row justify="space-between" style={{ marginBottom: 5 }}>
        <AppText variant="caption" tone="muted">
          Enrolled
        </AppText>
        <AppText variant="captionStrong">
          {enrolled} of {section.capacity}
        </AppText>
      </Row>
      <ProgressBar value={section.capacity ? (enrolled / section.capacity) * 100 : 0} color={ctx.inst.theme_color} />
    </PressableCard>
  );
}

// ─── All sections (admins) ────────────────────────────────────────────────────

function AllSections({ ctx, onOpen }: { ctx: InstituteCtx; onOpen: (s: CoachingSection) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <View>
      <Button
        label="Add class section"
        iconName="add"
        variant="secondary"
        fullWidth
        onPress={() => setAdding(true)}
        style={{ marginBottom: spacing.lg }}
      />
      {ctx.inst.classes_sections.length ? (
        <View style={{ gap: spacing.md }}>
          {ctx.inst.classes_sections.map((sec) => (
            <SectionCard key={sec.id} ctx={ctx} section={sec} onOpen={onOpen} />
          ))}
        </View>
      ) : (
        <EmptyState icon="business-outline" title="No sections yet" message="Add Class 10-A, 10-B and so on, then allocate faculty." />
      )}
      <AddSectionSheet instituteId={ctx.inst.id} visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

function AddSectionSheet({ instituteId, visible, onClose }: { instituteId: string; visible: boolean; onClose: () => void }) {
  const addSection = useAppStore((s) => s.addSection);
  const { toast } = useToast();
  const [klass, setKlass] = useState('Class 10');
  const [section, setSection] = useState('C');
  const [board, setBoard] = useState('CBSE');
  const [room, setRoom] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [subject, setSubject] = useState('Mathematics');

  const valid = section.trim() && room.trim() && parseInt(capacity, 10) > 0 && subject.trim();

  return (
    <Sheet visible={visible} onClose={onClose} title="Add class section" subtitle="You are allocated as its first subject teacher">
      <View style={{ gap: spacing.lg }}>
        <ChoiceChips
          label="Class"
          options={['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((c) => ({ value: c, label: c }))}
          value={klass}
          onChange={setKlass}
        />
        <Row gap={spacing.md} align="flex-start">
          <FormField
            label="Section"
            value={section}
            onChangeText={(t) => setSection(t.toUpperCase())}
            maxLength={8}
            containerStyle={{ flex: 1 }}
          />
          <FormField
            label="Seats"
            value={capacity}
            onChangeText={(t) => setCapacity(t.replace(/\D/g, ''))}
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
        <FormField label="Room" placeholder="e.g. Lecture Hall B-1" value={room} onChangeText={setRoom} />
        <FormField label="Your subject here" value={subject} onChangeText={setSubject} />
        <Button
          label={`Create ${klass}-${section || '?'}`}
          iconName="checkmark"
          fullWidth
          disabled={!valid}
          onPress={() => {
            addSection(instituteId, {
              class_name: klass,
              section_name: section.trim(),
              board,
              room: room.trim(),
              capacity: parseInt(capacity, 10),
              subject: subject.trim(),
            });
            toast(`Added ${klass}-${section.trim()}`, 'success');
            setRoom('');
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

// ─── Faculty & members ────────────────────────────────────────────────────────

function Members({ ctx }: { ctx: InstituteCtx }) {
  const { colors } = useTheme();
  const removeMember = useAppStore((s) => s.removeMember);
  const { toast } = useToast();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const removingName = removing ? ctx.teacherName(removing) : '';

  return (
    <View>
      <Button
        label="Invite a teacher"
        iconName="person-add-outline"
        fullWidth
        onPress={() => setInviting(true)}
        style={{ marginBottom: spacing.lg }}
      />
      <View style={{ gap: spacing.md }}>
        {ctx.inst.members.map((m) => {
          const t = ctx.teacher(m.teacher_id);
          const founder = m.teacher_id === ctx.inst.owner_teacher_id;
          return (
            <Card key={m.teacher_id}>
              <Row gap={spacing.md} align="flex-start">
                <Avatar
                  initials={t?.photo_initials ?? 'TF'}
                  gradient={teacherGradient(t ?? { avatar_bg: colors.primary })}
                  size={44}
                  ring={founder}
                />
                <View style={{ flex: 1 }}>
                  <AppText variant="subheading">{t?.name ?? 'Faculty member'}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {m.role}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {m.permission_level} · joined {m.joined_date}
                  </AppText>
                </View>
                {founder ? <Pill label="Founder" tone="gold" /> : null}
              </Row>
              <Row gap={5} wrap style={{ marginTop: spacing.md }}>
                {m.assigned_subjects.map((s) => (
                  <Pill key={s} label={s} tone="primary" />
                ))}
                {m.assigned_sections.map((s) => (
                  <Pill key={s} label={s} />
                ))}
              </Row>
              <Divider style={{ marginVertical: spacing.md }} />
              <Row gap={spacing.sm}>
                {t?.phone ? (
                  <Button label="Call" iconName="call-outline" size="sm" variant="secondary" onPress={() => callPhone(t.phone)} />
                ) : null}
                {t?.phone ? (
                  <Button
                    label="WhatsApp"
                    iconName="logo-whatsapp"
                    size="sm"
                    variant="secondary"
                    onPress={() => openWhatsApp(t.phone)}
                  />
                ) : null}
                <View style={{ flex: 1 }} />
                {!founder && m.teacher_id !== ctx.teacherId ? (
                  <Button
                    label="Remove"
                    iconName="trash-outline"
                    size="sm"
                    variant="ghost"
                    onPress={() => setRemoving(m.teacher_id)}
                  />
                ) : null}
              </Row>
            </Card>
          );
        })}
      </View>

      <InviteSheet instituteId={ctx.inst.id} instituteName={ctx.inst.name} visible={inviting} onClose={() => setInviting(false)} />
      <ConfirmSheet
        visible={Boolean(removing)}
        title={`Remove ${removingName}?`}
        message={`${removingName} will lose access to ${ctx.inst.name} and be unassigned from every section.`}
        onConfirm={() => {
          if (!removing) return;
          removeMember(ctx.inst.id, removing);
          toast(`${removingName} removed from ${ctx.inst.name}`, 'info');
        }}
        onClose={() => setRemoving(null)}
      />
    </View>
  );
}

const ROLES = ['Senior Faculty', 'Visiting Faculty', 'Assistant / Lab Mentor', 'Co-Director / Admin'];

function InviteSheet({
  instituteId,
  instituteName,
  visible,
  onClose,
}: {
  instituteId: string;
  instituteName: string;
  visible: boolean;
  onClose: () => void;
}) {
  const inviteMember = useAppStore((s) => s.inviteMember);
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [subjects, setSubjects] = useState('');
  const valid = name.trim().length > 2 && contact.trim().length > 5 && subjects.trim();

  return (
    <Sheet visible={visible} onClose={onClose} title="Invite a teacher" subtitle={`They join ${instituteName} as faculty`}>
      <View style={{ gap: spacing.lg }}>
        <FormField label="Full name" placeholder="e.g. Dr. Neha Kapoor" value={name} onChangeText={setName} />
        <FormField
          label="Email or phone"
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <ChoiceChips label="Role" options={ROLES.map((r) => ({ value: r, label: r }))} value={role} onChange={setRole} />
        <FormField
          label="Subjects"
          placeholder="Comma separated, e.g. Physics, Optics"
          value={subjects}
          onChangeText={setSubjects}
        />
        <Button
          label="Send invite"
          iconName="paper-plane-outline"
          fullWidth
          disabled={!valid}
          onPress={() => {
            inviteMember(instituteId, {
              name: name.trim(),
              contact: contact.trim(),
              role,
              subjects: subjects.split(',').map((s) => s.trim()).filter(Boolean),
            });
            toast(`Invited ${name.trim()} as ${role}`, 'success');
            setName('');
            setContact('');
            setSubjects('');
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

// ─── Notices & circulars ──────────────────────────────────────────────────────

const CATEGORIES: NoticeCategory[] = [
  'Important Circular',
  'Exam & Test Schedule',
  'Holiday & Vacation Notice',
  'General Announcement',
];

function Notices({ ctx }: { ctx: InstituteCtx }) {
  const deleteNotice = useAppStore((s) => s.deleteNotice);
  const { toast } = useToast();
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  return (
    <View>
      <Button label="Post a notice" iconName="megaphone-outline" fullWidth onPress={() => setPosting(true)} />
      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {ctx.inst.notices.length ? (
          ctx.inst.notices.map((n) => (
            <Card key={n.id}>
              <Row gap={5} wrap>
                <Pill label={n.category} tone={NOTICE_TONE[n.category]} icon={NOTICE_ICON[n.category]} />
                <Pill label={n.target} icon="people-outline" />
              </Row>
              <AppText variant="heading" style={{ marginTop: spacing.sm }}>
                {n.title}
              </AppText>
              <AppText variant="body" tone="secondary" style={{ marginTop: 4 }}>
                {n.body}
              </AppText>
              <Divider style={{ marginVertical: spacing.md }} />
              <Row justify="space-between" gap={spacing.md}>
                <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                  {formatDate(n.date)} · {n.author}
                </AppText>
                {ctx.isOwner ? (
                  <Button label="Delete" iconName="trash-outline" size="sm" variant="ghost" onPress={() => setDeleting(n.id)} />
                ) : null}
              </Row>
            </Card>
          ))
        ) : (
          <EmptyState icon="megaphone-outline" title="No notices yet" message="Broadcast circulars to students and faculty." />
        )}
      </View>

      <PostNoticeSheet instituteId={ctx.inst.id} visible={posting} onClose={() => setPosting(false)} />
      <ConfirmSheet
        visible={Boolean(deleting)}
        title="Delete this notice?"
        message="It disappears from every student's and teacher's notice board."
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deleting) return;
          deleteNotice(ctx.inst.id, deleting);
          toast('Notice deleted', 'info');
        }}
        onClose={() => setDeleting(null)}
      />
    </View>
  );
}

function PostNoticeSheet({ instituteId, visible, onClose }: { instituteId: string; visible: boolean; onClose: () => void }) {
  const postNotice = useAppStore((s) => s.postNotice);
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('General Announcement');
  const [target, setTarget] = useState('');
  const [body, setBody] = useState('');
  const valid = title.trim().length > 3 && body.trim().length > 5;

  return (
    <Sheet visible={visible} onClose={onClose} title="Post a notice" subtitle="Published to the institute notice board">
      <View style={{ gap: spacing.lg }}>
        <FormField label="Title" value={title} onChangeText={setTitle} />
        <ChoiceChips
          label="Category"
          options={CATEGORIES.map((c) => ({ value: c, label: c, icon: NOTICE_ICON[c] }))}
          value={category}
          onChange={setCategory}
        />
        <FormField label="Audience" placeholder="All Students & Faculty" value={target} onChangeText={setTarget} />
        <FormField
          label="Message"
          value={body}
          onChangeText={setBody}
          multiline
          style={{ minHeight: 110, textAlignVertical: 'top' }}
        />
        <Button
          label="Publish notice"
          iconName="megaphone-outline"
          fullWidth
          disabled={!valid}
          onPress={() => {
            postNotice(instituteId, { title: title.trim(), category, target: target.trim(), body: body.trim() });
            toast('Circular published to the notice board', 'success');
            setTitle('');
            setTarget('');
            setBody('');
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────

const TIER: Record<string, { label: string; tone: PillTone }> = {
  optimal: { label: 'Optimal', tone: 'success' },
  good: { label: 'Good', tone: 'warning' },
  critical: { label: 'Critical', tone: 'error' },
  empty: { label: 'No students', tone: 'neutral' },
};

function Analytics({ ctx, onOpen }: { ctx: InstituteCtx; onOpen: (s: CoachingSection) => void }) {
  const { colors } = useTheme();
  const a = useInstituteAnalytics(ctx.inst.id);
  if (!a) return null;

  return (
    <View>
      <Row gap={spacing.md} wrap>
        <StatTile label="Students" value={String(a.students)} sub={`${a.occupancy.toFixed(0)}% of ${a.capacity} seats`} tone="primary" />
        <StatTile
          label="Attendance"
          value={`${a.attendance.toFixed(1)}%`}
          sub="Average across scholars"
          tone={a.attendance >= 90 ? 'success' : a.attendance >= 80 ? 'warning' : 'error'}
        />
      </Row>
      <Row gap={spacing.md} wrap style={{ marginTop: spacing.md }}>
        <StatTile label="Faculty" value={String(a.faculty)} sub="Members incl. director" tone="gold" />
        <StatTile label="Lectures" value={`${a.lecturesPerWeek}/wk`} sub="Scheduled across sections" tone="info" />
      </Row>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Section health" subtitle="Occupancy and attendance per section" />
        <View style={{ gap: spacing.sm }}>
          {a.sections.map((s) => (
            <PressableCard key={s.section.id} onPress={() => onOpen(s.section)}>
              <Row justify="space-between">
                <AppText variant="subheading">{s.section.full_code}</AppText>
                <Pill label={TIER[s.tier].label} tone={TIER[s.tier].tone} />
              </Row>
              <Row justify="space-between" style={{ marginTop: spacing.sm, marginBottom: 5 }}>
                <AppText variant="caption" tone="muted">
                  {s.enrolled} of {s.section.capacity} seats
                </AppText>
                <AppText variant="caption" tone="muted">
                  {s.enrolled ? `${s.attendance.toFixed(0)}% attendance` : '—'}
                </AppText>
              </Row>
              <ProgressBar value={s.occupancy} color={colors.primary} />
            </PressableCard>
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Teaching load" subtitle="Weekly lectures by faculty" />
        <Card padded={false}>
          {a.load.map((l, idx) => (
            <View key={l.teacher?.id ?? idx}>
              {idx > 0 ? <Divider inset={spacing.lg} /> : null}
              <Row gap={spacing.md} style={{ padding: spacing.lg }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="subheading">{l.teacher?.name ?? 'Faculty'}</AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {l.subjects.join(' · ')}
                  </AppText>
                </View>
                <Pill label={`${l.lectures} lecs/wk`} tone="primary" />
              </Row>
            </View>
          ))}
        </Card>
      </View>
    </View>
  );
}

// ─── Institute profile ────────────────────────────────────────────────────────

function Profile({ ctx }: { ctx: InstituteCtx }) {
  const updateInstitute = useAppStore((s) => s.updateInstitute);
  const { toast } = useToast();
  const { inst } = ctx;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(inst.name);
  const [tagline, setTagline] = useState(inst.tagline);
  const [address, setAddress] = useState(inst.address);
  const [phone, setPhone] = useState(inst.phone);
  const [email, setEmail] = useState(inst.email);

  const share = async () => {
    const ok = await shareText(
      `Join ${inst.name} on Vilarci Study with admission code ${inst.code}.\nhttps://study.vilarci.in/join?institute=${inst.code}`,
    );
    if (!ok) toast(`Admission code: ${inst.code}`, 'info');
  };

  return (
    <View>
      <Card>
        <AppText variant="overline" tone="muted">
          ADMISSION CODE
        </AppText>
        <Row justify="space-between" style={{ marginTop: 4 }}>
          <AppText variant="metric" tone="primary" style={{ letterSpacing: 4 }}>
            {inst.code}
          </AppText>
          <Button label="Share" iconName="share-social-outline" size="sm" variant="secondary" onPress={share} />
        </Row>
        <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
          Students and teachers join this institute with the code.
        </AppText>
      </Card>

      {editing ? (
        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ gap: spacing.lg }}>
            <FormField label="Name" value={name} onChangeText={setName} />
            <FormField label="Tagline" value={tagline} onChangeText={setTagline} />
            <FormField label="Address" value={address} onChangeText={setAddress} multiline />
            <FormField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Row gap={spacing.sm}>
              <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} fullWidth />
              <Button
                label="Save"
                iconName="checkmark"
                disabled={name.trim().length < 3}
                onPress={() => {
                  updateInstitute(inst.id, {
                    name: name.trim(),
                    tagline: tagline.trim(),
                    address: address.trim(),
                    phone: phone.trim(),
                    email: email.trim(),
                  });
                  toast('Institute profile updated', 'success');
                  setEditing(false);
                }}
                style={{ flex: 1 }}
                fullWidth
              />
            </Row>
          </View>
        </Card>
      ) : (
        <Card style={{ marginTop: spacing.lg }}>
          <AppText variant="heading">{inst.name}</AppText>
          <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
            {inst.tagline}
          </AppText>
          <KeyValue label="Established" value={String(inst.established)} />
          <KeyValue label="Address" value={inst.address} />
          <KeyValue label="Phone" value={inst.phone || '—'} />
          <KeyValue label="Email" value={inst.email || '—'} />
          <KeyValue label="Your role" value={ctx.role} />
          {ctx.isOwner ? (
            <Button
              label="Edit profile"
              iconName="create-outline"
              variant="secondary"
              fullWidth
              onPress={() => setEditing(true)}
              style={{ marginTop: spacing.md }}
            />
          ) : null}
        </Card>
      )}

      {!ctx.isOwner ? (
        <Card muted style={{ marginTop: spacing.lg }}>
          <AppText variant="caption" tone="muted">
            Profile, faculty and section management are limited to the director. You can teach your assigned
            sections, post notices and view analytics.
          </AppText>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  well: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
});
