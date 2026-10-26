import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { VILARCI_LOGO_URL } from '../../lib/auth';
import { AppText, IconName, Row } from '../ui/base';

const ON_DARK = '#FDFBF9';
const ON_DARK_SOFT = 'rgba(253,251,249,0.72)';

/** Phones narrower than this get tighter padding and a smaller hero. */
const SMALL_WIDTH = 380;

export function useSmallScreen() {
  return useWindowDimensions().width < SMALL_WIDTH;
}

// ─── Brand mark ───────────────────────────────────────────────────────────────

/** The official Vilarci logo on a light tile, with a spinner while it loads. */
export function BrandMark({ size = 64 }: { size?: number }) {
  const { colors } = useTheme();
  const [loaded, setLoaded] = useState(false);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(253,251,249,0.5)',
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
      }}
    >
      <Image
        source={{ uri: VILARCI_LOGO_URL }}
        style={{ width: size * 0.82, height: size * 0.82 }}
        resizeMode="contain"
        onLoad={() => setLoaded(true)}
        accessibilityLabel="Vilarci"
      />
      {loaded ? null : <ActivityIndicator color={colors.primary} style={StyleSheet.absoluteFill} />}
    </View>
  );
}

// ─── Hero header ──────────────────────────────────────────────────────────────

/** Wine gradient header with the brand mark; the card overlaps its base. */
export function AuthHero({
  title,
  subtitle,
  onBack,
  compact,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const small = useSmallScreen();
  return (
    <LinearGradient
      colors={colors.heroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingTop: insets.top + (small ? spacing.sm : spacing.md),
        paddingHorizontal: small ? spacing.lg : spacing.xl,
        paddingBottom: compact ? spacing.xxl + spacing.lg : small ? 60 : 72,
        borderBottomLeftRadius: radius.xl,
        borderBottomRightRadius: radius.xl,
        alignItems: 'center',
      }}
    >
      <Row justify="space-between" style={{ alignSelf: 'stretch', minHeight: 38 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.heroBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="arrow-back" size={19} color={ON_DARK} />
          </Pressable>
        ) : (
          <View style={{ width: 38 }} />
        )}
        <View style={{ width: 38 }} />
      </Row>
      {compact ? null : <BrandMark size={small ? 60 : 72} />}
      <AppText
        variant={small ? 'title' : 'display'}
        center
        style={{ color: ON_DARK, marginTop: compact ? 0 : small ? spacing.md : spacing.lg }}
      >
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" center style={{ color: ON_DARK_SOFT, marginTop: 4, maxWidth: 300 }}>
          {subtitle}
        </AppText>
      ) : null}
    </LinearGradient>
  );
}

/** Card that overlaps the hero's rounded base. */
export function AuthCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const small = useSmallScreen();
  return (
    <View
      style={{
        marginHorizontal: small ? spacing.md : spacing.lg,
        marginTop: small ? -40 : -48,
        padding: small ? spacing.lg : spacing.xl,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        shadowColor: colors.shadowColor,
        shadowOpacity: colors.shadowOpacity + 0.06,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      {children}
    </View>
  );
}

// ─── Banner for form-level errors ─────────────────────────────────────────────

export function ErrorBanner({ message, tone = 'error' }: { message: string | null; tone?: 'error' | 'info' }) {
  const { colors } = useTheme();
  if (!message) return null;
  const fg = tone === 'error' ? colors.errorText : colors.infoText;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: tone === 'error' ? colors.errorBg : colors.infoBg,
        marginBottom: spacing.lg,
      }}
    >
      <Ionicons name={tone === 'error' ? 'alert-circle' : 'information-circle'} size={17} color={fg} />
      <AppText variant="caption" style={{ color: fg, flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}

// ─── Selectable option card ───────────────────────────────────────────────────

export function OptionCard({
  icon,
  title,
  subtitle,
  selected,
  onPress,
  note,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  note?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySubtle : colors.surface,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? colors.primary : colors.surfaceMuted,
        }}
      >
        <Ionicons name={icon} size={21} color={selected ? '#fff' : colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="subheading" style={{ color: selected ? colors.primary : colors.textMain }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: 1 }}>
            {subtitle}
          </AppText>
        ) : null}
        {note ? (
          <AppText variant="caption" tone="gold" style={{ marginTop: 3 }}>
            {note}
          </AppText>
        ) : null}
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: selected ? 0 : 1.5,
          borderColor: colors.borderStrong,
          backgroundColor: selected ? colors.primary : 'transparent',
        }}
      >
        {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253,251,249,0.16)',
  },
});
