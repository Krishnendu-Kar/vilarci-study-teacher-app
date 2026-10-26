import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/tokens';
import { useAppStore } from '../lib/store/useAppStore';
import { useDb, useTeachers } from '../lib/api/hooks';
import { batchesFor, institutesFor } from '../lib/api/selectors';
import type { Teacher } from '../lib/data/types';
import { AppText, Avatar, Pill } from './ui/base';
import { Sheet } from './ui/Sheet';
import { useToast } from './ui/Toast';

export function teacherGradient(t: Pick<Teacher, 'avatar_bg'>): [string, string] {
  return [t.avatar_bg, '#2A0712'];
}

/** Demo account switcher — each educator sees only their own realms. */
export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const db = useDb();
  const teachers = useTeachers();
  const teacherId = useAppStore((s) => s.teacherId);
  const setTeacher = useAppStore((s) => s.setTeacher);
  const { toast } = useToast();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Switch account"
      subtitle="Demo educators — each sees only their own batches and institutes"
    >
      <View style={{ gap: spacing.sm }}>
        {teachers.map((t) => {
          const active = t.id === teacherId;
          const batches = batchesFor(db, t.id).length;
          const institutes = institutesFor(db, t.id).length;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                if (!active) {
                  setTeacher(t.id);
                  toast(`Signed in as ${t.name}`, 'info');
                }
                onClose();
              }}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primarySubtle : colors.surface,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Avatar initials={t.photo_initials} gradient={teacherGradient(t)} size={44} ring={active} />
              <View style={{ flex: 1 }}>
                <AppText variant="subheading" numberOfLines={1}>
                  {t.name}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {t.primary_subject} · {t.qualification}
                </AppText>
                <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                  {batches} batch{batches === 1 ? '' : 'es'} · {institutes} institute{institutes === 1 ? '' : 's'}
                </AppText>
              </View>
              {active ? <Pill label="Active" tone="primary" /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
