import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { AppText, IconName } from './base';

type ToastTone = 'success' | 'info' | 'warning' | 'error';

const TONE_ICONS: Record<ToastTone, IconName> = {
  success: 'checkmark-circle',
  info: 'information-circle',
  warning: 'alert-circle',
  error: 'close-circle',
};

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone, icon?: IconName) => void;
  /** Convenience for the "+N pts" confirmations used across the app. */
  points: (points: number, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<ToastTone>('success');
  const [icon, setIcon] = useState<IconName>(TONE_ICONS.success);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(20)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string, t: ToastTone = 'success', glyph?: IconName) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(msg);
      setTone(t);
      setIcon(glyph ?? TONE_ICONS[t]);
      Haptics.notificationAsync(
        t === 'error'
          ? Haptics.NotificationFeedbackType.Error
          : t === 'warning'
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});

      opacity.setValue(0);
      translate.setValue(20);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translate, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translate, { toValue: 16, duration: 200, useNativeDriver: true }),
        ]).start(() => setMessage(null));
      }, 2600);
    },
    [opacity, translate],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: show,
      points: (pts, msg) =>
        pts > 0 ? show(`+${pts} pts · ${msg}`, 'success', 'ribbon') : show(msg, 'info'),
    }),
    [show],
  );

  const tones: Record<ToastTone, { bg: string; fg: string }> = {
    success: { bg: colors.success, fg: '#fff' },
    info: { bg: colors.primary, fg: '#fff' },
    warning: { bg: colors.accent, fg: '#fff' },
    error: { bg: colors.error, fg: '#fff' },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: insets.bottom + 78,
            opacity,
            transform: [{ translateY: translate }],
          }}
        >
          <View
            style={{
              backgroundColor: tones[tone].bg,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.md,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name={icon} size={18} color={tones[tone].fg} />
              <AppText variant="bodyStrong" style={{ color: tones[tone].fg, flex: 1 }}>
                {message}
              </AppText>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export const toastStyles = StyleSheet.create({});
