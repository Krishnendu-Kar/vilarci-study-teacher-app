import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { AppText, Card, Divider, ListRow, SectionHeader } from '../components/ui/base';
import { Screen } from '../components/ui/Screen';
import { ScreenTitle } from '../components/ScreenTitle';
import { callPhone } from '../lib/utils/contact';

const SUPPORT_EMAIL = 'support@vilarci.study';
const SUPPORT_PHONE = '+91 80 4567 1200';

const FAQ = [
  {
    q: 'What is the difference between Batches and Institutes?',
    a: 'Batches are your own private tuitions — you set the fee, timings and roster. Institutes are coaching centres you own or teach at; there you work inside class sections such as Class 10-A, alongside other subject faculty.',
  },
  {
    q: 'How do students join my batch?',
    a: 'Open the batch, go to Students → Add, and share the invite link or join code. Students enter it in the Vilarci Study app and arrive with OTP-verified parent contacts. You can also register a student directly.',
  },
  {
    q: 'My batch meets only once or twice a week. How do extra or cancelled classes work?',
    a: 'Set only the regular days in Settings. For one-off changes open the batch → Classes: add an extra class (before a test, a make-up class) or cancel one with a reason, and tell parents on WhatsApp in one tap. Attendance, homework due dates and Today all follow this real calendar.',
  },
  {
    q: 'How do I record homework?',
    a: 'Open the batch → Homework → Give homework. It is due at the next class by default. At that class, tap Check homework and mark each student Full, Partial or None. Each student builds a homework record (full counts 100%, partial 50%) shown on the roster, and you can message parents of students who skipped it.',
  },
  {
    q: 'How do attendance points work?',
    a: 'Students earn +10 points for an on-time QR check-in from their app (+5 when late). Your saved register is the record of truth; late counts as half an attendance in rates.',
  },
  {
    q: 'Do I award points from here?',
    a: 'Yes. In any batch, open Points, pick a student, an amount (+50 to +200), a category and a citation. The batch leaderboard re-ranks instantly and the award appears in the student and parent apps.',
  },
  {
    q: 'Does Vilarci issue fee receipts?',
    a: 'No. Vilarci is an academic record keeper. The Fees view keeps a month-by-month ledger of what was paid and how, but never generates legal receipts.',
  },
  {
    q: 'Why can I not record fees or edit settings in some sections?',
    a: 'Institute directors decide what visiting faculty may do. Where fees are managed centrally, the ledger is view-only for you.',
  },
];

export function HelpScreen() {
  const { colors } = useTheme();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <Screen topInset>
        <ScreenTitle title="Help & support" subtitle="How Vilarci Teacher works" />

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Frequently asked" />
          <Card padded={false}>
            {FAQ.map((item, idx) => (
              <View key={item.q}>
                {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                <Pressable
                  onPress={() => setOpen(open === idx ? null : idx)}
                  style={({ pressed }) => [{ padding: spacing.lg, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
                    <AppText variant="subheading" style={{ flex: 1 }}>
                      {item.q}
                    </AppText>
                    <Ionicons name={open === idx ? 'remove' : 'add'} size={18} color={colors.textMuted} />
                  </View>
                  {open === idx ? (
                    <AppText variant="body" tone="secondary" style={{ marginTop: spacing.sm }}>
                      {item.a}
                    </AppText>
                  ) : null}
                </Pressable>
              </View>
            ))}
          </Card>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Contact" />
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListRow
                title="Call support"
                subtitle={`${SUPPORT_PHONE} · Mon–Sat, 9 AM – 7 PM`}
                iconName="call-outline"
                tint={colors.success}
                onPress={() => callPhone(SUPPORT_PHONE)}
              />
              <Divider />
              <ListRow
                title="Email support"
                subtitle={SUPPORT_EMAIL}
                iconName="mail-outline"
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
              />
            </View>
          </Card>
        </View>
      </Screen>
    </View>
  );
}
