import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText, Row } from './ui/base';

/**
 * Editorial page title for the utility screens (household, verify, settings,
 * help). Shows a back chevron whenever the screen was pushed onto a stack.
 */
export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const canGoBack = navigation.canGoBack();

  return (
    <View>
      {canGoBack ? (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          style={({ pressed }) => [
            {
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              marginBottom: spacing.md,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textMain} />
        </Pressable>
      ) : null}
      <Row>
        <AppText variant="display">{title}</AppText>
      </Row>
      {subtitle ? (
        <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
