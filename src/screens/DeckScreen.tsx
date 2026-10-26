import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { useDeck } from '../lib/api/hooks';
import type { DeckRef } from '../lib/store/useAppStore';
import { AppText, Chip, IconName, Pill, Row } from '../components/ui/base';
import { Screen } from '../components/ui/Screen';
import { SidebarButton, type SidebarContext } from '../components/Sidebar';
import { classDayLabel, shortClock } from '../components/ClassDate';
import { StudentsView } from './deck/StudentsView';
import { ClassesView } from './deck/ClassesView';
import { AttendanceView } from './deck/AttendanceView';
import { HomeworkView } from './deck/HomeworkView';
import { PointsView } from './deck/PointsView';
import { TestsView } from './deck/TestsView';
import { SyllabusView } from './deck/SyllabusView';
import { FeesView } from './deck/FeesView';
import { SettingsView } from './deck/SettingsView';

export type DeckTab =
  | 'students'
  | 'classes'
  | 'attendance'
  | 'homework'
  | 'points'
  | 'tests'
  | 'syllabus'
  | 'fees'
  | 'settings';

export type DeckData = NonNullable<ReturnType<typeof useDeck>>;

/** Where a jump between views should land. */
export interface DeckFocus {
  studentId?: string;
  /** ISO date — opens attendance on that class. */
  date?: string;
  /** Opens the homework checker for this assignment. */
  homeworkId?: string;
}

/** Shared view contract: deck data plus a way to jump to a sibling view. */
export interface DeckViewProps {
  data: DeckData;
  goTo: (tab: DeckTab, focus?: DeckFocus) => void;
  focus: DeckFocus;
}

const TABS: { key: DeckTab; label: string; navIcon: IconName; navLabel: string }[] = [
  { key: 'students', label: 'Students', navIcon: 'people-outline', navLabel: 'Students roster' },
  { key: 'classes', label: 'Classes', navIcon: 'calendar-outline', navLabel: 'Class calendar' },
  { key: 'attendance', label: 'Attendance', navIcon: 'checkbox-outline', navLabel: 'Daily attendance & QR' },
  { key: 'homework', label: 'Homework', navIcon: 'book-outline', navLabel: 'Homework' },
  { key: 'points', label: 'Points', navIcon: 'ribbon-outline', navLabel: 'Points & honours' },
  { key: 'tests', label: 'Tests', navIcon: 'document-text-outline', navLabel: 'Tests & scorecards' },
  { key: 'syllabus', label: 'Syllabus', navIcon: 'library-outline', navLabel: 'Curriculum tracker' },
  { key: 'fees', label: 'Fees', navIcon: 'card-outline', navLabel: 'Tuition fees' },
  { key: 'settings', label: 'Settings', navIcon: 'settings-outline', navLabel: 'Batch settings' },
];

/**
 * The unified batch command deck. A private batch and a coaching section open
 * the same views — only the permissions differ.
 */
export function DeckScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params ?? {};
  const ref: DeckRef = { type: params.type, id: params.id, instituteId: params.instituteId };
  const data = useDeck(ref);
  const [tab, setTab] = useState<DeckTab>(params.tab ?? 'students');
  const [focus, setFocus] = useState<DeckFocus>({ date: params.date, homeworkId: params.homeworkId });

  // Re-entry from another screen with a requested view.
  useEffect(() => {
    if (params.tab) setTab(params.tab);
    setFocus({ date: params.date, homeworkId: params.homeworkId });
  }, [params.tab, params.date, params.homeworkId]);

  useEffect(() => {
    if (!data && navigation.canGoBack()) navigation.goBack();
  }, [data, navigation]);

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.bgApp }} />;
  const { deck } = data;

  const tabs = TABS.filter((t) => t.key !== 'settings' || deck.canEditSettings);
  const goTo = (next: DeckTab, nextFocus: DeckFocus = {}) => {
    setFocus(nextFocus);
    setTab(next);
  };
  const view: DeckViewProps = { data, goTo, focus };

  // Badges flag work waiting for the teacher, as well as plain counts.
  const badges: Partial<Record<DeckTab, number>> = {
    students: data.roster.length,
    attendance: data.unmarked.length || undefined,
    homework: data.homeworkToCheck.length || undefined,
    tests: data.tests.length,
  };

  const sidebar: SidebarContext = {
    overline: deck.contextLabel,
    title: deck.name,
    color: deck.color,
    active: tab,
    onSelect: (key) => goTo(key as DeckTab),
    items: tabs.map((t) => ({ key: t.key, label: t.navLabel, icon: t.navIcon, badge: badges[t.key] })),
  };

  const live = data.todayClass ?? data.nextClass;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Row gap={spacing.md} align="flex-start">
          <SidebarButton context={sidebar} />
          <View style={{ flex: 1 }}>
            <AppText variant="overline" tone="muted" numberOfLines={1}>
              {deck.contextLabel.toUpperCase()}
            </AppText>
            <AppText variant="heading" numberOfLines={2}>
              {deck.name}
            </AppText>
            <Row gap={5} wrap style={{ marginTop: 6 }}>
              <Pill label={`${deck.grade} · ${deck.board}`} tone="primary" />
              <Pill label={`${deck.studentIds.length}/${deck.capacity} seats`} icon="people-outline" />
              <Pill label={deck.joinCode} tone="success" icon="key-outline" />
            </Row>
          </View>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={deck.isPrivate ? 'Exit batch deck' : 'Back to institute'}
            hitSlop={10}
            style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="close" size={18} color={colors.textMain} />
          </Pressable>
        </Row>

        {live ? (
          <Pressable onPress={() => goTo('classes')} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Row gap={6} style={{ marginTop: spacing.sm, paddingLeft: 50 }}>
              <Ionicons
                name={data.todayClass ? 'radio-button-on' : 'calendar-clear-outline'}
                size={13}
                color={data.todayClass ? colors.success : colors.textMuted}
              />
              <AppText variant="captionStrong" tone={data.todayClass ? 'success' : 'secondary'}>
                {data.todayClass ? 'Class today' : `Next class ${classDayLabel(live.date, data.today)}`}
                {live.start ? ` · ${shortClock(live.start)}` : ''}
              </AppText>
              {live.kind === 'extra' ? <Pill label="Extra" tone="info" /> : null}
            </Row>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}
        >
          {tabs.map((t) => (
            <Chip
              key={t.key}
              label={
                (t.key === 'homework' || t.key === 'attendance') && badges[t.key]
                  ? `${t.label} · ${badges[t.key]}`
                  : t.label
              }
              icon={t.navIcon}
              selected={tab === t.key}
              onPress={() => goTo(t.key)}
            />
          ))}
        </ScrollView>
      </View>

      <Screen resetKey={tab}>
        {tab === 'students' ? <StudentsView {...view} /> : null}
        {tab === 'classes' ? <ClassesView {...view} /> : null}
        {tab === 'attendance' ? <AttendanceView {...view} /> : null}
        {tab === 'homework' ? <HomeworkView {...view} /> : null}
        {tab === 'points' ? <PointsView {...view} /> : null}
        {tab === 'tests' ? <TestsView {...view} /> : null}
        {tab === 'syllabus' ? <SyllabusView {...view} /> : null}
        {tab === 'fees' ? <FeesView {...view} /> : null}
        {tab === 'settings' && deck.canEditSettings ? <SettingsView {...view} /> : null}
      </Screen>
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
    marginTop: 2,
  },
  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth },
});
