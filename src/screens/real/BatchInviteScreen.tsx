import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import {
  describeBatchError,
  gradeBoardLabel,
  joinLinkFor,
  useBatchRoster,
  usePrivateBatch,
  useResetJoinCode,
} from '../../lib/api/privateBatches';
import { AppText, Card, EmptyState, IconName, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Screen } from '../../components/ui/Screen';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';
import { QrCode } from '../../components/real/QrCode';

/**
 * How students get into a batch: a QR the student app scans, the join link
 * and the code. The QR holds the link, so a phone camera opens it too.
 */
export function BatchInviteScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const id: string = useRoute<any>().params?.id;
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { data: b, isLoading } = usePrivateBatch(id);
  const { data: roster } = useBatchRoster(id);
  const reset = useResetJoinCode();
  const [confirmReset, setConfirmReset] = useState(false);

  if (isLoading || !b) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Add students" />
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <Screen>
            <EmptyState icon="alert-circle-outline" title="Batch not found" message="It may have been deleted." />
          </Screen>
        )}
      </View>
    );
  }

  const link = joinLinkFor(b.join_code);
  const level = gradeBoardLabel(b);
  const members = roster.filter((r) => r.status === 'approved').length;
  const waiting = roster.filter((r) => r.status === 'pending').length;
  const full = members >= b.capacity;
  const qrSize = Math.min(240, width - spacing.lg * 2 - 96);

  const share = () =>
    Share.share({
      message:
        `Join my ${b.subject} batch "${b.name}"${level ? ` (${level})` : ''} on Vilarci Study.\n\n` +
        `Tap to join: ${link}\nJoin code: ${b.join_code}\n\nOr open Vilarci Study → Join a batch → Scan QR.`,
    }).catch(() => {});

  const newCode = async () => {
    setConfirmReset(false);
    try {
      const code = await reset.mutateAsync(b.id);
      toast.toast(`New join code: ${code}`, 'success');
    } catch (err) {
      toast.toast(describeBatchError(err), 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title="Add students" />
      <Screen>
        <SyncBanner />
        <AppText variant="overline" tone="muted" numberOfLines={1}>
          {b.name.toUpperCase()}
        </AppText>

        {/* ── Scan to join ─────────────────────────────────────────────── */}
        <Card style={{ marginTop: spacing.sm, alignItems: 'center' }}>
          <AppText variant="subheading" center>
            Scan to join
          </AppText>
          <AppText variant="caption" tone="muted" center style={{ marginTop: 2 }}>
            In Vilarci Study: Join a batch → Scan QR code
          </AppText>
          <View style={[styles.qrFrame, { borderColor: colors.border }]}>
            {reset.isPending ? (
              <View style={{ width: qrSize, height: qrSize, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <QrCode value={link} size={qrSize} />
            )}
          </View>
          <AppText variant="overline" tone="muted">
            JOIN CODE
          </AppText>
          <AppText selectable style={[styles.code, { color: colors.textMain }]}>
            {b.join_code}
          </AppText>
          <AppText variant="caption" tone="muted" selectable numberOfLines={1} center>
            {link}
          </AppText>
          <Button label="Share join link" iconName="share-social-outline" fullWidth onPress={share} style={{ marginTop: spacing.lg }} />
        </Card>

        {/* ── Seats ────────────────────────────────────────────────────── */}
        <Card style={{ marginTop: spacing.lg }} accentColor={full ? colors.error : undefined}>
          <Row justify="space-between">
            <AppText variant="bodyStrong">Seats</AppText>
            <AppText variant="bodyStrong" style={{ color: full ? colors.error : colors.textMain }}>
              {members} of {b.capacity} filled
            </AppText>
          </Row>
          {full ? (
            <AppText variant="caption" tone="error" style={{ marginTop: 4 }}>
              The batch is full — increase seats in Edit batch to accept more.
            </AppText>
          ) : null}
          {waiting ? (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ marginTop: spacing.sm }}>
              <Row gap={4}>
                <AppText variant="captionStrong" tone="primary">
                  {waiting} request{waiting === 1 ? '' : 's'} waiting — review on the batch page
                </AppText>
                <Ionicons name="chevron-forward" size={13} color={colors.primary} />
              </Row>
            </Pressable>
          ) : null}
        </Card>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="How students join" />
          <Card>
            <Step n={1} icon="qr-code-outline" text="They scan this QR in Vilarci Study (Join a batch), open the link, or type the code." />
            <Step n={2} icon="person-outline" text="They choose which student is joining and send a request." />
            <Step n={3} icon="checkmark-circle-outline" text="You accept each request on the batch page. Then they see the timetable, attendance and fees." last />
          </Card>
        </View>

        {/* ── New code ─────────────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <Button
            label="Get a new code"
            iconName="refresh-outline"
            variant="ghost"
            fullWidth
            loading={reset.isPending}
            onPress={() => setConfirmReset(true)}
          />
          <AppText variant="caption" tone="muted" center>
            For a link that was shared too widely. Students already in the batch stay.
          </AppText>
        </View>
      </Screen>

      <ConfirmSheet
        visible={confirmReset}
        title="Get a new join code?"
        message="The current link, QR and code stop working right away. Students already in the batch aren't affected. Needs the internet."
        confirmLabel="New code"
        onClose={() => setConfirmReset(false)}
        onConfirm={newCode}
      />
    </View>
  );
}

function Step({ n, icon, text, last }: { n: number; icon: IconName; text: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Row gap={spacing.md} align="flex-start" style={{ marginBottom: last ? 0 : spacing.md }}>
      <View style={[styles.stepBadge, { backgroundColor: colors.primarySubtle }]}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="captionStrong" tone="muted">
          STEP {n}
        </AppText>
        <AppText variant="body" tone="secondary">
          {text}
        </AppText>
      </View>
    </Row>
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
  stepBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
