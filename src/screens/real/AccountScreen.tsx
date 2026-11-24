import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';
import { accountName, accountWhatsapp, useAuth } from '../../lib/AuthProvider';
import { formatDateLong } from '../../lib/utils/format';
import { AppText, Card, Chip, Divider, KeyValue, ListRow, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { AuthField, ErrorBanner } from '../../components/auth/AuthKit';
type Gender = 'male' | 'female' | 'other';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

/** The account owner's details (public.users, from the phone's copy). */
export function AccountScreen() {
  const { colors, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { session, profile, refreshProfile, enterDemo } = useAuth();

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [middleName, setMiddleName] = useState(profile?.middle_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const startEdit = () => {
    setFirstName(profile?.first_name ?? '');
    setMiddleName(profile?.middle_name ?? '');
    setLastName(profile?.last_name ?? '');
    setGender(profile?.gender ?? null);
    setFailure(null);
    setEditing(true);
  };

  const saveDetails = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setFailure('First and last name are required.');
      return;
    }
    if (!session) return;
    setBusy(true);
    setFailure(null);
    const { error } = await supabase.rpc('account_update', {
      p_data: { first_name: firstName.trim(), middle_name: middleName.trim(), last_name: lastName.trim(), gender },
    });
    if (error) {
      setBusy(false);
      setFailure(/network|fetch|timed? ?out/i.test(error.message) ? 'No connection. Check your internet and try again.' : error.message);
      return;
    }
    await refreshProfile();
    setBusy(false);
    setEditing(false);
    toast.toast('Your details are saved', 'success');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Row gap={spacing.md} style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="arrow-back" size={19} color={colors.textMain} />
        </Pressable>
        <AppText variant="title" style={{ flex: 1 }}>
          My account
        </AppText>
      </Row>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <SectionHeader
          title="Account owner"
          subtitle="Same account as Vilarci Study"
          action={editing ? undefined : 'Edit'}
          onAction={startEdit}
        />
        <Card>
          <ErrorBanner message={failure} />
          {editing ? (
            <>
              <AuthField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
              <AuthField label="Middle name" optional value={middleName} onChangeText={setMiddleName} autoCapitalize="words" />
              <AuthField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
              <AppText variant="overline" tone="muted" style={{ marginBottom: spacing.sm }}>
                GENDER
              </AppText>
              <Row gap={spacing.sm} wrap style={{ marginBottom: spacing.lg }}>
                {GENDERS.map((g) => (
                  <Chip key={g.value} label={g.label} selected={gender === g.value} onPress={() => setGender(g.value)} />
                ))}
              </Row>
              <Row gap={spacing.sm}>
                <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} fullWidth />
                <Button label="Save" iconName="checkmark" loading={busy} onPress={saveDetails} style={{ flex: 1 }} fullWidth />
              </Row>
            </>
          ) : (
            <>
              <KeyValue label="Name" value={accountName(profile, session)} />
              <KeyValue label="Gender" value={profile?.gender ? capitalise(profile.gender) : '—'} />
              <KeyValue label="Date of birth" value={profile?.dob ? formatDateLong(profile.dob) : '—'} />
              <Divider style={{ marginVertical: spacing.sm }} />
              <KeyValue label="WhatsApp" value={accountWhatsapp(profile, session) ?? '—'} />
              <KeyValue label="Email" value={profile?.email ?? session?.user.email ?? '—'} />
              <KeyValue
                label="Member since"
                value={profile?.created_at ? formatDateLong(profile.created_at.slice(0, 10)) : '—'}
              />
              <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                WhatsApp number, email and date of birth are verified at signup and can't be changed here.
              </AppText>
            </>
          )}
        </Card>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Appearance" />
          <Row gap={spacing.sm} wrap>
            {(['light', 'dark', 'system'] as const).map((m) => (
              <Chip key={m} label={capitalise(m)} selected={mode === m} onPress={() => setMode(m)} />
            ))}
          </Row>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListRow title="Open the demo" subtitle="Preview the screens we're building next" iconName="play-circle-outline" onPress={enterDemo} />
              <Divider />
              {confirmLogout ? (
                <View style={{ paddingVertical: spacing.md }}>
                  <AppText variant="subheading">Log out of Vilarci Teacher?</AppText>
                  <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
                    <Button label="Cancel" variant="secondary" size="sm" onPress={() => setConfirmLogout(false)} />
                    <Button
                      label="Log out"
                      variant="danger"
                      size="sm"
                      iconName="log-out-outline"
                      onPress={() => signOut().catch((err) => toast.toast((err as Error)?.message || 'Couldn’t log out. Try again.', 'error'))}
                    />
                  </Row>
                </View>
              ) : (
                <ListRow title="Log out" iconName="log-out-outline" tint={colors.error} onPress={() => setConfirmLogout(true)} />
              )}
            </View>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
