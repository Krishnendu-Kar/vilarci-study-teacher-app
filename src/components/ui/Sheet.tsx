import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { AppText, Row } from './base';

/** Bottom sheet modal — the mobile stand-in for the website's dialog modals. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightRatio = 0.86,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightRatio?: number;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const Body: any = scroll ? ScrollView : View;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        />
        <View
          style={{
            backgroundColor: colors.bgApp,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: `${maxHeightRatio * 100}%`,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <Row
            justify="space-between"
            align="flex-start"
            style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}
          >
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <AppText variant="title">{title}</AppText>
              {subtitle ? (
                <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={17} color={colors.textSecondary} />
            </Pressable>
          </Row>

          <Body
            style={scroll ? { paddingHorizontal: spacing.lg } : { paddingHorizontal: spacing.lg }}
            contentContainerStyle={scroll ? { paddingBottom: spacing.xl } : undefined}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
          >
            {children}
          </Body>
        </View>
      </View>
    </Modal>
  );
}
