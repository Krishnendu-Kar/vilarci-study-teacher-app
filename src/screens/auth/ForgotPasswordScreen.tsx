import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInputInstance } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import {
  describeAuthError,
  EMAIL_RE,
  passwordProblem,
  requestResetOtp,
  ResetChannel,
  saveNewPassword,
  signOut,
  toE164,
  verifyResetOtp,
} from '../../lib/auth';
import { useAuth } from '../../lib/AuthProvider';
import { AppText, IconName, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { AuthCard, AuthField, AuthHero, ErrorBanner, OtpInput, PasswordRules } from '../../components/auth/AuthKit';

type Stage = 'request' | 'code' | 'password';

const CHANNELS: { value: ResetChannel; label: string; icon: IconName }[] = [
  { value: 'sms', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { value: 'email', label: 'Email', icon: 'mail-outline' },
];

const COPY: Record<Stage, { title: string; subtitle: string }> = {
  request: { title: 'Reset password', subtitle: 'We’ll send a 6-digit code to verify it’s you.' },
  code: { title: 'Enter the code', subtitle: 'It expires in a few minutes.' },
  password: { title: 'New password', subtitle: 'Choose one you haven’t used here before.' },
};

export function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { setRecovering } = useAuth();
  const confirmRef = useRef<TextInputInstance>(null);

  const [stage, setStage] = useState<Stage>('request');
  const [channel, setChannel] = useState<ResetChannel>('sms');
  const [target, setTarget] = useState('');
  const [resolved, setResolved] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A verified-but-unfinished reset holds a live session; never leave it behind.
  const verified = useRef(false);
  const saved = useRef(false);
  useEffect(
    () => () => {
      if (verified.current && !saved.current) signOut().catch(() => {});
      setRecovering(false);
    },
    [setRecovering],
  );

  const request = async () => {
    const value = target.trim();
    if (channel === 'sms' ? !/^[6-9]\d{9}$/.test(value) : !EMAIL_RE.test(value)) {
      setFieldError(channel === 'sms' ? 'Enter your 10-digit WhatsApp number.' : 'Enter a valid email address.');
      return;
    }
    setFieldError(undefined);
    setFailure(null);
    setBusy(true);
    try {
      const to = channel === 'sms' ? toE164(value) : value;
      await requestResetOtp(channel, to);
      setResolved(to);
      setCode('');
      setStage('code');
    } catch (err) {
      setFailure(describeAuthError(err, 'Couldn’t send the code. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setFailure(null);
    setBusy(true);
    // Raise the flag BEFORE the session lands so the navigator stays put.
    setRecovering(true);
    try {
      await verifyResetOtp(channel, resolved, code);
      verified.current = true;
      setStage('password');
    } catch (err) {
      setRecovering(false);
      setFailure(describeAuthError(err, 'Couldn’t verify the code.'));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const problem = passwordProblem(password);
    if (problem) return setFieldError(problem);
    if (password !== confirm) return setFieldError('Both passwords must match.');
    setFieldError(undefined);
    setFailure(null);
    setBusy(true);
    try {
      await saveNewPassword(password);
      saved.current = true;
      setRecovering(false);
      toast.toast('Password updated — log in with your new password', 'success');
      navigation.goBack();
    } catch (err) {
      setFailure(describeAuthError(err, 'Couldn’t save the new password.'));
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setFailure(null);
    setFieldError(undefined);
    if (stage === 'code') setStage('request');
    else navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <AuthHero title={COPY[stage].title} subtitle={COPY[stage].subtitle} onBack={back} compact />

        <AuthCard>
          <ErrorBanner message={failure} />

          {stage === 'request' ? (
            <>
              <AppText variant="overline" tone="muted" style={{ marginBottom: spacing.sm }}>
                SEND THE CODE BY
              </AppText>
              <Row gap={spacing.sm} style={{ marginBottom: spacing.xl }}>
                {CHANNELS.map((c) => {
                  const active = channel === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() => {
                        setChannel(c.value);
                        setTarget('');
                        setFieldError(undefined);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 7,
                        paddingVertical: 12,
                        borderRadius: radius.md,
                        borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primarySubtle : colors.surfaceMuted,
                      }}
                    >
                      <Ionicons name={c.icon} size={17} color={active ? colors.primary : colors.textMuted} />
                      <AppText variant="captionStrong" style={{ color: active ? colors.primary : colors.textSecondary }}>
                        {c.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </Row>

              {channel === 'sms' ? (
                <AuthField
                  key="sms"
                  label="WhatsApp number"
                  icon="logo-whatsapp"
                  prefix="+91"
                  placeholder="98765 43210"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={target}
                  onChangeText={(t) => {
                    setTarget(t.replace(/\D/g, ''));
                    setFieldError(undefined);
                  }}
                  onSubmitEditing={request}
                  error={fieldError}
                />
              ) : (
                <AuthField
                  key="email"
                  label="Email"
                  icon="mail-outline"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={target}
                  onChangeText={(t) => {
                    setTarget(t);
                    setFieldError(undefined);
                  }}
                  onSubmitEditing={request}
                  error={fieldError}
                />
              )}
              <Button label="Send code" iconName="paper-plane-outline" fullWidth loading={busy} onPress={request} />
            </>
          ) : null}

          {stage === 'code' ? (
            <>
              <AppText variant="body" tone="secondary" center style={{ marginBottom: spacing.xl }}>
                If an account exists for{' '}
                <AppText variant="bodyStrong">{resolved}</AppText>, a code is on its way.
              </AppText>
              <OtpInput value={code} onChange={setCode} error={Boolean(failure)} />
              <Button
                label="Verify code"
                iconName="shield-checkmark-outline"
                fullWidth
                loading={busy}
                disabled={code.length !== 6}
                onPress={verify}
                style={{ marginTop: spacing.xl }}
              />
              <Pressable onPress={request} hitSlop={8} style={{ alignSelf: 'center', marginTop: spacing.lg }}>
                <AppText variant="captionStrong" tone="primary">
                  Send a new code
                </AppText>
              </Pressable>
            </>
          ) : null}

          {stage === 'password' ? (
            <>
              <AuthField
                label="New password"
                icon="lock-closed-outline"
                placeholder="Create a strong password"
                secureTextEntry
                textContentType="newPassword"
                autoFocus
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setFieldError(undefined);
                }}
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <PasswordRules password={password} />
              <AuthField
                ref={confirmRef}
                label="Confirm password"
                icon="lock-closed-outline"
                placeholder="Type it again"
                secureTextEntry
                textContentType="newPassword"
                value={confirm}
                onChangeText={(t) => {
                  setConfirm(t);
                  setFieldError(undefined);
                }}
                onSubmitEditing={save}
                error={fieldError}
              />
              <Button label="Save new password" iconName="checkmark-circle-outline" fullWidth loading={busy} onPress={save} />
              <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.md }}>
                You’ll be signed out on every device and can log in with the new password.
              </AppText>
            </>
          ) : null}
        </AuthCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
