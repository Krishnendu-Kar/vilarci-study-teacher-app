import { Linking, Share } from 'react-native';

const digits = (phone: string) => phone.replace(/\D/g, '');

/** Opens a WhatsApp chat with an optional prefilled message. */
export function openWhatsApp(phone: string, text?: string) {
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return Linking.openURL(`https://wa.me/${digits(phone)}${query}`).catch(() => {});
}

/** WhatsApp share without a fixed recipient — the teacher picks the chat. */
export function shareOnWhatsApp(text: string) {
  return Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => {});
}

export function callPhone(phone: string) {
  return Linking.openURL(`tel:${digits(phone)}`).catch(() => {});
}

/** Native share sheet; resolves false when the platform has no share target. */
export async function shareText(message: string): Promise<boolean> {
  try {
    await Share.share({ message });
    return true;
  } catch {
    return false;
  }
}
