import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { useBatchRoster, usePrivateBatch } from '../../lib/api/privateBatches';
import { createTest, describeTestError, rosterForTest, useBatchTests } from '../../lib/api/tests';
import { useLocalStore } from '../../lib/local/store';
import { scoreOf } from '../../lib/utils/tests';
import { AppText, EmptyState } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';
import { TestCard, TestEditor } from '../../components/real/TestParts';

/** A batch's tests, newest first; each opens its mark sheet. Works offline. */
export function BatchTestsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const params = useRoute<any>().params as { id: string; compose?: boolean };
  const toast = useToast();
  const { data: b, isLoading } = usePrivateBatch(params.id);
  const { data: roster } = useBatchRoster(params.id);
  const tests = useBatchTests(params.id);
  const months = useLocalStore((s) => s.months);
  const [creating, setCreating] = useState(Boolean(params.compose));

  if (isLoading || !b) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Tests & marks" />
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title="Tests & marks" right={<Button label="New" iconName="add" size="sm" onPress={() => setCreating(true)} />} />
      <Screen>
        <SyncBanner />
        <AppText variant="overline" tone="muted" numberOfLines={1}>
          {b.name.toUpperCase()}
        </AppText>
        <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.lg }}>
          Parents see their own child’s marks, plus the class average and highest — never other students’ marks.
        </AppText>
        {tests.length ? (
          <View style={{ gap: spacing.md }}>
            {tests.map((t) => {
              const sheet = rosterForTest(roster, months, t.id);
              const entered = sheet.filter((r) => scoreOf(months[r.id], t.id) != null).length;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => navigation.navigate('TestMarks', { batchId: b.id, testId: t.id })}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <TestCard test={t} entered={entered} total={sheet.length} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <>
            <EmptyState
              icon="document-text-outline"
              title="No tests yet"
              message="Create a test, then enter the class's marks — even without internet. Parents see their child's score and the class average."
            />
            <Button label="Create a test" iconName="add" fullWidth onPress={() => setCreating(true)} style={{ marginTop: spacing.md }} />
          </>
        )}
      </Screen>

      {creating ? (
        <TestEditor
          defaultSubject={b.subject}
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            setCreating(false);
            try {
              const id = await createTest(b.id, input);
              toast.toast('Test created — enter the marks', 'success');
              navigation.navigate('TestMarks', { batchId: b.id, testId: id });
            } catch (err) {
              toast.toast(describeTestError(err), 'error');
            }
          }}
        />
      ) : null}
    </View>
  );
}
