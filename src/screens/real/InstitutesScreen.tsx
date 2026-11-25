import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { isInstituteAdmin, ROLE_LABELS, useInstitutes } from '../../lib/api/institutes';
import type { Institute } from '../../lib/local/types';
import { useRefresh } from '../../lib/sync/useRefresh';
import { AppText, CenterMark, Divider, EmptyState, Pill, PressableCard, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';

/** The institutes this teacher runs, teaches at or asked to join. */
export function InstitutesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { data, isLoading } = useInstitutes();
  const { refreshing, refresh } = useRefresh();
  const live = data.filter((i) => i.deleted_at == null);
  const deleted = data.filter((i) => i.deleted_at != null && i.my_role === 'owner');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title="Institutes" />
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <SyncBanner />
        <Row gap={spacing.sm}>
          <Button
            label="Join with code"
            iconName="enter-outline"
            variant="secondary"
            onPress={() => navigation.navigate('InstituteJoin')}
            style={{ flex: 1 }}
            fullWidth
          />
          <Button label="Create" iconName="add" onPress={() => navigation.navigate('InstituteForm')} style={{ flex: 1 }} fullWidth />
        </Row>

        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : live.length ? (
            live.map((inst) => (
              <InstituteCard key={inst.id} inst={inst} onPress={() => navigation.navigate('Institute', { id: inst.id })} />
            ))
          ) : (
            <EmptyState
              icon="business-outline"
              title="No institute yet"
              message="Create your coaching institute — add teachers, sections and subjects — or join one with the teachers’ code its owner shares."
            />
          )}
        </View>

        {deleted.length ? (
          <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
            <AppText variant="overline" tone="muted">
              DELETED
            </AppText>
            {deleted.map((inst) => (
              <InstituteCard key={inst.id} inst={inst} onPress={() => navigation.navigate('Institute', { id: inst.id })} />
            ))}
          </View>
        ) : null}
      </Screen>
    </View>
  );
}

function InstituteCard({ inst, onPress }: { inst: Institute; onPress: () => void }) {
  const { colors } = useTheme();
  const pending = inst.my_status === 'pending';
  const sections = (inst.sections ?? []).filter((s) => s.deleted_at == null);
  const teachers = (inst.members ?? []).filter((m) => m.status === 'active').length;
  const waiting =
    isInstituteAdmin(inst) &&
    ((inst.members ?? []).filter((m) => m.status === 'pending').length + sections.reduce((n, s) => n + s.requests, 0));
  return (
    <PressableCard level={1} onPress={onPress}>
      <Row gap={spacing.md} align="flex-start">
        <CenterMark text={inst.logo_text} color={inst.theme_color} size={46} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading" numberOfLines={2}>
            {inst.name}
          </AppText>
          {inst.tagline ? (
            <AppText variant="caption" tone="muted" numberOfLines={2}>
              {inst.tagline}
            </AppText>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Row>
      <Row gap={5} wrap style={{ marginTop: spacing.md }}>
        {pending ? (
          <Pill label="Request sent — waiting for approval" tone="warning" icon="time-outline" />
        ) : inst.deleted_at != null ? (
          <Pill label="Deleted" tone="error" icon="trash-outline" />
        ) : (
          <Pill
            label={ROLE_LABELS[inst.my_role]}
            tone={inst.my_role === 'owner' ? 'gold' : 'primary'}
            icon={inst.my_role === 'owner' ? 'star' : inst.my_role === 'admin' ? 'shield-checkmark-outline' : 'briefcase-outline'}
          />
        )}
        {waiting ? <Pill label={`${waiting} waiting`} tone="accent" icon="person-add-outline" /> : null}
      </Row>
      {pending || inst.deleted_at != null ? null : (
        <>
          <Divider style={{ marginVertical: spacing.md }} />
          <Row justify="space-between">
            <Metric value={String(sections.length)} label="Sections" />
            <Metric value={String(sections.reduce((n, s) => n + s.subjects.length, 0))} label="Subjects" />
            <Metric value={String(sections.reduce((n, s) => n + s.students, 0))} label="Students" />
            <Metric value={String(teachers)} label="Teachers" />
          </Row>
        </>
      )}
    </PressableCard>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <AppText variant="metricSm">{value}</AppText>
      <AppText variant="overline" tone="muted">
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}
