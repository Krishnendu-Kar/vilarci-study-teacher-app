import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { elevation, fonts, radius, spacing } from '../../theme/tokens';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Typography ───────────────────────────────────────────────────────────────

type TextTone =
  | 'main'
  | 'secondary'
  | 'muted'
  | 'primary'
  | 'gold'
  | 'success'
  | 'error'
  | 'onDark';

type TextVariant =
  | 'displayXl'
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'captionStrong'
  | 'overline'
  | 'metricXl'
  | 'metric'
  | 'metricSm';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  center?: boolean;
}

const VARIANTS: Record<TextVariant, TextStyle> = {
  displayXl: { fontFamily: fonts.displayBold, fontSize: 38, lineHeight: 44, letterSpacing: -0.6 },
  display: { fontFamily: fonts.display, fontSize: 29, lineHeight: 36, letterSpacing: -0.3 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 29, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.sansBold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 21 },
  caption: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18 },
  captionStrong: { fontFamily: fonts.sansSemibold, fontSize: 12.5, lineHeight: 18 },
  overline: { fontFamily: fonts.sansSemibold, fontSize: 10, lineHeight: 14, letterSpacing: 1.4 },
  metricXl: { fontFamily: fonts.sansBold, fontSize: 40, lineHeight: 46, letterSpacing: -1.6 },
  metric: { fontFamily: fonts.sansBold, fontSize: 28, lineHeight: 34, letterSpacing: -1 },
  metricSm: { fontFamily: fonts.sansBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.6 },
};

export function AppText({ variant = 'body', tone = 'main', center, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const toneColor: Record<TextTone, string> = {
    main: colors.textMain,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    primary: colors.primary,
    gold: colors.gold,
    success: colors.successText,
    error: colors.errorText,
    onDark: colors.textOnDark,
  };
  return (
    <Text
      style={[VARIANTS[variant], { color: toneColor[tone] }, center && { textAlign: 'center' }, style]}
      {...rest}
    />
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────────

export function Row({
  gap = spacing.sm,
  align = 'center',
  justify,
  wrap,
  style,
  ...rest
}: ViewProps & {
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: align, justifyContent: justify, gap },
        wrap && { flexWrap: 'wrap' },
        style,
      ]}
      {...rest}
    />
  );
}

export function Spacer({ size = spacing.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function Divider({ style, inset = 0 }: { style?: StyleProp<ViewStyle>; inset?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: inset },
        style,
      ]}
    />
  );
}

// ─── Icon bubble ──────────────────────────────────────────────────────────────

export function IconBubble({
  name,
  tint,
  bg,
  size = 40,
}: {
  name?: IconName;
  tint?: string;
  bg?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: bg ?? colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name ?? 'ellipse-outline'} size={size * 0.5} color={tint ?? colors.textSecondary} />
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps extends ViewProps {
  padded?: boolean;
  /** Accent colour — drawn as a restrained rounded bar on the leading edge. */
  rail?: string;
  accentColor?: string;
  muted?: boolean;
  level?: 0 | 1 | 2 | 3;
}

export function Card({
  padded = true,
  rail,
  accentColor,
  muted,
  level = 1,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: muted ? colors.surfaceMuted : colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: accentColor ?? colors.border,
        },
        elevation(level, colors.shadowColor, colors.shadowOpacity),
        style,
      ]}
      {...rest}
    >
      {rail ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: spacing.lg,
            bottom: spacing.lg,
            width: 3,
            borderTopRightRadius: 3,
            borderBottomRightRadius: 3,
            backgroundColor: rail,
          }}
        />
      ) : null}
      <View style={padded ? { padding: spacing.lg } : undefined}>{children}</View>
    </View>
  );
}

export function PressableCard({
  onPress,
  children,
  style,
  ...cardProps
}: CardProps & { onPress?: PressableProps['onPress'] }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.988 }] }]}
    >
      <Card style={style} {...cardProps}>
        {children}
      </Card>
    </Pressable>
  );
}

/** Deep wine gradient panel used for hero moments. */
export function HeroCard({
  children,
  style,
  gold,
  level = 3,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gold?: boolean;
  level?: 0 | 1 | 2 | 3;
}) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={gold ? colors.goldGradient : colors.heroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: radius.xl,
          padding: spacing.xl,
          overflow: 'hidden',
        },
        elevation(level, colors.shadowColor, Math.min(colors.shadowOpacity + 0.08, 0.6)),
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  /** Icon kept small inside a muted square — restrained, not decorative noise. */
  icon?: IconName;
}) {
  const { colors } = useTheme();
  return (
    <Row justify="space-between" align="center" style={{ marginBottom: spacing.md }} gap={spacing.sm}>
      {icon ? <IconBubble name={icon} size={30} tint={colors.primary} /> : null}
      <View style={{ flex: 1 }}>
        <AppText variant="heading">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: 1 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <AppText variant="captionStrong" tone="primary">
            {action}
          </AppText>
          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
        </Pressable>
      ) : null}
    </Row>
  );
}

// ─── Pills & chips ────────────────────────────────────────────────────────────

export type PillTone = 'neutral' | 'primary' | 'accent' | 'gold' | 'success' | 'warning' | 'error' | 'info';

export function Pill({
  label,
  tone = 'neutral',
  icon,
  style,
  solid,
}: {
  label: string;
  tone?: PillTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  solid?: boolean;
}) {
  const { colors } = useTheme();
  const tones: Record<PillTone, { bg: string; fg: string; border: string }> = {
    neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary, border: colors.border },
    primary: { bg: colors.primarySubtle, fg: colors.primary, border: colors.primarySubtle },
    accent: { bg: colors.goldSubtle, fg: colors.gold, border: colors.goldSubtle },
    gold: { bg: colors.goldSubtle, fg: colors.gold, border: colors.goldSubtle },
    success: { bg: colors.successBg, fg: colors.successText, border: colors.successBg },
    warning: { bg: colors.warningBg, fg: colors.warningText, border: colors.warningBg },
    error: { bg: colors.errorBg, fg: colors.errorText, border: colors.errorBg },
    info: { bg: colors.infoBg, fg: colors.infoText, border: colors.infoBg },
  };
  const t = tones[tone];
  return (
    <View
      style={[
        {
          backgroundColor: solid ? t.fg : t.bg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: radius.xs,
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={11} color={solid ? colors.textOnPrimary : t.fg} /> : null}
      <Text
        style={{
          fontFamily: fonts.sansSemibold,
          fontSize: 10.5,
          letterSpacing: 0.2,
          color: solid ? colors.textOnPrimary : t.fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  iconColor,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Status tint for the icon on an unselected chip (e.g. owed vs saved). */
  iconColor?: string;
}) {
  const { colors } = useTheme();

  if (selected) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
        <LinearGradient
          colors={colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: 9,
            borderRadius: radius.pill,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            ...elevation(1, colors.shadowColor, colors.shadowOpacity + 0.05),
          }}
        >
          {icon ? <Ionicons name={icon} size={14} color="#fff" /> : null}
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: '#fff' }}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: 9,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={iconColor ?? colors.textMuted} /> : null}
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

// ─── Avatar & monogram ────────────────────────────────────────────────────────

export function Avatar({
  initials,
  gradient,
  size = 44,
  ring,
}: {
  initials: string;
  gradient: [string, string];
  size?: number;
  ring?: boolean;
}) {
  const { colors } = useTheme();
  const inner = ring ? size - 5 : size;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 1.5 : 0,
        borderColor: colors.gold,
      }}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: fonts.sansBold,
            color: '#fff',
            fontSize: inner * 0.36,
            letterSpacing: 0.3,
          }}
        >
          {initials}
        </Text>
      </LinearGradient>
    </View>
  );
}

export function CenterMark({ text, color, size = 40 }: { text: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: `${color}1A`,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: `${color}40`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.sansBold, color, fontSize: size * 0.34, letterSpacing: 0.3 }}>
        {text}
      </Text>
    </View>
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  color,
  height = 6,
  trackColor,
  gradient,
}: {
  value: number;
  color?: string;
  height?: number;
  trackColor?: string;
  gradient?: [string, string];
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor ?? colors.surfaceAlt,
        overflow: 'hidden',
      }}
    >
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${clamped}%`, height: '100%', borderRadius: height / 2 }}
        />
      ) : (
        <View
          style={{
            width: `${clamped}%`,
            height: '100%',
            borderRadius: height / 2,
            backgroundColor: color ?? colors.primary,
          }}
        />
      )}
    </View>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

export function StatTile({
  label,
  value,
  sub,
  tone = 'primary',
  icon,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: PillTone;
  icon?: IconName;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const accents: Record<PillTone, string> = {
    neutral: colors.textSecondary,
    primary: colors.primary,
    accent: colors.gold,
    gold: colors.gold,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
  };
  const Wrapper: any = onPress ? Pressable : View;
  const tileStyle = (pressed = false): StyleProp<ViewStyle> => [
    {
      flex: 1,
      minWidth: 148,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      opacity: pressed ? 0.9 : 1,
    },
    elevation(1, colors.shadowColor, colors.shadowOpacity),
  ];
  return (
    <Wrapper
      onPress={onPress}
      // A plain View ignores function styles, so only Pressable gets one.
      style={onPress ? ({ pressed }: { pressed: boolean }) => tileStyle(pressed) : tileStyle()}
    >
      <Row justify="space-between" align="flex-start">
        <AppText variant="overline" tone="muted" style={{ flex: 1 }}>
          {label.toUpperCase()}
        </AppText>
        {icon ? <Ionicons name={icon} size={15} color={accents[tone]} /> : null}
      </Row>
      <AppText variant="metric" style={{ color: accents[tone], marginTop: spacing.sm }}>
        {value}
      </AppText>
      {sub ? (
        <AppText variant="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
          {sub}
        </AppText>
      ) : null}
    </Wrapper>
  );
}

// ─── Key/value line ───────────────────────────────────────────────────────────

export function KeyValue({
  label,
  value,
  valueTone = 'main',
  icon,
}: {
  label: string;
  value: string;
  valueTone?: TextTone;
  icon?: React.ReactNode;
}) {
  return (
    <Row justify="space-between" align="flex-start" style={{ paddingVertical: 7 }} gap={spacing.lg}>
      <AppText variant="caption" tone="muted" style={{ flexShrink: 0 }}>
        {label}
      </AppText>
      <Row gap={6} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <AppText variant="bodyStrong" tone={valueTone} style={{ textAlign: 'right' }}>
          {value}
        </AppText>
        {icon}
      </Row>
    </Row>
  );
}

/** Tappable settings-style row. */
export function ListRow({
  title,
  subtitle,
  iconName,
  onPress,
  right,
  tint,
}: {
  title: string;
  subtitle?: string;
  iconName?: IconName;
  onPress?: () => void;
  right?: React.ReactNode;
  tint?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      {iconName ? (
        <IconBubble
          name={iconName}
          size={38}
          tint={tint ?? colors.primary}
          bg={tint ? `${tint}14` : colors.surfaceMuted}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="subheading">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: 1 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
}: {
  icon?: IconName;
  title: string;
  message?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primarySubtle,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <AppText variant="subheading" center>
        {title}
      </AppText>
      {message ? (
        <AppText variant="caption" tone="muted" center style={{ marginTop: 4, maxWidth: 270 }}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

// ─── Verified micro badge ─────────────────────────────────────────────────────

export function VerifiedTick({ verified }: { verified: boolean }) {
  const { colors } = useTheme();
  if (!verified) return <Pill label="Unverified" tone="warning" />;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: colors.successBg,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: radius.xs,
      }}
    >
      <Ionicons name="shield-checkmark" size={11} color={colors.successText} />
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.successText }}>
        Verified
      </Text>
    </View>
  );
}
