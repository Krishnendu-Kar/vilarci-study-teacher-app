import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { useDispatchLog } from '../lib/api/hooks';
import { formatDate } from '../lib/utils/format';
import { AppText, Card, Chip, Divider, EmptyState, Pill, Row, StatTile } from '../components/ui/base';
import { Screen } from '../components/ui/Screen';
import { ScreenTitle } from '../components/ScreenTitle';

/** Audit trail of every honour the signed-in teacher has dispatched. */
export function HonoursLogScreen() {
  const { colors } = useTheme();
  const log = useDispatchLog();
  const [context, setContext] = useState('all');

  const contexts = useMemo(() => [...new Map(log.map((d) => [d.context_id, d.context_title])).entries()], [log]);
  const visible = context === 'all' ? log : log.filter((d) => d.context_id === context);
  const total = visible.reduce((s, d) => s + d.points, 0);
  const students = new Set(visible.map((d) => d.student_id)).size;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <Screen topInset>
        <ScreenTitle title="Honours log" subtitle="Every point you awarded, with its citation" />

        <Row gap={spacing.md} wrap style={{ marginTop: spacing.lg }}>
          <StatTile label="Points" value={total.toLocaleString('en-IN')} sub={`${visible.length} awards`} tone="gold" />
          <StatTile label="Scholars" value={String(students)} sub="Recognised" tone="primary" />
        </Row>

        {contexts.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.lg }}
          >
            <Chip label="All classes" selected={context === 'all'} onPress={() => setContext('all')} />
            {contexts.map(([id, title]) => (
              <Chip key={id} label={title} selected={context === id} onPress={() => setContext(id)} />
            ))}
          </ScrollView>
        ) : (
          <View style={{ height: spacing.lg }} />
        )}

        {visible.length ? (
          <Card padded={false}>
            {visible.map((d, idx) => (
              <View key={d.id}>
                {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                <View style={{ padding: spacing.lg }}>
                  <Row justify="space-between" align="flex-start" gap={spacing.md}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="subheading">{d.student_name}</AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {d.context_title}
                      </AppText>
                    </View>
                    <AppText variant="metricSm" tone="gold">
                      +{d.points}
                    </AppText>
                  </Row>
                  <AppText variant="body" tone="secondary" style={{ marginTop: spacing.sm }}>
                    “{d.citation}”
                  </AppText>
                  <Row gap={5} wrap style={{ marginTop: spacing.sm }}>
                    <Pill label={d.category} tone="gold" />
                    <Pill label={formatDate(d.date)} />
                  </Row>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState icon="ribbon-outline" title="No honours yet" message="Award points from any batch's Points view." />
        )}
      </Screen>
    </View>
  );
}
