import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import { AppText } from '../ui/base';

/** Radial attendance gauge — stroke-dasharray arc, same maths as the website. */
export function AttendanceGauge({
  value,
  size = 120,
  stroke = 11,
  label = 'Attendance',
  color,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;

  const tone =
    color ?? (clamped >= 85 ? colors.success : clamped >= 70 ? colors.accent : colors.error);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.surfaceAlt}
            strokeWidth={stroke}
            fill="none"
          />
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
        <AppText
          style={{
            fontFamily: fonts.sansBold,
            fontSize: size * 0.21,
            color: tone,
            letterSpacing: -0.5,
          }}
        >
          {clamped.toFixed(0)}%
        </AppText>
        <AppText variant="overline" tone="muted">
          {label.toUpperCase()}
        </AppText>
      </View>
    </View>
  );
}
