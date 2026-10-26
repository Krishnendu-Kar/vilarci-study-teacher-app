import React, { forwardRef, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { passwordChecks } from '../../lib/auth';
import { AppText, IconName, Row } from '../ui/base';

const ON_DARK = '#FDFBF9';

/** Phones narrower than this get tighter padding and a smaller hero. */
const SMALL_WIDTH = 380;

function useSmallScreen() {
  return useWindowDimensions().width < SMALL_WIDTH;
}
const ON_DARK_SOFT = 'rgba(253,251,249,0.72)';

// ─── Brand mark ───────────────────────────────────────────────────────────────

export function BrandMark({ size = 64 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={colors.goldGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(253,251,249,0.35)',
      }}
    >
      <AppText style={{ fontFamily: fonts.displayBold, fontSize: size * 0.52, lineHeight: size * 0.62, color: '#3B0A1A' }}>
        V
      </AppText>
    </LinearGradient>
  );
}

// ─── Hero header ──────────────────────────────────────────────────────────────

/** Wine gradient header with the brand mark; the form card overlaps its base. */
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
      {compact ? null : <BrandMark size={small ? 52 : 64} />}
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

/** White card that overlaps the hero's rounded base. */
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

// ─── Text field ───────────────────────────────────────────────────────────────

export const AuthField = forwardRef<
  TextInput,
  TextInputProps & {
    label: string;
    icon?: IconName;
    error?: string;
    prefix?: string;
    optional?: boolean;
  }
>(function AuthField({ label, icon, error, prefix, optional, secureTextEntry, style, onFocus, onBlur, ...props }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.error : focused ? colors.primary : colors.border;

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Row justify="space-between" style={{ marginBottom: 6 }}>
        <AppText variant="overline" tone={error ? 'error' : focused ? 'primary' : 'muted'}>
          {label.toUpperCase()}
        </AppText>
        {optional ? (
          <AppText variant="caption" tone="muted">
            Optional
          </AppText>
        ) : null}
      </Row>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          overflow: 'hidden',
          borderRadius: radius.md,
          borderWidth: focused || error ? 1.5 : StyleSheet.hairlineWidth,
          borderColor,
          backgroundColor: focused ? colors.surface : colors.surfaceMuted,
        }}
      >
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.textMuted} /> : null}
        {prefix ? (
          <AppText variant="bodyStrong" tone="secondary">
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry && hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              minWidth: 0,
              paddingVertical: 14,
              color: colors.textMain,
              fontSize: 15,
              fontFamily: fonts.sans,
            },
            style,
          ]}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={{ flexShrink: 0 }}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Row gap={5} style={{ marginTop: 6 }}>
          <Ionicons name="alert-circle" size={13} color={colors.error} />
          <AppText variant="caption" tone="error" style={{ flex: 1 }}>
            {error}
          </AppText>
        </Row>
      ) : null}
    </View>
  );
});

// ─── Banner for form-level errors ─────────────────────────────────────────────

export function ErrorBanner({ message }: { message: string | null }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.errorBg,
        marginBottom: spacing.lg,
      }}
    >
      <Ionicons name="alert-circle" size={17} color={colors.errorText} />
      <AppText variant="caption" style={{ color: colors.errorText, flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}

// ─── Password checklist ───────────────────────────────────────────────────────

export function PasswordRules({ password }: { password: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 5, marginTop: -spacing.sm, marginBottom: spacing.lg }}>
      {passwordChecks(password).map((c) => (
        <Row key={c.key} gap={7}>
          <Ionicons
            name={c.ok ? 'checkmark-circle' : 'ellipse-outline'}
            size={14}
            color={c.ok ? colors.success : colors.textMuted}
          />
          <AppText variant="caption" style={{ color: c.ok ? colors.successText : colors.textMuted }}>
            {c.label}
          </AppText>
        </Row>
      ))}
    </View>
  );
}

// ─── OTP boxes ────────────────────────────────────────────────────────────────

/** Six boxes backed by one hidden input, so paste and SMS autofill just work. */
export function OtpInput({
  value,
  onChange,
  length = 6,
  error,
}: {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  error?: boolean;
}) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(true);

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Verification code">
      <Row gap={spacing.sm} justify="center">
        {Array.from({ length }).map((_, i) => {
          const char = value[i] ?? '';
          const active = focused && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                maxWidth: 48,
                height: 56,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: active || error ? 1.5 : StyleSheet.hairlineWidth,
                borderColor: error ? colors.error : active ? colors.primary : char ? colors.borderStrong : colors.border,
                backgroundColor: char ? colors.surface : colors.surfaceMuted,
              }}
            >
              <AppText style={{ fontFamily: fonts.sansBold, fontSize: 22, color: colors.textMain }}>{char}</AppText>
            </View>
          );
        })}
      </Row>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
    </Pressable>
  );
}

// ─── Selectable option card ───────────────────────────────────────────────────

export function OptionCard({
  icon,
  title,
  subtitle,
  selected,
  onPress,
  disabledNote,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  disabledNote?: string;
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
        {disabledNote ? (
          <AppText variant="caption" tone="gold" style={{ marginTop: 3 }}>
            {disabledNote}
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
