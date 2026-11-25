import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import {
  describeInstituteError,
  INSTITUTE_COLORS,
  INSTITUTE_LIMITS,
  useInstitute,
  useSaveInstitute,
} from '../../lib/api/institutes';
import { AppText, CenterMark, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { ErrorBanner } from '../../components/auth/AuthKit';
import { RealTopBar } from '../../components/real/RealTopBar';

type Errors = Partial<Record<'name' | 'logo' | 'email' | 'established', string>>;

/** "Sunrise Academy" → "SA". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => w.replace(/[^A-Za-z0-9]/g, '')[0]) : [name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2)];
  return letters.join('').toUpperCase().slice(0, 3);
}

/** Create an institute, or edit one (route param `id`; owner and admins). */
export function InstituteFormScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const editingId: string | undefined = useRoute<any>().params?.id;
  const existing = useInstitute(editingId);
  const save = useSaveInstitute();

  const [name, setName] = useState(existing?.name ?? '');
  const [tagline, setTagline] = useState(existing?.tagline ?? '');
  const [logo, setLogo] = useState(existing?.logo_text ?? '');
  const [color, setColor] = useState(existing?.theme_color ?? INSTITUTE_COLORS[0]);
  const [address, setAddress] = useState(existing?.address ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [established, setEstablished] = useState(existing?.established ? String(existing.established) : '');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const shownLogo = (logo.trim() || initialsOf(name) || 'IN').toUpperCase();

  const submit = async () => {
    const e: Errors = {};
    const n = name.trim();
    if (n.length < INSTITUTE_LIMITS.nameMin || n.length > INSTITUTE_LIMITS.nameMax) {
      e.name = `The name must be ${INSTITUTE_LIMITS.nameMin}–${INSTITUTE_LIMITS.nameMax} characters.`;
    }
    if (!/^[A-Z0-9]{1,3}$/.test(shownLogo)) e.logo = 'Use 1 to 3 letters or digits.';
    const mail = email.trim();
    if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) e.email = 'Enter a valid email or leave it empty.';
    const year = established.trim() ? Number(established) : null;
    if (year != null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) e.established = 'Enter a year like 2015.';
    setErrors(e);
    setFailure(null);
    if (Object.keys(e).length) return;
    try {
      const id = await save.mutateAsync({
        id: editingId,
        input: {
          name: n,
          tagline: tagline.trim(),
          logo_text: shownLogo,
          theme_color: color,
          address: address.trim(),
          phone: phone.trim(),
          email: mail,
          established: year,
        },
      });
      toast.toast(editingId ? 'Institute updated' : `${n} created`, 'success');
      if (editingId) navigation.goBack();
      else navigation.replace('Institute', { id });
    } catch (err) {
      setFailure(describeInstituteError(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <RealTopBar title={editingId ? 'Edit institute' : 'New institute'} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={failure} />

        <Row gap={spacing.md} style={{ marginBottom: spacing.xl }}>
          <CenterMark text={shownLogo} color={color} size={56} />
          <View style={{ flex: 1 }}>
            <AppText variant="heading" numberOfLines={2}>
              {name.trim() || 'Your institute'}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={2}>
              {tagline.trim() || 'Students and parents see this on every section.'}
            </AppText>
          </View>
        </Row>

        <View style={{ gap: spacing.lg }}>
          <FormField
            label="Institute name"
            placeholder="e.g. Sunrise Academy"
            maxLength={INSTITUTE_LIMITS.nameMax}
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
            }}
            error={errors.name}
          />
          <FormField
            label="Tagline"
            placeholder="e.g. Board and JEE coaching since 2015"
            maxLength={INSTITUTE_LIMITS.taglineMax}
            value={tagline}
            onChangeText={setTagline}
            hint="Optional"
          />
          <FormField
            label="Logo letters"
            placeholder={initialsOf(name) || 'SA'}
            maxLength={3}
            autoCapitalize="characters"
            value={logo}
            onChangeText={(t) => {
              setLogo(t.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              if (errors.logo) setErrors((x) => ({ ...x, logo: undefined }));
            }}
            error={errors.logo}
            hint="Up to 3 letters; the name’s initials if empty"
          />
        </View>

        <AppText variant="overline" tone="muted" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          COLOUR
        </AppText>
        <Row gap={spacing.md} wrap>
          {INSTITUTE_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="radio"
              accessibilityState={{ selected: color === c }}
              accessibilityLabel={`Colour ${c}`}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: c,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: color === c ? 3 : 0,
                borderColor: colors.surface,
              }}
            >
              {color === c ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
            </Pressable>
          ))}
        </Row>

        <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
          <FormField label="Address" placeholder="Street, area, city" maxLength={INSTITUTE_LIMITS.addressMax} multiline value={address} onChangeText={setAddress} hint="Optional" />
          <Row gap={spacing.md} align="flex-start">
            <FormField
              label="Phone"
              placeholder="+91 98…"
              keyboardType="phone-pad"
              maxLength={INSTITUTE_LIMITS.phoneMax}
              value={phone}
              onChangeText={setPhone}
              containerStyle={{ flex: 1 }}
            />
            <FormField
              label="Since"
              placeholder="2015"
              keyboardType="number-pad"
              maxLength={4}
              value={established}
              onChangeText={(t) => {
                setEstablished(t.replace(/\D/g, ''));
                if (errors.established) setErrors((x) => ({ ...x, established: undefined }));
              }}
              error={errors.established}
              containerStyle={{ width: 110 }}
            />
          </Row>
          <FormField
            label="Email"
            placeholder="office@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={INSTITUTE_LIMITS.emailMax}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
            }}
            error={errors.email}
          />
        </View>

        <Button
          label={editingId ? 'Save changes' : 'Create institute'}
          iconName={editingId ? 'checkmark-circle-outline' : 'add-circle-outline'}
          size="lg"
          fullWidth
          loading={save.isPending}
          onPress={submit}
          style={{ marginTop: spacing.xxl }}
        />
        {editingId ? null : (
          <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.md }}>
            You’ll be the owner. Next: add sections (e.g. Class 10-A), their subjects, and invite teachers.
          </AppText>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
