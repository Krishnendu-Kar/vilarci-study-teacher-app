import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { usePrivateBatch } from '../../lib/api/privateBatches';
import {
  deleteNotice,
  describeNoticeError,
  editNotice,
  postNotice,
  setNoticePinned,
  useBatchNotices,
} from '../../lib/api/notices';
import type { BatchNotice } from '../../lib/local/types';
import { AppText, EmptyState } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Screen } from '../../components/ui/Screen';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';
import { NoticeCard, NoticeEditor } from '../../components/real/NoticeParts';

type Editing = { mode: 'new' } | { mode: 'edit'; notice: BatchNotice } | null;

/** A batch's notices: post, edit, pin and delete (all work offline). */
export function BatchNoticesScreen() {
  const { colors } = useTheme();
  const params = useRoute<any>().params as { id: string; compose?: boolean };
  const toast = useToast();
  const { data: b, isLoading } = usePrivateBatch(params.id);
  const notices = useBatchNotices(params.id);
  const [editing, setEditing] = useState<Editing>(params.compose ? { mode: 'new' } : null);
  const [actions, setActions] = useState<BatchNotice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BatchNotice | null>(null);

  if (isLoading || !b) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Notices" />
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <Screen>
            <EmptyState icon="alert-circle-outline" title="Batch not found" message="It may have been deleted." />
          </Screen>
        )}
      </View>
    );
  }

  const run = async (work: () => Promise<void>, done: string) => {
    try {
      await work();
      toast.toast(done, 'success');
    } catch (err) {
      toast.toast(describeNoticeError(err), 'error');
    }
  };

  /** Close the actions sheet before opening the next one (two sheets never overlap). */
  const then = (go: () => void) => {
    setActions(null);
    setTimeout(go, 300);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar
        title="Notices"
        right={<Button label="Post" iconName="add" size="sm" onPress={() => setEditing({ mode: 'new' })} />}
      />
      <Screen>
        <SyncBanner />
        <AppText variant="overline" tone="muted" numberOfLines={1}>
          {b.name.toUpperCase()}
        </AppText>
        <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.lg }}>
          Every parent in this batch sees these. Pinned ones stay on top.
        </AppText>
        {notices.length ? (
          <View style={{ gap: spacing.md }}>
            {notices.map((n) => (
              <NoticeCard key={n.id} notice={n} onMore={() => setActions(n)} />
            ))}
          </View>
        ) : (
          <>
            <EmptyState
              icon="megaphone-outline"
              title="No notices yet"
              message="Holidays, test dates, fee reminders, things to bring — post once and every parent gets it."
            />
            <Button
              label="Post a notice"
              iconName="send-outline"
              fullWidth
              onPress={() => setEditing({ mode: 'new' })}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}
      </Screen>

      {editing ? (
        <NoticeEditor
          key={editing.mode === 'edit' ? editing.notice.id : 'new'}
          initial={editing.mode === 'edit' ? editing.notice : undefined}
          batchName={b.name}
          onClose={() => setEditing(null)}
          onSave={(body, pinned) => {
            const current = editing;
            setEditing(null);
            if (current.mode === 'edit') run(() => editNotice(current.notice, body, pinned), 'Notice saved');
            else run(() => postNotice(b.id, body, pinned), 'Notice posted');
          }}
        />
      ) : null}

      <Sheet visible={actions != null} onClose={() => setActions(null)} title="Notice" scroll={false}>
        {actions ? (
          <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
            <Button
              label="Edit"
              iconName="create-outline"
              variant="secondary"
              fullWidth
              onPress={() => {
                const n = actions;
                then(() => setEditing({ mode: 'edit', notice: n }));
              }}
            />
            <Button
              label={actions.pinned ? 'Unpin' : 'Pin to top'}
              iconName="pin-outline"
              variant="secondary"
              fullWidth
              onPress={() => {
                const n = actions;
                setActions(null);
                run(() => setNoticePinned(n, !n.pinned), n.pinned ? 'Notice unpinned' : 'Notice pinned');
              }}
            />
            <Button
              label="Delete"
              iconName="trash-outline"
              variant="danger"
              fullWidth
              onPress={() => {
                const n = actions;
                then(() => setConfirmDelete(n));
              }}
            />
          </View>
        ) : null}
      </Sheet>

      <ConfirmSheet
        visible={confirmDelete != null}
        title="Delete this notice?"
        message="It disappears for every parent on their next refresh."
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          const n = confirmDelete;
          setConfirmDelete(null);
          if (n) run(() => deleteNotice(n), 'Notice deleted');
        }}
      />
    </View>
  );
}
