import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInputInstance, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { describeAuthError, EMAIL_RE, loginWithPassword } from '../../lib/auth';
import { useAuth } from '../../lib/AuthProvider';
import { AppText, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { AuthCard, AuthField, AuthHero, ErrorBanner } from '../../components/auth/AuthKit';

export function LoginScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { enterDemo } = useAuth();
  const passwordRef = useRef<TextInputInstance>(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const id = identifier.trim();
    const e: typeof errors = {};
    if (!id) e.identifier = 'Enter your mobile number or email.';
    else if (id.includes('@') ? !EMAIL_RE.test(id) : !/^(\+?\d[\d\s-]{9,14})$/.test(id)) {
      e.identifier = 'Enter a valid 10-digit mobile number or email.';
    }
    if (!password) e.password = 'Enter your password.';
    setErrors(e);
    setFailure(null);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      await loginWithPassword(id, password);
      // The navigator swaps to the app as soon as the session lands.
    } catch (err) {
      setFailure(describeAuthError(err, 'Couldn’t log in. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero title="Vilarci Teacher" subtitle="Run every batch, class and institute from your phone." />

        <AuthCard>
          <AppText variant="title">Welcome back</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.xl }}>
            Log in with the number you verified on WhatsApp.
          </AppText>

          <ErrorBanner message={failure} />

          <AuthField
            label="Mobile number or email"
            icon="person-outline"
            placeholder="Mobile number or email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
            returnKeyType="next"
            value={identifier}
            onChangeText={(t) => {
              setIdentifier(t);
              if (errors.identifier) setErrors((e) => ({ ...e, identifier: undefined }));
            }}
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={errors.identifier}
          />
          <AuthField
            ref={passwordRef}
            label="Password"
            icon="lock-closed-outline"
            placeholder="Your password"
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            returnKeyType="go"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
            }}
            onSubmitEditing={submit}
            error={errors.password}
          />

          <Button label="Log in" iconName="log-in-outline" fullWidth loading={busy} onPress={submit} />

          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: spacing.lg }}
          >
            <AppText variant="captionStrong" tone="primary">
              Forgot password?
            </AppText>
          </Pressable>
        </AuthCard>

        {/* Sign-up call to action — a first-time teacher must not miss it. */}
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xxl }}>
          <Row gap={spacing.md}>
            <View style={styles.rule(colors.border)} />
            <AppText variant="caption" tone="muted">
              New to Vilarci Teacher?
            </AppText>
            <View style={styles.rule(colors.border)} />
          </Row>
          <Pressable
            onPress={() => navigation.navigate('Signup')}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              height: 52,
              marginTop: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: colors.primary,
              backgroundColor: colors.primarySubtle,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="person-add-outline" size={18} color={colors.primary} />
            <AppText variant="subheading" tone="primary">
              Create an account
            </AppText>
            <Ionicons name="arrow-forward" size={17} color={colors.primary} />
          </Pressable>
          <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.sm }}>
            Free · same account as Vilarci Study
          </AppText>
        </View>

        <Pressable
          onPress={enterDemo}
          hitSlop={6}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xxl }}
        >
          <Ionicons name="play-circle-outline" size={17} color={colors.textSecondary} />
          <AppText variant="captionStrong" tone="secondary">
            Explore the demo first
          </AppText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = {
  rule: (color: string) => ({ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: color }),
};
