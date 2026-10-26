import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { elevation, radius, spacing } from '../theme/tokens';
import { usePortfolio, useTeacher, useTodayPlan } from '../lib/api/hooks';
import type { DeckRef } from '../lib/store/useAppStore';
import {
  AppText,
  Card,
  Divider,
  EmptyState,
  HeroCard,
  Pill,
  PressableCard,
  Row,
  SectionHeader,
} from '../components/ui/base';
import { Button } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { TeacherHeader } from '../components/TeacherHeader';
import { firstNameOf, formatDateShort, relativeDay, rupees, WEEKDAYS_LONG } from '../lib/utils/format';
import type { DeckTab } from './DeckScreen';
import { weekdayDate } from '../components/ClassDate';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function TodayScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const teacher = useTeacher();
  const portfolio = usePortfolio();
  const plan = useTodayPlan();

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const openDeck = (ref: DeckRef, tab: DeckTab, extra: { date?: string; homeworkId?: string } = {}) =>
    navigation.navigate('Deck', { ...ref, tab, ...extra });
  const held = plan.filter((c) => !c.cancelled);
  // One follow-up per batch, oldest unmarked class first.
  const unmarkedByDeck = Object.values(
    portfolio.unmarked.reduce<Record<string, { deck: (typeof portfolio.unmarked)[number]['deck']; dates: string[] }>>(
      (acc, { deck, occurrence }) => {
        (acc[deck.ref.id] ??= { deck, dates: [] }).dates.push(occurrence.date);
        return acc;
      },
      {},
    ),
  );
  const attention = unmarkedByDeck.length + portfolio.toCheck.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <TeacherHeader />
      <Screen>
        {/* ── Hero: who is teaching, how big the classroom is ─────────────── */}
        <HeroCard>
          <AppText variant="overline" style={{ color: colors.goldBright }}>
            {greeting.toUpperCase()}
          </AppText>
          <AppText variant="display" style={{ color: '#FDFBF9', marginTop: 4 }}>
            {firstNameOf(teacher.name)}
          </AppText>
          <AppText variant="caption" style={{ color: 'rgba(253,251,249,0.62)', marginTop: 2 }}>
            {WEEKDAYS_LONG[now.getDay()]} · {held.length} class{held.length === 1 ? '' : 'es'} today
            {attention ? ` · ${attention} to follow up` : ''}
          </AppText>

          <View style={styles.heroStrip}>
            <HeroStat label="Students" value={String(portfolio.studentCount)} accent={colors.goldBright} />
            <HeroDivider />
            <HeroStat label="Batches" value={String(portfolio.batchCount)} />
            <HeroDivider />
            <HeroStat label="Institutes" value={String(portfolio.instituteCount)} />
            <HeroDivider />
            <HeroStat label="Awarded" value={portfolio.monthPoints.toLocaleString('en-IN')} />
          </View>
        </HeroCard>

        {/* ── Today's timetable ────────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader
            title="Today's classes"
            subtitle="Tap a class to open its command deck"
          />
          {plan.length ? (
            <Card padded={false}>
              {plan.map((slot, idx) => {
                const marked = portfolio.isMarkedToday(slot.ref.id);
                const off = Boolean(slot.cancelled);
                return (
                  <View key={slot.key}>
                    {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                    <Pressable
                      onPress={() => openDeck(slot.ref, 'students')}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Row gap={spacing.md} align="center" style={{ padding: spacing.lg }}>
                        <View style={{ width: 64, opacity: off ? 0.5 : 1 }}>
                          <AppText variant="captionStrong">{slot.start}</AppText>
                          {slot.end ? (
                            <AppText variant="caption" tone="muted">
                              {slot.end}
                            </AppText>
                          ) : null}
                        </View>
                        <View style={[styles.rail, { backgroundColor: slot.color }]} />
                        <View style={{ flex: 1 }}>
                          <AppText
                            variant="subheading"
                            numberOfLines={2}
                            style={off ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}
                          >
                            {slot.title}
                          </AppText>
                          <AppText variant="caption" tone="muted" numberOfLines={1}>
                            {slot.context} · {slot.room} · {slot.studentCount} students
                          </AppText>
                          {off || slot.kind === 'extra' ? (
                            <Row gap={5} wrap style={{ marginTop: 4 }}>
                              {off ? (
                                <Pill label={`Cancelled · ${slot.cancelled!.note}`} tone="error" icon="close-circle-outline" />
                              ) : (
                                <Pill label={slot.note ? `Extra · ${slot.note}` : 'Extra class'} tone="info" icon="add-circle-outline" />
                              )}
                            </Row>
                          ) : null}
                        </View>
                        {off ? null : marked ? (
                          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                        ) : (
                          <Button
                            label="Mark"
                            size="sm"
                            variant="secondary"
                            iconName="checkbox-outline"
                            onPress={() => openDeck(slot.ref, 'attendance')}
                          />
                        )}
                      </Row>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          ) : (
            <EmptyState
              icon="cafe-outline"
              title="No classes today"
              message="A clear day — a good window to plan the syllabus or clear pending marks."
            />
          )}
        </View>

        {/* ── Follow-ups: registers and homework still owed ───────────────── */}
        {attention ? (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionHeader title="Needs attention" subtitle="Registers and homework from recent classes" />
            <Card padded={false}>
              {unmarkedByDeck.map(({ deck, dates }, idx) => (
                <View key={`u-${deck.ref.id}`}>
                  {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                  <FollowUp
                    icon="clipboard-outline"
                    tint={colors.error}
                    title={
                      dates.length === 1
                        ? `Mark attendance · ${weekdayDate(dates[0])}`
                        : `${dates.length} registers not marked`
                    }
                    meta={dates.length === 1 ? deck.name : `${deck.name} · ${dates.map(weekdayDate).join(', ')}`}
                    onPress={() => openDeck(deck.ref, 'attendance', { date: dates[0] })}
                  />
                </View>
              ))}
              {portfolio.toCheck.map(({ deck, homework }, idx) => (
                <View key={`h-${homework.id}`}>
                  {idx > 0 || unmarkedByDeck.length ? <Divider inset={spacing.lg} /> : null}
                  <FollowUp
                    icon="book-outline"
                    tint={colors.warning}
                    title={`Check homework · ${homework.title}`}
                    meta={`${deck.name} · due ${weekdayDate(homework.due_date)}`}
                    onPress={() => openDeck(deck.ref, 'homework', { homeworkId: homework.id })}
                  />
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {/* ── Tuition dues ─────────────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader
            title="Tuition dues"
            subtitle={
              portfolio.duesTotal
                ? `${rupees(portfolio.duesTotal)} outstanding up to this month`
                : 'Every collecting batch is settled'
            }
          />
          {portfolio.dues.length ? (
            <Card padded={false}>
              {portfolio.dues.slice(0, 4).map((d, idx) => (
                <View key={d.deck.ref.id}>
                  {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                  <Pressable
                    onPress={() => openDeck(d.deck.ref, 'fees')}
                    style={({ pressed }) => [{ padding: spacing.lg, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Row gap={spacing.md}>
                      <View style={[styles.iconWell, { backgroundColor: colors.warningBg }]}>
                        <Ionicons name="wallet-outline" size={19} color={colors.warning} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="subheading" numberOfLines={1}>
                          {d.deck.name}
                        </AppText>
                        <AppText variant="caption" tone="muted" numberOfLines={1}>
                          {d.owing.map((o) => o.student.name.split(' ')[0]).join(', ')}
                        </AppText>
                      </View>
                      <AppText variant="metricSm" style={{ color: colors.warning }}>
                        {rupees(d.amount)}
                      </AppText>
                    </Row>
                  </Pressable>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState icon="checkmark-done-circle-outline" title="No pending dues" message="Record payments from a batch's Fees view." />
          )}
        </View>

        {/* ── Curriculum alerts ────────────────────────────────────────────── */}
        {portfolio.delayed.length ? (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionHeader title="Behind schedule" subtitle="Topics past their planned target date" />
            <View style={{ gap: spacing.sm }}>
              {portfolio.delayed.slice(0, 3).map(({ deck, topic, variance }) => (
                <PressableCard key={topic.id} rail={colors.error} onPress={() => openDeck(deck.ref, 'syllabus')}>
                  <AppText variant="overline" tone="muted" numberOfLines={1}>
                    {deck.name.toUpperCase()}
                  </AppText>
                  <AppText variant="subheading" style={{ marginTop: 2 }}>
                    Ch {topic.chapter_number} · {topic.chapter_name}
                  </AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {topic.topic_name}
                  </AppText>
                  <Pill label={variance.label} tone="error" style={{ marginTop: spacing.sm }} />
                </PressableCard>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Honours dispatched ───────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader
            title="Recent honours"
            subtitle="Points you awarded"
            action="Full log"
            onAction={() => navigation.navigate('More', { screen: 'HonoursLog' })}
          />
          {portfolio.recentDispatches.length ? (
            <Card padded={false}>
              {portfolio.recentDispatches.map((d, idx) => (
                <View key={d.id}>
                  {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                  <Row gap={spacing.md} style={{ padding: spacing.lg }} align="flex-start">
                    <View style={[styles.iconWell, { backgroundColor: colors.goldSubtle }]}>
                      <Ionicons name="ribbon-outline" size={19} color={colors.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="subheading">{d.student_name}</AppText>
                      <AppText variant="caption" tone="secondary" numberOfLines={2}>
                        {d.citation}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {d.category} · {relativeDay(d.date)} · {formatDateShort(d.date)}
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
            <EmptyState icon="ribbon-outline" title="No honours yet" message="Award points from any batch's Points view." />
          )}
        </View>

        {/* ── Quick actions ────────────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Quick actions" />
          <Row gap={spacing.md}>
            <ActionTile
              icon="add-circle-outline"
              title="New batch"
              hint="Private tuition"
              onPress={() => navigation.navigate('Batches', { screen: 'BatchesHome', params: { create: Date.now() } })}
            />
            <ActionTile
              icon="business-outline"
              title="Join institute"
              hint="With a 6-letter code"
              onPress={() =>
                navigation.navigate('Institutes', { screen: 'InstitutesHome', params: { join: Date.now() } })
              }
            />
          </Row>
        </View>
      </Screen>
    </View>
  );
}

function FollowUp({
  icon,
  tint,
  title,
  meta,
  onPress,
}: {
  icon: IconName;
  tint: string;
  title: string;
  meta: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ padding: spacing.lg, opacity: pressed ? 0.7 : 1 }]}>
      <Row gap={spacing.md}>
        <View style={[styles.iconWell, { backgroundColor: `${tint}18` }]}>
          <Ionicons name={icon} size={19} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="subheading" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {meta}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Row>
    </Pressable>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <AppText variant="metricSm" style={{ color: accent ?? '#FDFBF9' }} numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="overline" style={{ color: 'rgba(253,251,249,0.55)', marginTop: 1 }}>
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}

function HeroDivider() {
  return <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(253,251,249,0.2)' }} />;
}

function ActionTile({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: IconName;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          flex: 1,
          padding: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          ...elevation(1, colors.shadowColor, colors.shadowOpacity),
        },
      ]}
    >
      <View style={[styles.iconWell, { backgroundColor: colors.primarySubtle }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <AppText variant="subheading" style={{ marginTop: spacing.md }}>
        {title}
      </AppText>
      <AppText variant="caption" tone="muted">
        {hint}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroStrip: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: 'rgba(253,251,249,0.09)',
    paddingVertical: spacing.md,
  },
  rail: { width: 3, alignSelf: 'stretch', minHeight: 34, borderRadius: 2 },
  iconWell: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
