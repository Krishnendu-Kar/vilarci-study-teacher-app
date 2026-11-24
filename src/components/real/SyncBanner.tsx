import React from 'react';
import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { useLocalStore } from '../../lib/local/store';
import { requestSync } from '../../lib/sync/engine';
import { useConnection } from '../../lib/network';
import { AppText } from '../ui/base';

/**
 * Above a screen's content:
 * - an edit the server turned down (tap to dismiss);
 * - edits waiting to upload while offline (they're safe on the phone);
 * - the last sync failed while online: what's shown is from the phone (tap to retry).
 */
export function SyncBanner() {
  const { colors } = useTheme();
  const error = useLocalStore((s) => s.syncError);
  const refused = useLocalStore((s) => s.refused);
  const pending = useLocalStore((s) => s.pending);
  const syncing = useLocalStore((s) => s.syncing);
  const lastSyncedAt = useLocalStore((s) => s.lastSyncedAt);
  const offline = useConnection() === 'offline';

  if (refused) {
    return (
      <Banner
        icon="alert-circle-outline"
        text={refused}
        action="OK"
        label="Dismiss"
        onPress={() => useLocalStore.setState({ refused: null })}
        bg={colors.errorBg}
        fg={colors.errorText}
      />
    );
  }
  // With no internet the yellow bar at the bottom already says so; say the edits are safe.
  if (offline) {
    if (!pending) return null;
    return (
      <Banner
        icon="cloud-upload-outline"
        text={`${pending} change${pending === 1 ? '' : 's'} saved on this phone. They upload when you’re back online.`}
        bg={colors.infoBg}
        fg={colors.infoText}
      />
    );
  }
  if (!error) return null;
  return (
    <Banner
      icon="cloud-offline-outline"
      text={`${error}${lastSyncedAt ? ` Last updated ${lastUpdated(lastSyncedAt)}.` : ''}`}
      action={syncing ? '…' : 'Retry'}
      label="Try to refresh again"
      onPress={() => requestSync()}
      bg={colors.warningBg}
      fg={colors.warningText}
    />
  );
}

function Banner({
  icon,
  text,
  action,
  label,
  onPress,
  bg,
  fg,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
  action?: string;
  label?: string;
  onPress?: () => void;
  bg: string;
  fg: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: bg,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={fg} />
      <AppText variant="caption" style={{ flex: 1, color: fg }}>
        {text}
      </AppText>
      {action ? (
        <AppText variant="captionStrong" style={{ color: fg }}>
          {action}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function lastUpdated(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? `at ${time}` : `on ${d.toLocaleDateString()} ${time}`;
}
