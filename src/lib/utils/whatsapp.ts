// Messages to parents go through WhatsApp: the app opens a chat with the
// parent's number and the text already written; the teacher reviews and sends
// it. Nothing goes through our server (no cost, nothing stored).
import { Linking } from 'react-native';
import type { ContactCard } from '../local/types';

const RELATION: Record<string, string> = { self: 'Self', father: 'Father', mother: 'Mother', friend: 'Friend', teacher: 'Teacher' };

/** "+91 98765-43210" → "919876543210" (wa.me wants digits with the country code). */
export function waDigits(number: string): string {
  return number.replace(/\D/g, '');
}

export function whatsAppUrl(number: string, text: string): string {
  return `https://wa.me/${waDigits(number)}?text=${encodeURIComponent(text)}`;
}

/** Opens WhatsApp (or WhatsApp Web) with the message; false when it can't. */
export async function openWhatsApp(number: string, text: string): Promise<boolean> {
  try {
    await Linking.openURL(whatsAppUrl(number, text));
    return true;
  } catch {
    return false;
  }
}

/** The student's guardians who shared a WhatsApp number. */
export function reachable(contact: ContactCard[] | null | undefined): ContactCard[] {
  return (contact ?? []).filter((c) => c.whatsapp && waDigits(c.whatsapp).length >= 10);
}

/** "Father · Ravi Sen" */
export function contactLabel(c: ContactCard): string {
  const relation = c.relation === 'other' ? c.relation_other ?? 'Guardian' : RELATION[c.relation] ?? c.relation;
  return [relation, c.name].filter(Boolean).join(' · ');
}

/** "Ravi" — the greeting uses the first name. */
export function firstName(c: ContactCard): string {
  return c.name.trim().split(/\s+/)[0] || 'there';
}
