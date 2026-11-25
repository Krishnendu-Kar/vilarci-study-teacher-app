import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { useAuth } from '../../lib/AuthProvider';
import { AppText, IconName } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { RealTopBar } from '../../components/real/RealTopBar';

/** Placeholder for real-app sections that aren't built yet. */
export function ComingSoonScreen({ title: titleProp, icon: iconProp }: { title?: string; icon?: IconName } = {}) {
  const { colors } = useTheme();
  const { enterDemo } = useAuth();
  const params = (useRoute().params ?? {}) as { title?: string; icon?: IconName };
  const title = titleProp ?? params.title ?? 'This section';
  const icon = iconProp ?? params.icon ?? 'construct-outline';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title={title} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
        <View style={[styles.badge, { backgroundColor: colors.primarySubtle }]}>
          <Ionicons name={icon} size={38} color={colors.primary} />
        </View>
        <View style={[styles.soonPill, { backgroundColor: colors.goldSubtle }]}>
          <Ionicons name="hourglass-outline" size={13} color={colors.gold} />
          <AppText variant="overline" style={{ color: colors.gold }}>
            COMING SOON
          </AppText>
        </View>
        <AppText variant="display" center style={{ marginTop: spacing.md }}>
          {title}
        </AppText>
        <AppText variant="body" tone="secondary" center style={{ marginTop: spacing.sm, maxWidth: 320 }}>
          We’re connecting this to your real account next. You can already see how it will work in the demo.
        </AppText>
        <Button label={`Preview ${title} in the demo`} iconName="play-circle-outline" variant="secondary" onPress={enterDemo} style={{ marginTop: spacing.xl }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  soonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.lg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
});
