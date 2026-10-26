import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { useTeacher } from '../lib/api/hooks';
import { AppText, Avatar, Row } from './ui/base';
import { AccountSheet, teacherGradient } from './AccountSheet';
import { SidebarButton, type SidebarContext } from './Sidebar';

export { AccountSheet, teacherGradient };

/**
 * Slim app bar: the sidebar toggle at top left, then which educator is signed
 * in. Tapping the name opens the demo account switcher.
 */
export function TeacherHeader({
  overline,
  right,
  sidebar,
}: {
  overline?: string;
  right?: React.ReactNode;
  sidebar?: SidebarContext;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const teacher = useTeacher();
  const [open, setOpen] = useState(false);

  return (
    <View
      style={{
        backgroundColor: colors.bgApp,
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
      }}
    >
      <Row justify="space-between" gap={spacing.md}>
        <SidebarButton context={sidebar} />
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Switch teacher account"
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Avatar initials={teacher.photo_initials} gradient={teacherGradient(teacher)} size={40} ring />
          <View style={{ flex: 1 }}>
            <AppText variant="overline" tone="muted" numberOfLines={1}>
              {(overline ?? `${teacher.primary_subject} specialist`).toUpperCase()}
            </AppText>
            <Row gap={3}>
              <AppText variant="subheading" numberOfLines={1} style={{ flexShrink: 1 }}>
                {teacher.name}
              </AppText>
              <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
            </Row>
          </View>
        </Pressable>
        {right}
      </Row>

      <AccountSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}
