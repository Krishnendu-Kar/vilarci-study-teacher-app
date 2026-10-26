import React, { useEffect, useRef } from 'react';
import { RefreshControl, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';

/**
 * Standard screen shell: app canvas background, safe-area aware padding and a
 * bottom gutter that clears the tab bar.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshing,
  onRefresh,
  contentStyle,
  topInset = false,
  resetKey,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  topInset?: boolean;
  /** Changing this scrolls back to the top, e.g. when an in-screen tab switches. */
  resetKey?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [resetKey]);

  const padding: ViewStyle = {
    paddingHorizontal: padded ? spacing.lg : 0,
    paddingTop: topInset ? insets.top + spacing.md : spacing.md,
    paddingBottom: spacing.xxxl,
  };

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.bgApp }, padding, contentStyle]}>{children}</View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.bgApp }}
      contentContainerStyle={[padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
