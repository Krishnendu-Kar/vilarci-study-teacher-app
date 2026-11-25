import React, { useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { describeInstituteError, isInstituteAdmin, useInstitute, useResetInstituteCode } from '../../lib/api/institutes';
import { joinLinkFor } from '../../lib/api/privateBatches';
import { AppText, Card, EmptyState, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Screen } from '../../components/ui/Screen';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { QrCode } from '../../components/real/QrCode';

type Which = 'students' | 'staff';

/**
 * The institute's two codes. Students: one QR / link / code for the whole
 * institute — families see its sections, pick one and ask to join (admins
 * approve on the section). Teachers: a separate code to ask to join as staff.
 */
export function InstituteCodesScreen() {
  const { colors } = useTheme();
  const route = useRoute<any>();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const inst = useInstitute(route.params?.id);
  const reset = useResetInstituteCode();
  const [which, setWhich] = useState<Which>(route.params?.which === 'staff' ? 'staff' : 'students');
  const [confirmReset, setConfirmReset] = useState(false);

  if (!inst || !isInstituteAdmin(inst)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Institute codes" />
        <Screen>
          <EmptyState icon="lock-closed-outline" title="Only the owner and admins" message="Ask them for the institute’s codes." />
        </Screen>
      </View>
    );
  }

  const code = (which === 'students' ? inst.join_code : inst.staff_code) ?? '';
  const link = joinLinkFor(code);
  const qrSize = Math.min(240, width - spacing.lg * 2 - 96);
  const sections = (inst.sections ?? []).filter((s) => s.deleted_at == null).length;

  const share = () =>
    Share.share({
      message:
        which === 'students'
          ? `Join ${inst.name} on Vilarci Study — pick your class and ask to join.\n\nTap: ${link}\nInstitute code: ${code}\n\nOr open Vilarci Study → Join → Scan QR.`
          : `You're invited to teach at ${inst.name} on Vilarci Teacher.\n\nIn the app: Institutes → Join with code → ${code}`,
    }).catch(() => {});

  const newCode = async () => {
    setConfirmReset(false);
    try {
      await reset.mutateAsync({ id: inst.id, which });
      toast.toast('New code ready', 'success');
    } catch (err) {
      toast.toast(describeInstituteError(err), 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title="Institute codes" />
      <Screen>
        <Segmented
          options={[
            { value: 'students', label: 'Students' },
            { value: 'staff', label: 'Teachers' },
          ]}
          value={which}
          onChange={(v) => setWhich(v as Which)}
        />

        <Card style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <AppText variant="subheading" center>
            {which === 'students' ? 'Students scan to join' : 'Teachers join with this code'}
          </AppText>
          <AppText variant="caption" tone="muted" center style={{ marginTop: 2 }}>
            {which === 'students'
              ? `They see your ${sections} section${sections === 1 ? '' : 's'}, pick one and ask to join`
              : 'In Vilarci Teacher: Institutes → Join with code'}
          </AppText>
          {which === 'students' ? (
            <View style={[styles.qrFrame, { borderColor: colors.border }]}>
              {reset.isPending ? (
                <View style={{ width: qrSize, height: qrSize, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <QrCode value={link} size={qrSize} />
              )}
            </View>
          ) : (
            <View style={{ height: spacing.xl }} />
          )}
          <AppText variant="overline" tone="muted">
            {which === 'students' ? 'INSTITUTE CODE' : 'TEACHERS’ CODE'}
          </AppText>
          <AppText selectable style={[styles.code, { color: colors.textMain }]}>
            {code}
          </AppText>
          {which === 'students' ? (
            <AppText variant="caption" tone="muted" selectable numberOfLines={1} center>
              {link}
            </AppText>
          ) : null}
          <Button
            label={which === 'students' ? 'Share join link' : 'Share invite'}
            iconName="share-social-outline"
            fullWidth
            onPress={share}
            style={{ marginTop: spacing.lg }}
          />
        </Card>

        <Card muted style={{ marginTop: spacing.lg }}>
          <Row gap={spacing.sm}>
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              {which === 'students'
                ? 'Each section also has its own code (on the section’s Add students page) if you want families to skip the list.'
                : 'Everyone who asks shows up on the institute page for you to accept. Then give them subjects from a section.'}
            </AppText>
          </Row>
        </Card>

        <View style={{ marginTop: spacing.xxl }}>
          <Button label="Get a new code" iconName="refresh-outline" variant="ghost" fullWidth loading={reset.isPending} onPress={() => setConfirmReset(true)} />
          <AppText variant="caption" tone="muted" center>
            For a code that was shared too widely. Nobody already in loses anything.
          </AppText>
        </View>
      </Screen>

      <ConfirmSheet
        visible={confirmReset}
        title={`New ${which === 'students' ? 'institute' : 'teachers’'} code?`}
        message="The current code (and its QR and link) stops working right away. Needs the internet."
        confirmLabel="New code"
        onClose={() => setConfirmReset(false)}
        onConfirm={newCode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  qrFrame: {
    marginVertical: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
  },
  code: { fontSize: 28, lineHeight: 36, letterSpacing: 3, fontWeight: '800', marginTop: 2 },
});
