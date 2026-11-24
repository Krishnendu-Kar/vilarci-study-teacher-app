import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { elevation, fonts, radius, spacing } from '../../theme/tokens';
import { accountName, useAuth } from '../../lib/AuthProvider';
import { signOut } from '../../lib/auth';
import { useTeacherProfile } from '../../lib/api/teacherProfile';
import { usePrivateBatches } from '../../lib/api/privateBatches';
import { realNavigationRef } from '../../navigation/realNavigationRef';
import { AppText, Avatar, IconName, Pill, Row } from '../ui/base';
import { useToast } from '../ui/Toast';
import { BrandMark } from './BrandMark';

/** A bottom tab, and optionally a screen inside that tab's stack. */
interface Target {
  tab: 'Home' | 'Batches' | 'Institutes' | 'More';
  screen?: string;
  params?: Record<string, unknown>;
}

interface MenuItem {
  label: string;
  icon: IconName;
  /** Real screen to open; absent = not built yet → "Coming soon". */
  to?: Target;
  badge?: string;
}

/** The first screen of each tab's stack; anything else opens on top of it. */
const STACK_ROOTS = ['TeacherHome', 'BatchList', 'MoreHub'];

/** Only what a teacher reaches for; the rest of the plan lives in the demo. */
const SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'TEACHING',
    items: [
      { label: 'Home', icon: 'home-outline', to: { tab: 'Home', screen: 'TeacherHome' } },
      { label: 'Private batches', icon: 'people-outline', to: { tab: 'Batches', screen: 'BatchList' } },
      { label: 'Coaching institutes', icon: 'business-outline', to: { tab: 'Institutes' }, badge: 'Soon' },
    ],
  },
  {
    title: 'CLASSROOM',
    items: [
      { label: 'Attendance', icon: 'checkmark-done-outline' },
      { label: 'Tests & marks', icon: 'document-text-outline' },
      { label: 'Homework', icon: 'create-outline' },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { label: 'My account', icon: 'person-circle-outline', to: { tab: 'More', screen: 'Account' } },
      { label: 'Teacher profile', icon: 'school-outline', to: { tab: 'More', screen: 'TeacherProfileForm' } },
      { label: 'Honours log', icon: 'trophy-outline' },
      { label: 'Help & Support', icon: 'help-buoy-outline' },
    ],
  },
];

/** How many batches the menu lists for a quick jump; "Private batches" has them all. */
const JUMP_BATCHES = 5;

function navigateTo(t: Target) {
  realNavigationRef.navigate(
    t.tab,
    t.screen ? { screen: t.screen, params: t.params, initial: STACK_ROOTS.includes(t.screen) } : undefined,
  );
}

const RealSideMenuContext = createContext<{ open: () => void } | null>(null);

export function useRealSideMenu() {
  const ctx = useContext(RealSideMenuContext);
  if (!ctx) throw new Error('useRealSideMenu must be used inside <RealSideMenuProvider>');
  return ctx;
}

export function RealSideMenuProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<Active>({});

  const open = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    const current = realNavigationRef.isReady() ? realNavigationRef.getCurrentRoute() : undefined;
    const params = current?.params as { title?: string; id?: string } | undefined;
    setActive({ route: current?.name, title: params?.title, id: params?.id });
    setVisible(true);
  }, []);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <RealSideMenuContext.Provider value={value}>
      {children}
      <Drawer visible={visible} active={active} onClosed={() => setVisible(false)} />
    </RealSideMenuContext.Provider>
  );
}

/** ☰ trigger for real-app screens. */
export function RealMenuButton() {
  const { colors } = useTheme();
  const { open } = useRealSideMenu();
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          opacity: pressed ? 0.6 : 1,
          ...elevation(1, colors.shadowColor, colors.shadowOpacity),
        },
      ]}
    >
      <Ionicons name="menu" size={20} color={colors.textMain} />
    </Pressable>
  );
}

/** The screen the menu was opened from, to highlight its row. */
interface Active {
  route?: string;
  title?: string;
  id?: string;
}

function Drawer({ visible, active, onClosed }: { visible: boolean; active: Active; onClosed: () => void }) {
  const { colors, isDark, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(320, screenWidth * 0.84);
  const toast = useToast();
  const { session, profile, enterDemo } = useAuth();
  const teacher = useTeacherProfile();
  const batches = usePrivateBatches().data ?? [];

  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const after = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!visible) return;
    drag.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, progress, drag]);

  const close = useCallback(
    (then?: () => void) => {
      after.current = then ?? null;
      Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
        onClosed();
        after.current?.();
        after.current = null;
      });
    },
    [progress, onClosed],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => drag.setValue(Math.min(0, g.dx)),
        onPanResponderRelease: (_, g) => {
          if (g.dx < -width * 0.3 || g.vx < -0.5) close();
          else Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [drag, width, close],
  );

  const goTo = (t: Target) => close(() => realNavigationRef.isReady() && navigateTo(t));

  const go = (item: MenuItem) =>
    goTo(item.to ?? { tab: 'More', screen: 'ComingSoon', params: { title: item.label, icon: item.icon } });

  const isActive = (item: MenuItem) =>
    item.to
      ? (item.to.screen ?? item.to.tab) === active.route
      : active.route === 'ComingSoon' && active.title === item.label;

  const translateX = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }), drag);
  const name = accountName(profile, session);
  const initials = `${profile?.first_name?.[0] ?? name[0] ?? 'V'}${profile?.last_name?.[0] ?? ''}`.toUpperCase();
  const t = teacher.data;
  const noTeacherProfile = !teacher.isLoading && !teacher.isError && !t;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => close()}
      statusBarTranslucent
      // Draw under the Android navigation bar too, so the safe-area bottom
      // padding below lines the footer up above it instead of being clipped.
      navigationBarTranslucent
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width,
          backgroundColor: colors.bgApp,
          borderTopRightRadius: radius.xl,
          borderBottomRightRadius: radius.xl,
          overflow: 'hidden',
          transform: [{ translateX }],
          ...elevation(3, colors.shadowColor, colors.shadowOpacity + 0.1),
        }}
      >
        {/* ── Who's signed in ─────────────────────────────────────────── */}
        <LinearGradient
          colors={colors.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
        >
          <Row justify="space-between" style={{ marginBottom: spacing.md }}>
            <Row gap={spacing.sm}>
              <BrandMark size={30} />
              <AppText variant="subheading" style={{ color: '#FDFBF9' }}>
                Vilarci Teacher
              </AppText>
            </Row>
            <Pressable
              onPress={() => close()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(253,251,249,0.14)' }}
            >
              <Ionicons name="close" size={18} color="#FDFBF9" />
            </Pressable>
          </Row>

          <Pressable
            onPress={() => goTo({ tab: 'More', screen: 'Account' })}
            accessibilityRole="button"
            accessibilityLabel="My account"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: pressed ? 0.7 : 1 })}
          >
            <Avatar initials={initials} gradient={['#5a0812', '#8E1437']} size={48} ring />
            <View style={{ flex: 1 }}>
              <AppText variant="title" numberOfLines={1} style={{ color: '#FDFBF9' }}>
                {name}
              </AppText>
              <AppText variant="caption" numberOfLines={1} style={{ color: 'rgba(253,251,249,0.7)' }}>
                {t
                  ? [t.primary_subject, t.qualification].filter(Boolean).join(' · ')
                  : profile?.email ?? profile?.whatsapp_number ?? 'Your Vilarci account'}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={15} color="rgba(253,251,249,0.6)" />
          </Pressable>

          {noTeacherProfile ? (
            <Pressable
              onPress={() => goTo({ tab: 'More', screen: 'TeacherProfileForm' })}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginTop: spacing.md,
                paddingVertical: 8,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: 'rgba(253,251,249,0.14)',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="school-outline" size={16} color={colors.goldBright} />
              <AppText variant="captionStrong" style={{ flex: 1, color: colors.goldBright }}>
                Create your teacher profile
              </AppText>
              <Ionicons name="chevron-forward" size={14} color={colors.goldBright} />
            </Pressable>
          ) : null}
        </LinearGradient>

        {/* ── Navigation ──────────────────────────────────────────────── */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
          {SECTIONS.map((section) => (
            <View key={section.title} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
              <AppText variant="overline" tone="muted" style={{ paddingHorizontal: spacing.sm, marginBottom: 4 }}>
                {section.title}
              </AppText>
              {section.items.map((item) => {
                const on = isActive(item);
                const ready = Boolean(item.to);
                const count = item.to?.screen === 'BatchList' && batches.length ? String(batches.length) : undefined;
                return (
                  <NavRow
                    key={item.label}
                    label={item.label}
                    icon={item.icon}
                    on={on}
                    ready={ready}
                    onPress={() => go(item)}
                    right={
                      count ? (
                        <CountBadge value={count} on={on} />
                      ) : item.badge ? (
                        <Pill label={item.badge} tone="gold" />
                      ) : ready ? null : (
                        <Pill label="Soon" tone="neutral" />
                      )
                    }
                  />
                );
              })}
            </View>
          ))}

          {/* ── Jump straight into a batch ─────────────────────────────── */}
          {batches.length ? (
            <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
              <AppText variant="overline" tone="muted" style={{ paddingHorizontal: spacing.sm, marginBottom: 4 }}>
                MY BATCHES
              </AppText>
              {batches.slice(0, JUMP_BATCHES).map((b) => {
                const on = active.route === 'BatchDetail' && active.id === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => goTo({ tab: 'Batches', screen: 'BatchDetail', params: { id: b.id } })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [
                      styles.row,
                      { backgroundColor: on ? colors.primarySubtle : pressed ? colors.surfaceMuted : 'transparent' },
                    ]}
                  >
                    {on ? <View style={[styles.activeBar, { backgroundColor: colors.primary }]} /> : null}
                    <View style={[styles.batchMark, { backgroundColor: on ? colors.primary : colors.primarySubtle }]}>
                      <AppText style={{ fontFamily: fonts.sansBold, fontSize: 12, color: on ? '#fff' : colors.primary }}>
                        {b.name.trim()[0]?.toUpperCase() ?? '•'}
                      </AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="captionStrong" numberOfLines={1} style={{ fontSize: 13.5, color: on ? colors.primary : colors.textMain }}>
                        {b.name}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {[b.subject, b.grade].filter(Boolean).join(' · ')}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Inside the scroll area so it can always be reached, however
              small the screen or long the batch list. */}
          <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
            <Pressable
              onPress={() => close(() => signOut().catch((err) => toast.toast((err as Error)?.message || 'Couldn’t log out. Try again.', 'error')))}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: 12,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.errorBg,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="log-out-outline" size={19} color={colors.errorText} />
              <AppText variant="bodyStrong" style={{ flex: 1, fontSize: 14, color: colors.errorText }}>
                Log out
              </AppText>
            </Pressable>
          </View>
        </ScrollView>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          <Row gap={spacing.sm}>
            <FooterButton icon="play-circle-outline" label="Open demo" onPress={() => close(enterDemo)} />
            <FooterButton
              icon={isDark ? 'sunny-outline' : 'moon-outline'}
              label={isDark ? 'Light' : 'Dark'}
              onPress={() => setMode(isDark ? 'light' : 'dark')}
            />
          </Row>
        </View>
      </Animated.View>
    </Modal>
  );
}

function NavRow({
  label,
  icon,
  on,
  ready,
  right,
  onPress,
}: {
  label: string;
  icon: IconName;
  on: boolean;
  ready: boolean;
  right: React.ReactNode;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: on ? colors.primarySubtle : pressed ? colors.surfaceMuted : 'transparent' },
      ]}
    >
      {on ? <View style={[styles.activeBar, { backgroundColor: colors.primary }]} /> : null}
      <Ionicons
        name={on ? (icon.replace('-outline', '') as IconName) : icon}
        size={19}
        color={on ? colors.primary : ready ? colors.textSecondary : colors.textMuted}
      />
      <AppText
        variant={on ? 'captionStrong' : 'bodyStrong'}
        style={{ flex: 1, fontSize: 14, color: on ? colors.primary : ready ? colors.textMain : colors.textSecondary }}
      >
        {label}
      </AppText>
      {right}
    </Pressable>
  );
}

function CountBadge({ value, on }: { value: string; on: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.count, { backgroundColor: on ? colors.primary : colors.surfaceAlt }]}>
      <AppText style={{ fontFamily: fonts.sansSemibold, fontSize: 11, color: on ? '#fff' : colors.textSecondary }}>{value}</AppText>
    </View>
  );
}

function FooterButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const fg = colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceMuted,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={15} color={fg} />
      <AppText variant="captionStrong" style={{ color: fg }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  activeBar: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
  batchMark: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
