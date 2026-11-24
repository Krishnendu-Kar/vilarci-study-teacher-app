import React, { useState } from 'react';
import { View } from 'react-native';
import { spacing } from '../../theme/tokens';
import type { ContactCard } from '../../lib/local/types';
import { contactLabel, openWhatsApp, reachable } from '../../lib/utils/whatsapp';
import { AppText } from '../ui/base';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

/**
 * Message a student's parent on WhatsApp. `send` opens the chat straight away
 * when one parent shared a number, or asks which one when there are several.
 * `text(c)` writes the message for that parent. Render `sheet` once on the screen.
 */
export function useWhatsApp(): {
  send: (contact: ContactCard[] | null | undefined, text: (c: ContactCard) => string) => void;
  sheet: React.ReactElement;
} {
  const toast = useToast();
  const [pick, setPick] = useState<{ list: ContactCard[]; text: (c: ContactCard) => string } | null>(null);

  const open = async (c: ContactCard, text: (c: ContactCard) => string) => {
    const ok = await openWhatsApp(c.whatsapp!, text(c));
    if (!ok) toast.toast('Couldn’t open WhatsApp on this phone', 'error');
  };

  const send = (contact: ContactCard[] | null | undefined, text: (c: ContactCard) => string) => {
    const list = reachable(contact);
    if (!list.length) {
      toast.toast('No WhatsApp number was shared for this student', 'error');
      return;
    }
    if (list.length === 1) open(list[0], text);
    else setPick({ list, text });
  };

  const sheet = (
    <Sheet visible={pick != null} onClose={() => setPick(null)} title="Send to" subtitle="Opens WhatsApp with the message written" scroll={false}>
      <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
        {pick?.list.map((c, i) => (
          <Button
            key={`${c.whatsapp}-${i}`}
            label={contactLabel(c)}
            iconName="logo-whatsapp"
            variant="secondary"
            fullWidth
            onPress={() => {
              const p = pick;
              setPick(null);
              if (p) setTimeout(() => open(c, p.text), 300);
            }}
          />
        ))}
        <AppText variant="caption" tone="muted" center>
          You can change the message in WhatsApp before sending.
        </AppText>
      </View>
    </Sheet>
  );

  return { send, sheet };
}
