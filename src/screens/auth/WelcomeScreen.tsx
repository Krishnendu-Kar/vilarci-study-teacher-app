import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { elevation, radius, spacing } from '../../theme/tokens';
import { describeAuthError, signInWithVilarci, VILARCI_LOGO_URL } from '../../lib/auth';
import { useAuth } from '../../lib/AuthProvider';
import { AppText, IconName, Row } from '../../components/ui/base';
import { AuthCard, AuthHero, ErrorBanner } from '../../components/auth/AuthKit';

const POINTS: { icon: IconName; text: string }[] = [
  { icon: 'albums-outline', text: 'Batches, attendance, marks and fees across every institute' },
  { icon: 'shield-checkmark-outline', text: 'Your password and OTP stay with Vilarci — never in this app' },
  { icon: 'sync-outline', text: 'Same login as Vilarci Study and the Vilarci website' },
];

/**
 * The only sign-in screen. Signup, WhatsApp OTP and password reset all happen
 * on Vilarci's own page, so the app holds no credentials.
 */
export function WelcomeScreen() {
  const { colors } = useTheme();
  const { enterDemo } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  const start = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const result = await signInWithVilarci();
      if (result === 'cancelled') setMessage({ text: 'Sign-in was cancelled. Tap the button to try again.', tone: 'info' });
      // On success the navigator moves on as soon as the session lands.
    } catch (err) {
      setMessage({ text: describeAuthError(err, 'Couldn’t sign in with Vilarci. Please try again.'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bgApp }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      <AuthHero title="Vilarci Teacher" subtitle="Run every class, batch and institute from your phone." />

      <AuthCard>
        <AppText variant="title">Welcome, educator</AppText>
        <AppText variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.xl }}>
          Sign in or create your account with Vilarci. It takes under a minute.
        </AppText>

        <ErrorBanner message={message?.text ?? null} tone={message?.tone} />

        <Pressable
          onPress={start}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Continue with Vilarci"
          style={({ pressed }) => ({
            borderRadius: radius.md,
            opacity: busy ? 0.75 : pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          })}
        >
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.md,
              height: 56,
              borderRadius: radius.md,
              ...elevation(2, colors.shadowColor, colors.shadowOpacity + 0.08),
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image source={{ uri: VILARCI_LOGO_URL }} style={{ width: 24, height: 24 }} resizeMode="contain" />
              </View>
            )}
            <AppText variant="subheading" style={{ color: '#fff', fontSize: 16 }}>
              {busy ? 'Opening Vilarci…' : 'Continue with Vilarci'}
            </AppText>
          </LinearGradient>
        </Pressable>

        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          {POINTS.map((p) => (
            <Row key={p.text} gap={spacing.md} align="flex-start">
              <Ionicons name={p.icon} size={17} color={colors.gold} style={{ marginTop: 1 }} />
              <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
                {p.text}
              </AppText>
            </Row>
          ))}
        </View>
      </AuthCard>

      <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.xl, marginHorizontal: spacing.xl }}>
        New to Vilarci? Choose “Create an account” on the next page.
      </AppText>

      <Pressable
        onPress={enterDemo}
        hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xl }}
      >
        <Ionicons name="play-circle-outline" size={17} color={colors.textSecondary} />
        <AppText variant="captionStrong" tone="secondary">
          Explore the demo first
        </AppText>
      </Pressable>
    </ScrollView>
  );
}
