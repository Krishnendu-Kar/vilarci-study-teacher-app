import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';

/**
 * Compact progress ring used inside hero panels. Deliberately minimal — a thin
 * stroke and a tight numeral, no labels competing with the surrounding type.
 */
export function MiniRing({
  value,
  size = 72,
  stroke = 5,
  color,
  track,
  caption,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  caption?: string;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;
  const tone = color ?? colors.primary;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? colors.surfaceAlt} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            fill="none"
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: fonts.sansBold,
            fontSize: size * 0.26,
            letterSpacing: -0.8,
            color: tone,
          }}
        >
          {clamped.toFixed(0)}
        </Text>
        {caption ? (
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 8, letterSpacing: 1, color: tone, opacity: 0.8 }}>
            {caption.toUpperCase()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
