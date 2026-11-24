import React, { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import type { BatchNotice } from '../../lib/local/types';
import { NOTICE_MAX, noticeProblem, noticeTime } from '../../lib/utils/notices';
import { AppText, Card, Pill, Row } from '../ui/base';
import { Button } from '../ui/Button';
import { FormField } from '../ui/Field';
import { Sheet } from '../ui/Sheet';

/** One notice: pinned / not uploaded yet, when, and the text. `onMore` adds the ⋯ actions. */
export function NoticeCard({ notice, lines, onMore }: { notice: BatchNotice; lines?: number; onMore?: () => void }) {
  const { colors } = useTheme();
  return (
    <Card accentColor={notice.pinned ? colors.gold : undefined}>
      <Row justify="space-between" gap={spacing.sm}>
        <Row gap={spacing.sm} wrap style={{ flex: 1 }}>
          {notice.pinned ? <Pill label="Pinned" tone="gold" icon="pin-outline" /> : null}
          {notice.pending ? <Pill label="Waiting to upload" tone="info" icon="cloud-upload-outline" /> : null}
          <AppText variant="caption" tone="muted">
            {noticeTime(notice.created_at)}
          </AppText>
        </Row>
        {onMore ? (
          <Pressable
            onPress={onMore}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Notice options"
            style={({ pressed }) => ({ padding: 2, opacity: pressed ? 0.5 : 1 })}
          >
            <Ionicons name="ellipsis-horizontal" size={19} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </Row>
      <AppText variant="body" numberOfLines={lines} selectable={!lines} style={{ marginTop: spacing.sm }}>
        {notice.body}
      </AppText>
    </Card>
  );
}

/** Write or edit a notice. Lifts above the keyboard (Sheet). */
export function NoticeEditor({
  initial,
  batchName,
  onClose,
  onSave,
}: {
  initial?: BatchNotice;
  batchName: string;
  onClose: () => void;
  onSave: (body: string, pinned: boolean) => void;
}) {
  const { colors } = useTheme();
  const [body, setBody] = useState(initial?.body ?? '');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [error, setError] = useState<string | null>(null);
  const count = body.trim().length;

  const save = () => {
    const problem = noticeProblem(body);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(body, pinned);
  };

  return (
    <Sheet visible onClose={onClose} title={initial ? 'Edit notice' : 'New notice'} subtitle={`To every parent in ${batchName}`}>
      <FormField
        label={`Notice (${count}/${NOTICE_MAX})`}
        placeholder="e.g. No class on Friday for Diwali. Test on chapter 4 next Tuesday."
        multiline
        maxLength={NOTICE_MAX}
        value={body}
        autoFocus={!initial}
        onChangeText={(t) => {
          setBody(t);
          if (error) setError(null);
        }}
        error={error}
        style={{ minHeight: 140, textAlignVertical: 'top' }}
      />
      <Row justify="space-between" gap={spacing.md} style={{ marginTop: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">Pin to top</AppText>
          <AppText variant="caption" tone="muted">
            Stays above newer notices until you unpin it.
          </AppText>
        </View>
        <Switch
          value={pinned}
          onValueChange={setPinned}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Pin to top"
        />
      </Row>
      <Button
        label={initial ? 'Save notice' : 'Post notice'}
        iconName={initial ? 'checkmark' : 'send-outline'}
        fullWidth
        onPress={save}
        style={{ marginTop: spacing.lg }}
      />
      <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.sm }}>
        Saved on this phone at once; parents see it after their next refresh.
      </AppText>
    </Sheet>
  );
}
