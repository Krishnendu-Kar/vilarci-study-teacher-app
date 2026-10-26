import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius, spacing } from '../theme/tokens';
import { useMyBatches, useMyInstitutes, useTeacher } from '../lib/api/hooks';
import { AppText, Avatar, CenterMark, Divider, Row } from './ui/base';
import { AccountSheet, teacherGradient } from './AccountSheet';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface SidebarItem {
  key: string;
  label: string;
  icon: IconName;
  badge?: string | number;
}

/** The current workspace's own sections, shown first — like the portal's deck sidebar. */
export interface SidebarContext {
  overline: string;
  title: string;
  color?: string;
  items: SidebarItem[];
  active: string;
  onSelect: (key: string) => void;
}

/**
 * Top-left hamburger that opens the app-wide sidebar: the mobile port of the
 * partner portal's left sidebar. Every main header renders one.
 */
export function SidebarButton({ context }: { context?: SidebarContext }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        hitSlop={10}
        style={({ pressed }) => [
          styles.trigger,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Ionicons name="menu" size={20} color={colors.textMain} />
      </Pressable>
      <Sidebar visible={open} onClose={() => setOpen(false)} context={context} />
    </>
  );
}

function Sidebar({ visible, onClose, context }: { visible: boolean; onClose: () => void; context?: SidebarContext }) {
  const { colors, isDark, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const teacher = useTeacher();
  const batches = useMyBatches();
  const institutes = useMyInstitutes();
  const [mounted, setMounted] = useState(visible);
  const [switching, setSwitching] = useState(false);
  const panelWidth = Math.min(320, width * 0.86);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 230 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  // Which tab the drawer was opened from, to highlight it.
  const tabName: string | undefined = (() => {
    const tabs = navigation.getParent?.()?.getState?.();
    return tabs?.routes?.[tabs.index]?.name;
  })();

  const go = (fn: () => void) => {
    onClose();
    // Let the panel start closing before the screen transition kicks in.
    setTimeout(fn, 60);
  };

  const workspace: (SidebarItem & { tab: string; screen?: string })[] = [
    { key: 'today', label: 'Today', icon: 'today-outline', tab: 'Today' },
    { key: 'batches', label: 'My private batches', icon: 'people-outline', tab: 'Batches', badge: batches.length },
    { key: 'institutes', label: 'Coaching institutes', icon: 'business-outline', tab: 'Institutes', badge: institutes.length },
    { key: 'honours', label: 'Honours log', icon: 'ribbon-outline', tab: 'More', screen: 'HonoursLog' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline', tab: 'More', screen: 'Settings' },
    { key: 'help', label: 'Help & support', icon: 'help-buoy-outline', tab: 'More', screen: 'Help' },
  ];

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            backgroundColor: colors.bgApp,
            borderRightColor: colors.border,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth, 0] }) }],
          },
        ]}
      >
        {/* ── Educator identity ─────────────────────────────────────────────── */}
        <View style={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <Row justify="space-between" align="flex-start">
            <AppText variant="title">
              Vilarci <AppText variant="title" tone="primary">Teacher</AppText>
            </AppText>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close menu" style={styles.close}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </Row>
          <Pressable
            onPress={() => setSwitching(true)}
            style={({ pressed }) => [
              styles.identity,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Avatar initials={teacher.photo_initials} gradient={teacherGradient(teacher)} size={40} ring />
            <View style={{ flex: 1 }}>
              <AppText variant="subheading" numberOfLines={1}>
                {teacher.name}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {teacher.primary_subject} specialist
              </AppText>
            </View>
            <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          {/* ── Current workspace (deck views / institute sections) ─────────── */}
          {context ? (
            <View style={[styles.contextBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row gap={spacing.sm} style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
                <View style={[styles.dot, { backgroundColor: context.color ?? colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <AppText variant="overline" tone="muted" numberOfLines={1}>
                    {context.overline.toUpperCase()}
                  </AppText>
                  <AppText variant="subheading" numberOfLines={2}>
                    {context.title}
                  </AppText>
                </View>
              </Row>
              {context.items.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  active={item.key === context.active}
                  onPress={() => {
                    context.onSelect(item.key);
                    onClose();
                  }}
                />
              ))}
            </View>
          ) : null}

          {/* ── Workspace ───────────────────────────────────────────────────── */}
          <SectionLabel text="Workspace" />
          {workspace.map((item) => (
            <NavRow
              key={item.key}
              item={item}
              active={!context && !item.screen && item.tab === tabName}
              onPress={() =>
                go(() =>
                  item.screen
                    ? navigation.navigate(item.tab, { screen: item.screen, initial: false })
                    : navigation.navigate(item.tab, { screen: `${item.tab}Home` }),
                )
              }
            />
          ))}

          {/* ── Jump straight into a batch ──────────────────────────────────── */}
          {batches.length ? <SectionLabel text="My batches" /> : null}
          {batches.map((b) => (
            <JumpRow
              key={b.id}
              title={b.name}
              meta={`${b.grade} · ${b.student_ids.length} student${b.student_ids.length === 1 ? '' : 's'}`}
              mark={<View style={[styles.batchMark, { backgroundColor: colors.primarySubtle }]}>
                <AppText style={{ fontFamily: fonts.sansBold, fontSize: 11, color: colors.primary }}>
                  {b.grade.replace(/\D/g, '') || '•'}
                </AppText>
              </View>}
              onPress={() =>
                go(() =>
                  navigation.navigate('Batches', {
                    screen: 'Deck',
                    params: { type: 'private_batch', id: b.id, tab: 'students' },
                    initial: false,
                  }),
                )
              }
            />
          ))}

          {/* ── Jump into an institute ──────────────────────────────────────── */}
          {institutes.length ? <SectionLabel text="My institutes" /> : null}
          {institutes.map((inst) => (
            <JumpRow
              key={inst.id}
              title={inst.name}
              meta={`Code ${inst.code} · ${inst.classes_sections.length} sections`}
              mark={<CenterMark text={inst.logo_text} color={inst.theme_color} size={30} />}
              onPress={() =>
                go(() => navigation.navigate('Institutes', { screen: 'Institute', params: { id: inst.id }, initial: false }))
              }
            />
          ))}
        </ScrollView>

        {/* ── Footer: quick appearance toggle ────────────────────────────────── */}
        <Divider />
        <Pressable
          onPress={() => setMode(isDark ? 'light' : 'dark')}
          style={({ pressed }) => [
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, spacing.md), opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.textSecondary} />
          <AppText variant="captionStrong" tone="secondary">
            {isDark ? 'Light mode' : 'Dark mode'}
          </AppText>
        </Pressable>
      </Animated.View>

      <AccountSheet visible={switching} onClose={() => setSwitching(false)} />
    </Modal>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <AppText variant="overline" tone="muted" style={{ marginTop: spacing.lg, marginBottom: 4, paddingHorizontal: spacing.sm }}>
      {text.toUpperCase()}
    </AppText>
  );
}

function NavRow({ item, active, onPress }: { item: SidebarItem; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.navRow,
        { backgroundColor: active ? colors.primarySubtle : pressed ? colors.surfaceMuted : 'transparent' },
      ]}
    >
      {active ? <View style={[styles.activeBar, { backgroundColor: colors.primary }]} /> : null}
      <Ionicons name={item.icon} size={19} color={active ? colors.primary : colors.textSecondary} />
      <AppText
        variant={active ? 'subheading' : 'bodyStrong'}
        style={{ flex: 1, color: active ? colors.primary : colors.textMain }}
        numberOfLines={1}
      >
        {item.label}
      </AppText>
      {item.badge != null ? (
        <View style={[styles.badge, { backgroundColor: active ? colors.primary : colors.surfaceAlt }]}>
          <AppText style={{ fontFamily: fonts.sansSemibold, fontSize: 11, color: active ? '#fff' : colors.textSecondary }}>
            {item.badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

function JumpRow({ title, meta, mark, onPress }: { title: string; meta: string; mark: React.ReactNode; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' }]}
    >
      {mark}
      <View style={{ flex: 1 }}>
        <AppText variant="captionStrong" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {meta}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
  },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  contextBox: {
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  activeBar: { position: 'absolute', left: 0, top: 9, bottom: 9, width: 3, borderRadius: 2 },
  badge: { minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  batchMark: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
});
