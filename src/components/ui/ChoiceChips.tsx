import React from 'react';
import { View } from 'react-native';
import { spacing } from '../../theme/tokens';
import { AppText, Chip, IconName, Row } from './base';

/** Wrapping single-choice chip group with an optional overline label. */
export function ChoiceChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <AppText variant="overline" tone="muted">
          {label.toUpperCase()}
        </AppText>
      ) : null}
      <Row gap={spacing.sm} wrap>
        {options.map((o) => (
          <Chip
            key={String(o.value)}
            label={o.label}
            icon={o.icon}
            selected={o.value === value}
            onPress={() => onChange(o.value)}
          />
        ))}
      </Row>
    </View>
  );
}
