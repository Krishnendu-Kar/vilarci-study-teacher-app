import React from 'react';
import { spacing } from '../../theme/tokens';
import { AppText, Row } from './base';
import { Button } from './Button';
import { Sheet } from './Sheet';

/**
 * Cross-platform confirmation for destructive actions. Alert.alert has no
 * buttons on web, so every irreversible tap goes through this sheet instead.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = 'Remove',
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} scroll={false}>
      <AppText variant="body" tone="secondary">
        {message}
      </AppText>
      <Row gap={spacing.sm} style={{ marginTop: spacing.xl }}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} fullWidth />
        <Button
          label={confirmLabel}
          variant="danger"
          iconName="trash-outline"
          onPress={() => {
            onConfirm();
            onClose();
          }}
          style={{ flex: 1 }}
          fullWidth
        />
      </Row>
    </Sheet>
  );
}
