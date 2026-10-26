import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { useAppStore, type ThemeMode } from '../lib/store/useAppStore';
import { useTeacher } from '../lib/api/hooks';
import { AppText, Card, KeyValue, ListRow, Row, SectionHeader } from '../components/ui/base';
import { Button } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { Segmented } from '../components/ui/Segmented';
import { useToast } from '../components/ui/Toast';
import { ScreenTitle } from '../components/ScreenTitle';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' as const },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' as const },
  { value: 'system', label: 'Auto', icon: 'phone-portrait-outline' as const },
];

export function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const teacher = useTeacher();
  const resetDemo = useAppStore((s) => s.resetDemo);
  const { toast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <Screen topInset>
        <ScreenTitle title="Settings" />

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Educator profile" subtitle="Shown to students and institute directors" />
          <Card>
            <KeyValue label="Name" value={teacher.name} />
            <KeyValue label="Specialisation" value={teacher.primary_subject} />
            <KeyValue label="Qualification" value={teacher.qualification} />
            <KeyValue label="Phone" value={teacher.phone || '—'} />
            <KeyValue label="Email" value={teacher.email || '—'} />
          </Card>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Appearance" />
          <Segmented options={THEME_OPTIONS} value={mode} onChange={(v) => setMode(v as ThemeMode)} />
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Demo data" />
          <Card>
            {confirmReset ? (
              <View>
                <AppText variant="subheading">Reset all local changes?</AppText>
                <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  Restores the original batches, institutes, students, attendance, marks, fees and honours on this
                  device, and signs back in as Er. Alok Sharma.
                </AppText>
                <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
                  <Button label="Cancel" variant="secondary" size="sm" onPress={() => setConfirmReset(false)} />
                  <Button
                    label="Reset everything"
                    variant="danger"
                    size="sm"
                    iconName="refresh"
                    onPress={() => {
                      resetDemo();
                      setConfirmReset(false);
                      toast('Demo data reset', 'info');
                    }}
                  />
                </Row>
              </View>
            ) : (
              <ListRow
                title="Reset demo data"
                subtitle="Start fresh with the original sample portal"
                iconName="refresh-outline"
                tint={colors.error}
                onPress={() => setConfirmReset(true)}
              />
            )}
          </Card>
        </View>

        <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.xxl }}>
          Vilarci Teacher · v1.0.0
        </AppText>
      </Screen>
    </View>
  );
}
