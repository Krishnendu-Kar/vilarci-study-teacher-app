import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { accountName, useAuth } from '../../lib/AuthProvider';
import { signOut } from '../../lib/auth';
import { AppText, Avatar, Card, Divider, IconName, ListRow, Pill, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { useTeacherProfile } from '../../lib/api/teacherProfile';

const SOON: { title: string; icon: IconName }[] = [
  { title: 'Honours log', icon: 'trophy-outline' },
  { title: 'Settings', icon: 'settings-outline' },
  { title: 'Help & Support', icon: 'help-buoy-outline' },
];

/** More tab of the real teacher app: account, demo, sign out. */
export function MoreScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { session, profile, enterDemo } = useAuth();
  const { data: teacher } = useTeacherProfile();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const name = accountName(profile, session);
  const initials = `${profile?.first_name?.[0] ?? name[0] ?? 'V'}${profile?.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title="More" />
      <Screen>
        <Card>
          <ListRow
            title={name}
            subtitle={profile?.email ?? profile?.whatsapp_number ?? 'Your Vilarci account'}
            onPress={() => navigation.navigate('Account')}
            right={<Avatar initials={initials} gradient={['#5a0812', '#8E1437']} size={40} />}
          />
          <Divider />
          <ListRow
            title="Teacher profile"
            subtitle={teacher ? [teacher.primary_subject, teacher.qualification].filter(Boolean).join(' · ') : 'Not created yet'}
            iconName="school-outline"
            onPress={() => navigation.navigate('TeacherProfileForm')}
          />
        </Card>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Coming soon" />
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              {SOON.map((s, i) => (
                <View key={s.title}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={s.title}
                    iconName={s.icon}
                    onPress={() => navigation.navigate('ComingSoon', { title: s.title, icon: s.icon })}
                    right={<Pill label="Soon" tone="neutral" />}
                  />
                </View>
              ))}
            </View>
          </Card>
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
                      onPress={() => signOut().catch(() => toast.toast('Couldn’t log out. Try again.', 'error'))}
                    />
                  </Row>
                </View>
              ) : (
                <ListRow title="Log out" iconName="log-out-outline" tint={colors.error} onPress={() => setConfirmLogout(true)} />
              )}
            </View>
          </Card>
        </View>
      </Screen>
    </View>
  );
}
