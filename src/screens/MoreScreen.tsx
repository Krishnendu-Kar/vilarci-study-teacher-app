import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { useDispatchLog, usePortfolio, useTeacher } from '../lib/api/hooks';
import { AppText, Avatar, Card, Divider, HeroCard, ListRow, Row, SectionHeader } from '../components/ui/base';
import { Screen } from '../components/ui/Screen';
import { AccountSheet, teacherGradient } from '../components/AccountSheet';
import { SidebarButton } from '../components/Sidebar';

/** Who you are, then everything that isn't a class: honours, preferences, help. */
export function MoreScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const teacher = useTeacher();
  const portfolio = usePortfolio();
  const log = useDispatchLog();
  const [switching, setSwitching] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <Screen topInset>
        <Row gap={spacing.md}>
          <SidebarButton />
          <AppText variant="display">More</AppText>
        </Row>

        <HeroCard style={{ marginTop: spacing.lg }}>
          <Row gap={spacing.md}>
            <Avatar initials={teacher.photo_initials} gradient={teacherGradient(teacher)} size={58} ring />
            <View style={{ flex: 1 }}>
              <AppText variant="title" style={{ color: '#FDFBF9' }} numberOfLines={1}>
                {teacher.name}
              </AppText>
              <AppText variant="caption" style={{ color: 'rgba(253,251,249,0.66)' }} numberOfLines={2}>
                {teacher.qualification}
              </AppText>
            </View>
          </Row>
          <View style={styles.heroDivider} />
          <Row>
            <HeroStat value={String(portfolio.studentCount)} label="STUDENTS" />
            <View style={styles.heroRule} />
            <HeroStat value={String(portfolio.decks.length)} label="CLASSES" />
            <View style={styles.heroRule} />
            <HeroStat value={log.reduce((s, d) => s + d.points, 0).toLocaleString('en-IN')} label="PTS AWARDED" />
          </Row>
        </HeroCard>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Workspace" />
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListRow
                title="Honours log"
                subtitle={`${log.length} awards dispatched across your classes`}
                iconName="ribbon-outline"
                tint={colors.gold}
                onPress={() => navigation.navigate('HonoursLog')}
              />
              <Divider />
              <ListRow
                title="Switch account"
                subtitle="Explore the app as another demo educator"
                iconName="people-outline"
                onPress={() => setSwitching(true)}
              />
            </View>
          </Card>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Account" />
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListRow
                title="Settings"
                subtitle="Profile, appearance, demo data"
                iconName="settings-outline"
                onPress={() => navigation.navigate('Settings')}
              />
              <Divider />
              <ListRow
                title="Help & support"
                subtitle="How the app works, points rules, contact"
                iconName="help-buoy-outline"
                onPress={() => navigation.navigate('Help')}
              />
            </View>
          </Card>
        </View>

        <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.xxl }}>
          Vilarci Teacher · v1.0.0
        </AppText>
      </Screen>
      <AccountSheet visible={switching} onClose={() => setSwitching(false)} />
    </View>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <AppText variant="metricSm" style={{ color: '#FDFBF9' }} numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="overline" style={{ color: colors.goldBright, marginTop: 2 }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(253,251,249,0.22)',
    marginVertical: spacing.lg,
  },
  heroRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(253,251,249,0.22)',
  },
});
