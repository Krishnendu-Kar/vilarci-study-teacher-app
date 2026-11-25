import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, spacing } from '../../theme/tokens';
import {
  describeInstituteError,
  INSTITUTE_LIMITS,
  previewStaffCode,
  StaffPreview,
  useAskToJoinInstitute,
} from '../../lib/api/institutes';
import { AppText, Card, CenterMark, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Field, FormField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { ErrorBanner } from '../../components/auth/AuthKit';
import { RealTopBar } from '../../components/real/RealTopBar';

/** A teacher joins an institute with its teachers' code (VLS-…); the owner or an admin approves. */
export function InstituteJoinScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const ask = useAskToJoinInstitute();
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<StaffPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const bare = code.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^VLS/, '');

  const check = async () => {
    setFailure(null);
    setChecking(true);
    try {
      const found = await previewStaffCode(bare);
      if (!found) setFailure('No institute has this code. Check it with the institute’s owner.');
      setPreview(found);
    } catch (err) {
      setFailure(describeInstituteError(err));
    } finally {
      setChecking(false);
    }
  };

  const send = async () => {
    if (!preview) return;
    setFailure(null);
    try {
      await ask.mutateAsync({ code: bare, title: title.trim() });
      toast.toast(`Request sent to ${preview.name}`, 'success');
      navigation.replace('Institute', { id: preview.id });
    } catch (err) {
      setFailure(describeInstituteError(err));
    }
  };

  const status = preview?.my_status;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <RealTopBar title="Join an institute" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={failure} />
        <AppText variant="body" tone="secondary">
          Ask the institute’s owner for the teachers’ code (it starts with VLS). Students use a different code.
        </AppText>
        <Field
          placeholder="VLS-XXXXXX"
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase());
            setPreview(null);
            setFailure(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          style={{ marginTop: spacing.lg, fontFamily: fonts.sansSemibold, fontSize: 20, letterSpacing: 4, textAlign: 'center' }}
        />
        {preview ? null : (
          <Button
            label="Find institute"
            iconName="search-outline"
            fullWidth
            disabled={bare.length !== 6}
            loading={checking}
            onPress={check}
            style={{ marginTop: spacing.lg }}
          />
        )}

        {preview ? (
          <Card style={{ marginTop: spacing.xl }}>
            <Row gap={spacing.md} align="flex-start">
              <CenterMark text={preview.logo_text} color={preview.theme_color} size={48} />
              <View style={{ flex: 1 }}>
                <AppText variant="heading">{preview.name}</AppText>
                {preview.tagline ? (
                  <AppText variant="caption" tone="muted">
                    {preview.tagline}
                  </AppText>
                ) : null}
                <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
                  Owner: {preview.owner_name} · {preview.teachers} teacher{preview.teachers === 1 ? '' : 's'} · {preview.sections} section
                  {preview.sections === 1 ? '' : 's'}
                </AppText>
                {preview.address ? (
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {preview.address}
                  </AppText>
                ) : null}
              </View>
            </Row>

            {status === 'active' ? (
              <Button
                label="You’re already a teacher here — open"
                variant="secondary"
                fullWidth
                onPress={() => navigation.replace('Institute', { id: preview.id })}
                style={{ marginTop: spacing.lg }}
              />
            ) : status === 'pending' ? (
              <Button
                label="Request already sent — open"
                variant="secondary"
                fullWidth
                onPress={() => navigation.replace('Institute', { id: preview.id })}
                style={{ marginTop: spacing.lg }}
              />
            ) : (
              <>
                <FormField
                  label="Your role there"
                  placeholder="e.g. Physics faculty"
                  maxLength={INSTITUTE_LIMITS.titleMax}
                  value={title}
                  onChangeText={setTitle}
                  hint="Optional — the owner can change it"
                  containerStyle={{ marginTop: spacing.lg }}
                />
                <Button
                  label="Ask to join"
                  iconName="send-outline"
                  fullWidth
                  loading={ask.isPending}
                  onPress={send}
                  style={{ marginTop: spacing.lg }}
                />
                <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.sm }}>
                  The owner or an admin approves you, then gives you subjects to teach.
                </AppText>
              </>
            )}
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
