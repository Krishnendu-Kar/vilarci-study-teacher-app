import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { elevation, fonts, radius, spacing } from '../../theme/tokens';

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'success' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { py: number; px: number; font: number; icon: number }> = {
  sm: { py: 9, px: spacing.md, font: 12.5, icon: 13 },
  md: { py: 13, px: spacing.lg, font: 14.5, icon: 15 },
  lg: { py: 16, px: spacing.xl, font: 15.5, icon: 17 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  iconName,
  disabled,
  loading,
  fullWidth,
  haptic = true,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const s = SIZES[size];

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  const gradientVariant = variant === 'primary' || variant === 'gold';
  const gradientColors =
    variant === 'gold' ? colors.goldGradient : colors.primaryGradient;

  const flat: Record<'secondary' | 'ghost' | 'success' | 'danger', { bg: string; fg: string; border: string }> = {
    secondary: { bg: colors.surface, fg: colors.textMain, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    success: { bg: colors.success, fg: '#fff', border: colors.success },
    danger: { bg: colors.error, fg: '#fff', border: colors.error },
  };

  const content = (fg: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {iconName ? <Ionicons name={iconName} size={s.icon} color={fg} /> : null}
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: s.font, color: fg, letterSpacing: -0.1 }}>
            {label}
          </Text>
        </>
      )}
    </View>
  );

  if (gradientVariant) {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          {
            borderRadius: radius.md,
            opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
          },
          style,
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.md,
            paddingVertical: s.py,
            paddingHorizontal: s.px,
            ...elevation(1, colors.shadowColor, colors.shadowOpacity + 0.08),
          }}
        >
          {content('#FFFFFF')}
        </LinearGradient>
      </Pressable>
    );
  }

  const p = flat[variant as keyof typeof flat];
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderRadius: radius.md,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {content(p.fg)}
    </Pressable>
  );
}
