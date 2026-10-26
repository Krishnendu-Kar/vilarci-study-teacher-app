import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { useAppStore } from '../../lib/store/useAppStore';
import { leaderboard } from '../../lib/api/selectors';
import { formatDateShort } from '../../lib/utils/format';
import { AppText, Avatar, Card, Divider, EmptyState, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ChoiceChips } from '../../components/ui/ChoiceChips';
import { Field } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { RankMark, Streak } from '../../components/Marks';
import type { DeckViewProps } from '../DeckScreen';

const AMOUNTS = [50, 100, 150, 200];
const CATEGORIES = ['Test Excellence', 'Concept Mastery', 'Homework Streak', 'Classroom Leadership'];


/** Honours dispenser desk with a live, re-ranking batch leaderboard. */
export function PointsView({ data, focus }: DeckViewProps) {
  const focusStudentId = focus.studentId;
  const { colors } = useTheme();
  const awardPoints = useAppStore((s) => s.awardPoints);
  const { points: pointsToast } = useToast();
  const { deck, roster, dispatches } = data;
  const [studentId, setStudentId] = useState<string | null>(focusStudentId ?? roster[0]?.id ?? null);
  const [amount, setAmount] = useState(100);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [citation, setCitation] = useState('');

  useEffect(() => {
    if (focusStudentId) setStudentId(focusStudentId);
  }, [focusStudentId]);

  const board = leaderboard(roster);
  const selected = roster.find((s) => s.id === studentId) ?? null;

  if (!roster.length) {
    return <EmptyState icon="ribbon-outline" title="No students to honour" message="Enrol students to start awarding points." />;
  }

  const award = () => {
    if (!selected) return;
    const before = board.findIndex((s) => s.id === selected.id) + 1;
    const after = leaderboard(roster.map((s) => (s.id === selected.id ? { ...s, points: s.points + amount } : s))).findIndex(
      (s) => s.id === selected.id,
    ) + 1;
    awardPoints(deck.ref, deck.title, selected.id, amount, category, citation.trim() || `${category} in ${deck.name}`);
    pointsToast(
      amount,
      after < before ? `${selected.name} climbs to rank #${after}` : `${selected.name} · rank #${after}`,
    );
    setCitation('');
  };

  return (
    <View>
      <Card>
        <AppText variant="overline" tone="muted">
          AWARD TO
        </AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}
        >
          {roster.map((s) => {
            const active = s.id === studentId;
            return (
              <Pressable
                key={s.id}
                onPress={() => setStudentId(s.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.pick,
                  {
                    borderColor: active ? colors.primary : 'transparent',
                    backgroundColor: active ? colors.primarySubtle : 'transparent',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Avatar initials={s.photo_initials} gradient={s.avatar_gradient} size={40} ring={active} />
                <AppText variant="caption" numberOfLines={1} style={{ marginTop: 4, maxWidth: 64 }} center>
                  {s.name.split(' ')[0]}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
          <ChoiceChips
            label="Points"
            options={AMOUNTS.map((a) => ({ value: a, label: `+${a}` }))}
            value={amount}
            onChange={setAmount}
          />
          <ChoiceChips label="Category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} value={category} onChange={setCategory} />
          <Field
            placeholder="Citation, e.g. Flawless proof in the discriminant test"
            value={citation}
            onChangeText={setCitation}
            multiline
          />
          <Button
            label={selected ? `Award +${amount} to ${selected.name.split(' ')[0]}` : 'Pick a student'}
            iconName="ribbon-outline"
            variant="gold"
            fullWidth
            disabled={!selected}
            onPress={award}
          />
        </View>
      </Card>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Live leaderboard" subtitle="Re-ranks the moment you award" />
        <Card padded={false}>
          {board.map((s, idx) => (
            <View key={s.id}>
              {idx > 0 ? <Divider inset={spacing.lg} /> : null}
              <Row gap={spacing.md} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
                <View style={{ width: 36 }}>
                  <RankMark rank={idx + 1} />
                </View>
                <Avatar initials={s.photo_initials} gradient={s.avatar_gradient} size={32} />
                <View style={{ flex: 1 }}>
                  <AppText variant="subheading" numberOfLines={1}>
                    {s.name}
                  </AppText>
                  <Streak days={s.streak} suffix=" streak" />
                </View>
                <AppText variant="subheading" tone={idx === 0 ? 'gold' : 'main'}>
                  {s.points.toLocaleString('en-IN')}
                </AppText>
              </Row>
            </View>
          ))}
        </Card>
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Honours dispatched here" subtitle={`${dispatches.length} awards in this ${deck.isPrivate ? 'batch' : 'section'}`} />
        {dispatches.length ? (
          <Card padded={false}>
            {dispatches.slice(0, 12).map((d, idx) => (
              <View key={d.id}>
                {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                <Row gap={spacing.md} align="flex-start" style={{ padding: spacing.lg }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="subheading">{d.student_name}</AppText>
                    <AppText variant="caption" tone="secondary" numberOfLines={2}>
                      {d.citation}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {d.category} · {formatDateShort(d.date)} · {d.teacher_name}
                    </AppText>
                  </View>
                  <AppText variant="subheading" tone="gold">
                    +{d.points}
                  </AppText>
                </Row>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState icon="medal-outline" title="No awards yet" message="Your first award shows up here and on the student's app." />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pick: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
