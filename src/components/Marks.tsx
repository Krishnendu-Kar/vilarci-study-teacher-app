import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './ui/base';

const PODIUM = ['#D4A537', '#A7AFB8', '#B87333'];

/** Gold / silver / bronze medal for the top three, a plain #n after that. */
export function RankMark({ rank }: { rank: number }) {
  const color = PODIUM[rank - 1];
  if (!color) {
    return (
      <AppText variant="captionStrong" tone="muted">
        #{rank}
      </AppText>
    );
  }
  return (
    <View accessibilityLabel={`Rank ${rank}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Ionicons name="medal" size={18} color={color} />
      <AppText variant="captionStrong" style={{ color, fontSize: 11 }}>
        {rank}
      </AppText>
    </View>
  );
}

/** Study streak: a flame with the day count. */
export function Streak({ days, suffix = '' }: { days: number; suffix?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name="flame" size={12} color={colors.warning} />
      <AppText variant="caption" tone="muted">
        {days}d{suffix}
      </AppText>
    </View>
  );
}
