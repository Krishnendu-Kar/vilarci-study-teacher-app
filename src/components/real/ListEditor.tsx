import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { AppText, IconName, Row } from '../ui/base';

/**
 * Editable list of short strings (achievements, book titles): type, Add, and
 * remove with ✕. Enforces the same limits as the database check.
 */
export function ListEditor({
  label,
  icon,
  placeholder,
  items,
  onChange,
  maxItems,
  minLength,
  maxLength,
}: {
  label: string;
  icon: IconName;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
  maxItems: number;
  minLength: number;
  maxLength: number;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const full = items.length >= maxItems;

  const add = () => {
    const value = draft.trim();
    if (value.length < minLength) return setError(`Write at least ${minLength} characters.`);
    if (items.some((i) => i.toLowerCase() === value.toLowerCase())) return setError('That’s already in the list.');
    onChange([...items, value]);
    setDraft('');
    setError(null);
  };

  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Row justify="space-between" style={{ marginBottom: spacing.sm }}>
        <AppText variant="overline" tone="muted">
          {label.toUpperCase()}
        </AppText>
        <AppText variant="caption" tone="muted">
          {items.length}/{maxItems}
        </AppText>
      </Row>

      {items.length ? (
        <View style={{ gap: 6, marginBottom: spacing.sm }}>
          {items.map((item, i) => (
            <Row
              key={`${item}-${i}`}
              gap={spacing.sm}
              style={{
                paddingVertical: 10,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              }}
            >
              <Ionicons name={icon} size={15} color={colors.gold} />
              <AppText variant="body" style={{ flex: 1 }}>
                {item}
              </AppText>
              <Pressable
                onPress={() => onChange(items.filter((_, j) => j !== i))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item}`}
              >
                <Ionicons name="close-circle" size={19} color={colors.textMuted} />
              </Pressable>
            </Row>
          ))}
        </View>
      ) : null}

      {full ? (
        <AppText variant="caption" tone="muted">
          You’ve added the maximum of {maxItems}.
        </AppText>
      ) : (
        <Row gap={spacing.sm}>
          <TextInput
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              if (error) setError(null);
            }}
            onSubmitEditing={add}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            maxLength={maxLength}
            returnKeyType="done"
            style={{
              flex: 1,
              minWidth: 0,
              paddingVertical: 12,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderWidth: error ? 1.5 : StyleSheet.hairlineWidth,
              borderColor: error ? colors.error : colors.border,
              backgroundColor: colors.surfaceMuted,
              color: colors.textMain,
              fontFamily: fonts.sans,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={add}
            accessibilityRole="button"
            accessibilityLabel={`Add to ${label}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: spacing.md,
              paddingVertical: 12,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="add" size={17} color="#fff" />
            <AppText variant="captionStrong" style={{ color: '#fff' }}>
              Add
            </AppText>
          </Pressable>
        </Row>
      )}
      {error ? (
        <AppText variant="caption" tone="error" style={{ marginTop: 6 }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
