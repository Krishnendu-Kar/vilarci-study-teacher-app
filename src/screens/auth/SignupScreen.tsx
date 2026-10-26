import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import {
  describeAuthError,
  EMAIL_RE,
  Gender,
  isEighteenOrOlder,
  passwordProblem,
  resendSignupOtp,
  signupWithWhatsAppOtp,
  toISODate,
  verifySignupOtp,
} from '../../lib/auth';
import { AppText, IconName, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { AuthField, ErrorBanner, OptionCard, OtpInput, PasswordRules } from '../../components/auth/AuthKit';
import { formatDateLong } from '../../lib/utils/format';

type StepId = 'name' | 'gender' | 'dob' | 'contact' | 'password';

const STEPS: { id: StepId; icon: IconName; title: string; hint: string }[] = [
  { id: 'name', icon: 'person-outline', title: 'What’s your sweet name?', hint: '' },
  { id: 'gender', icon: 'body-outline', title: 'How do you identify?', hint: 'Used only for how students and institutes address you.' },
  { id: 'dob', icon: 'calendar-outline', title: 'When were you born?', hint: 'We confirm the account holder is an adult.' },
  { id: 'contact', icon: 'logo-whatsapp', title: 'Where can we reach you?', hint: 'We’ll send a 6-digit code to this WhatsApp number.' },
  { id: 'password', icon: 'lock-closed-outline', title: 'Create a password', hint: 'You’ll use it with your mobile number to log in.' },
];

const GENDERS: { value: Gender; label: string; icon: IconName }[] = [
  { value: 'female', label: 'Female', icon: 'woman-outline' },
  { value: 'male', label: 'Male', icon: 'man-outline' },
  { value: 'other', label: 'Other / prefer not to say', icon: 'person-outline' },
];

type Errors = Partial<Record<'firstName' | 'middleName' | 'lastName' | 'gender' | 'dob' | 'mobile' | 'email' | 'password' | 'confirm', string>>;

const RESEND_SECONDS = 30;

/** First and last name: 3–35 characters each; middle name up to 35. */
const NAME_MIN = 3;
const NAME_MAX = 35;

function nameProblem(value: string, label: string): string | undefined {
  const v = value.trim();
  if (!v) return `We need your ${label.toLowerCase()}.`;
  if (v.length < NAME_MIN) return `${label} must be at least ${NAME_MIN} characters.`;
  if (v.length > NAME_MAX) return `${label} can be at most ${NAME_MAX} characters.`;
  return undefined;
}

export function SignupScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  // ── answers ──
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [dob, setDob] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftDob, setDraftDob] = useState<Date>(() => defaultDob());
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // ── flow ──
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'form' | 'otp'>('form');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);

  const lastNameRef = useRef<TextInput>(null);
  const middleRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  // ── step transition: native-driver opacity + translate only ──
  const anim = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const swap = useCallback(
    (change: () => void, direction: 1 | -1) => {
      dir.current = direction;
      Animated.timing(anim, { toValue: 0, duration: 120, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
        change();
        Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    },
    [anim],
  );
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [24 * dir.current, 0] });

  // ── resend countdown ──
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // ── per-step validation ──
  const checkStep = (id: StepId): Errors => {
    const e: Errors = {};
    if (id === 'name') {
      const first = nameProblem(firstName, 'First name');
      const last = nameProblem(lastName, 'Last name');
      if (first) e.firstName = first;
      if (last) e.lastName = last;
      if (middleName.trim().length > NAME_MAX) e.middleName = `Middle name can be at most ${NAME_MAX} characters.`;
    }
    if (id === 'gender' && !gender) e.gender = 'Pick the one that fits you.';
    if (id === 'dob') {
      if (!dob) e.dob = 'Please choose your date of birth.';
      else if (!isEighteenOrOlder(dob)) {
        e.dob = 'The account holder must be at least 18 years old. Younger students are added as student profiles.';
      }
    }
    if (id === 'contact') {
      if (!/^[6-9]\d{9}$/.test(mobile.trim())) e.mobile = 'Enter a valid 10-digit Indian mobile number.';
      if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = 'That email doesn’t look right.';
    }
    if (id === 'password') {
      const problem = passwordProblem(password);
      if (problem) e.password = problem;
      else if (password !== confirm) e.confirm = 'Both passwords must match.';
    }
    return e;
  };

  const back = useCallback(() => {
    setFailure(null);
    if (phase === 'otp') return swap(() => setPhase('form'), -1);
    if (index === 0) return navigation.goBack();
    swap(() => setIndex((i) => i - 1), -1);
  }, [phase, index, navigation, swap]);

  // Android back mirrors the on-screen back chip so answers aren't lost.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'otp' || index > 0) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [phase, index, back]);

  const submit = async () => {
    setFailure(null);
    setBusy(true);
    try {
      const e164 = await signupWithWhatsAppOtp({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        gender: gender!,
        dobISO: toISODate(dob!),
        mobile: mobile.trim(),
        email: email.trim(),
        password,
      });
      setPhone(e164);
      setCode('');
      setResendIn(RESEND_SECONDS);
      swap(() => setPhase('otp'), 1);
    } catch (err) {
      setFailure(describeAuthError(err, 'Couldn’t create the account. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    const e = checkStep(step.id);
    setErrors(e);
    setFailure(null);
    if (Object.keys(e).length) return;
    if (isLast) submit();
    else swap(() => setIndex((i) => i + 1), 1);
  };

  const verify = async () => {
    if (code.length !== 6) {
      setFailure('Enter the 6-digit code from WhatsApp.');
      return;
    }
    setFailure(null);
    setBusy(true);
    try {
      await verifySignupOtp(phone, code);
      toast.toast(`Welcome to Vilarci Teacher, ${firstName.trim()}!`, 'success');
      // The session is live now; the navigator switches to the app.
    } catch (err) {
      setFailure(describeAuthError(err, 'Couldn’t verify the code. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setFailure(null);
    try {
      await resendSignupOtp(phone);
      setResendIn(RESEND_SECONDS);
      toast.toast('A new code is on its way', 'info');
    } catch (err) {
      setFailure(describeAuthError(err, 'Couldn’t resend the code.'));
    }
  };

  const clearError = (key: keyof Errors) => errors[key] && setErrors((e) => ({ ...e, [key]: undefined }));

  // ── date of birth ──
  const onAndroidDate = (date: Date) => {
    setPickerOpen(false);
    setDob(date);
    clearError('dob');
  };

  // ── renderers ──
  const renderStep = () => {
    switch (step.id) {
      case 'name':
        return (
          <>
            <AuthField
              label="First name"
              icon="person-outline"
              placeholder="Sunita"
              autoCapitalize="words"
              textContentType="givenName"
              maxLength={NAME_MAX}
              autoFocus
              returnKeyType="next"
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t);
                clearError('firstName');
              }}
              onSubmitEditing={() => middleRef.current?.focus()}
              error={errors.firstName}
            />
            <AuthField
              ref={middleRef}
              label="Middle name"
              optional
              placeholder="—"
              autoCapitalize="words"
              textContentType="middleName"
              maxLength={NAME_MAX}
              returnKeyType="next"
              value={middleName}
              onChangeText={(t) => {
                setMiddleName(t);
                clearError('middleName');
              }}
              error={errors.middleName}
              onSubmitEditing={() => lastNameRef.current?.focus()}
            />
            <AuthField
              ref={lastNameRef}
              label="Last name"
              placeholder="Mehta"
              autoCapitalize="words"
              textContentType="familyName"
              maxLength={NAME_MAX}
              returnKeyType="next"
              value={lastName}
              onChangeText={(t) => {
                setLastName(t);
                clearError('lastName');
              }}
              onSubmitEditing={next}
              error={errors.lastName}
            />
          </>
        );
      case 'gender':
        return (
          <View style={{ gap: spacing.md }}>
            {GENDERS.map((g) => (
              <OptionCard
                key={g.value}
                icon={g.icon}
                title={g.label}
                selected={gender === g.value}
                onPress={() => {
                  setGender(g.value);
                  clearError('gender');
                }}
              />
            ))}
            {errors.gender ? <InlineError text={errors.gender} /> : null}
          </View>
        );
      case 'dob':
        return (
          <>
            <Pressable
              onPress={() => {
                setDraftDob(dob ?? defaultDob());
                setPickerOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Choose date of birth"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: errors.dob ? 1.5 : StyleSheet.hairlineWidth,
                borderColor: errors.dob ? colors.error : dob ? colors.primary : colors.border,
                backgroundColor: dob ? colors.primarySubtle : colors.surface,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: dob ? colors.primary : colors.surfaceMuted,
                }}
              >
                <Ionicons name="calendar" size={20} color={dob ? '#fff' : colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="overline" tone="muted">
                  DATE OF BIRTH
                </AppText>
                <AppText variant="subheading" style={{ color: dob ? colors.primary : colors.textMuted }}>
                  {dob ? formatDateLong(toISODate(dob)) : 'Tap to choose'}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
            </Pressable>
            {errors.dob ? <InlineError text={errors.dob} /> : null}
          </>
        );
      case 'contact':
        return (
          <>
            <AuthField
              label="WhatsApp mobile number"
              icon="logo-whatsapp"
              prefix="+91"
              placeholder="98765 43210"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              maxLength={10}
              autoFocus
              value={mobile}
              onChangeText={(t) => {
                setMobile(t.replace(/\D/g, ''));
                clearError('mobile');
              }}
              onSubmitEditing={() => emailRef.current?.focus()}
              error={errors.mobile}
            />
            <AuthField
              ref={emailRef}
              label="Email"
              optional
              icon="mail-outline"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                clearError('email');
              }}
              onSubmitEditing={next}
              error={errors.email}
            />
            <AppText variant="caption" tone="muted">
              Adding an email lets you reset your password without WhatsApp.
            </AppText>
          </>
        );
      case 'password':
        return (
          <>
            <AuthField
              label="Password"
              icon="lock-closed-outline"
              placeholder="Create a strong password"
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              autoFocus
              returnKeyType="next"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                clearError('password');
              }}
              onSubmitEditing={() => confirmRef.current?.focus()}
              error={errors.password}
            />
            <PasswordRules password={password} />
            <AuthField
              ref={confirmRef}
              label="Confirm password"
              icon="lock-closed-outline"
              placeholder="Type it again"
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="go"
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                clearError('confirm');
              }}
              onSubmitEditing={next}
              error={errors.confirm}
            />
            {confirm.length > 0 && confirm === password ? (
              <Row gap={6} style={{ marginTop: -spacing.sm }}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <AppText variant="caption" style={{ color: colors.successText }}>
                  Passwords match
                </AppText>
              </Row>
            ) : null}
          </>
        );
    }
  };

  const otp = phase === 'otp';
  const totalSteps = STEPS.length + 1;
  const position = otp ? totalSteps : index + 1;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── top bar + progress ── */}
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg }}>
        <Row justify="space-between">
          <Pressable
            onPress={back}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backBtn(colors.surface, colors.border), { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name={index === 0 && !otp ? 'close' : 'arrow-back'} size={19} color={colors.textMain} />
          </Pressable>
          <AppText variant="captionStrong" tone="muted">
            Step {position} of {totalSteps}
          </AppText>
          <View style={{ width: 38 }} />
        </Row>
        <Row gap={5} style={{ marginTop: spacing.md }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i < position ? (i === position - 1 ? colors.gold : colors.primary) : colors.border,
              }}
            />
          ))}
        </Row>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: anim, transform: [{ translateX }] }}>
          {/* ── question ── */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primarySubtle,
              marginBottom: spacing.lg,
            }}
          >
            <Ionicons name={otp ? 'shield-checkmark-outline' : step.icon} size={23} color={colors.primary} />
          </View>
          <AppText variant="display">{otp ? 'Check your WhatsApp' : step.title}</AppText>
          {otp || step.hint ? (
            <AppText variant="body" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.xl }}>
              {otp ? `We sent a 6-digit code to ${formatPhone(phone)}.` : step.hint}
            </AppText>
          ) : (
            <View style={{ height: spacing.xl }} />
          )}

          <ErrorBanner message={failure} />

          {otp ? (
            <>
              <OtpInput value={code} onChange={setCode} error={Boolean(failure)} />
              <Row justify="center" gap={6} style={{ marginTop: spacing.xl }}>
                <AppText variant="caption" tone="muted">
                  Didn’t get it?
                </AppText>
                {resendIn > 0 ? (
                  <AppText variant="captionStrong" tone="muted">
                    Resend in {resendIn}s
                  </AppText>
                ) : (
                  <Pressable onPress={resend} hitSlop={8}>
                    <AppText variant="captionStrong" tone="primary">
                      Resend code
                    </AppText>
                  </Pressable>
                )}
              </Row>
              <Pressable onPress={back} hitSlop={8} style={{ alignSelf: 'center', marginTop: spacing.md }}>
                <AppText variant="caption" tone="secondary">
                  Wrong number? Edit details
                </AppText>
              </Pressable>
            </>
          ) : (
            renderStep()
          )}
        </Animated.View>
      </ScrollView>

      {/* ── call to action ── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.bgApp,
        }}
      >
        <Button
          label={otp ? 'Verify & create account' : isLast ? 'Send WhatsApp code' : 'Continue'}
          iconName={otp ? 'checkmark-circle-outline' : isLast ? 'logo-whatsapp' : 'arrow-forward'}
          fullWidth
          size="lg"
          loading={busy}
          disabled={otp && code.length !== 6}
          onPress={otp ? verify : next}
        />
        {index === 0 && !otp ? (
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ alignSelf: 'center', marginTop: spacing.md }}>
            <AppText variant="caption" tone="secondary">
              Already have an account? <AppText variant="captionStrong" tone="primary">Log in</AppText>
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {/* ── date picker: Android uses the system dialog, iOS a sheet ── */}
      {pickerOpen && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draftDob}
          mode="date"
          maximumDate={new Date()}
          onValueChange={(_, date) => onAndroidDate(date)}
          onDismiss={() => setPickerOpen(false)}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Date of birth" scroll={false}>
          <DateTimePicker
            value={draftDob}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            themeVariant={isDark ? 'dark' : 'light'}
            onValueChange={(_, d) => setDraftDob(d)}
          />
          <Button
            label="Done"
            fullWidth
            onPress={() => {
              setDob(draftDob);
              clearError('dob');
              setPickerOpen(false);
            }}
            style={{ marginTop: spacing.md }}
          />
        </Sheet>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function InlineError({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Row gap={6} align="flex-start" style={{ marginTop: spacing.sm }}>
      <Ionicons name="alert-circle" size={14} color={colors.error} style={{ marginTop: 2 }} />
      <AppText variant="caption" tone="error" style={{ flex: 1 }}>
        {text}
      </AppText>
    </Row>
  );
}

/** Opens the picker around a typical adult birth year instead of today. */
function defaultDob(): Date {
  const d = new Date();
  return new Date(d.getFullYear() - 30, 0, 1);
}

function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

const styles = {
  backBtn: (bg: string, border: string) => ({
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: border,
  }),
};
