import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import {
  BIO_MAX,
  describeTeacherError,
  EXPERIENCE_MAX,
  LIST_ITEM_MAX,
  LIST_ITEM_MIN,
  LIST_MAX_ITEMS,
  QUALIFICATION_MAX,
  QUALIFICATION_MIN,
  SUBJECT_MAX,
  SUBJECTS,
  useSaveTeacherProfile,
  useTeacherProfile,
} from '../../lib/api/teacherProfile';
import { AppText, Chip, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { AuthField, ErrorBanner } from '../../components/auth/AuthKit';
import { ListEditor } from '../../components/real/ListEditor';

type Errors = Partial<Record<'subject' | 'qualification' | 'experience', string>>;

const OTHER = 'Other';

/** Create (first time) or edit the account's single teacher profile. */
export function TeacherProfileFormScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { data: existing } = useTeacherProfile();
  const save = useSaveTeacherProfile();

  const known = existing?.primary_subject && SUBJECTS.includes(existing.primary_subject);
  const [subject, setSubject] = useState<string | null>(
    existing?.primary_subject ? (known ? existing.primary_subject : OTHER) : null,
  );
  const [otherSubject, setOtherSubject] = useState(existing && !known ? existing.primary_subject : '');
  const [qualification, setQualification] = useState(existing?.qualification ?? '');
  const [experience, setExperience] = useState(existing?.experience_years != null ? String(existing.experience_years) : '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [achievements, setAchievements] = useState<string[]>(existing?.achievements ?? []);
  const [books, setBooks] = useState<string[]>(existing?.authored_books ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async () => {
    const e: Errors = {};
    const finalSubject = subject === OTHER ? otherSubject.trim() : subject ?? '';
    if (!finalSubject) e.subject = 'Choose the subject you mainly teach.';
    else if (finalSubject.length > SUBJECT_MAX) e.subject = `Subject can be at most ${SUBJECT_MAX} characters.`;
    const q = qualification.trim();
    if (q.length < QUALIFICATION_MIN) e.qualification = 'Add your qualification, e.g. "M.Sc Physics".';
    const years = experience.trim() === '' ? null : Number(experience);
    if (years !== null && (!Number.isInteger(years) || years < 0 || years > EXPERIENCE_MAX)) {
      e.experience = `Enter whole years between 0 and ${EXPERIENCE_MAX}.`;
    }
    setErrors(e);
    setFailure(null);
    if (Object.keys(e).length) return;

    try {
      await save.mutateAsync({
        exists: Boolean(existing),
        input: {
          primary_subject: finalSubject,
          qualification: q,
          experience_years: years,
          bio: bio.trim(),
          achievements,
          authored_books: books,
        },
      });
      toast.toast(existing ? 'Teacher profile updated' : 'Teacher profile created', 'success');
      navigation.goBack();
    } catch (err) {
      setFailure(describeTeacherError(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Row gap={spacing.md} style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="arrow-back" size={19} color={colors.textMain} />
        </Pressable>
        <AppText variant="title" style={{ flex: 1 }} numberOfLines={1}>
          {existing ? 'Edit teacher profile' : 'Create teacher profile'}
        </AppText>
      </Row>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={failure} />

        <AppText variant="overline" tone={errors.subject ? 'error' : 'muted'} style={{ marginBottom: spacing.sm }}>
          MAIN SUBJECT
        </AppText>
        <Row gap={spacing.sm} wrap>
          {[...SUBJECTS, OTHER].map((s) => (
            <Chip
              key={s}
              label={s}
              selected={subject === s}
              onPress={() => {
                setSubject(s);
                setErrors((e) => ({ ...e, subject: undefined }));
              }}
            />
          ))}
        </Row>
        {subject === OTHER ? (
          <View style={{ marginTop: spacing.md }}>
          <AuthField
            label="Your subject"
            icon="create-outline"
            placeholder="e.g. Political Science"
            maxLength={SUBJECT_MAX}
            autoCapitalize="words"
            value={otherSubject}
            onChangeText={(t) => {
              setOtherSubject(t);
              setErrors((e) => ({ ...e, subject: undefined }));
            }}
          />
          </View>
        ) : null}
        {errors.subject ? (
          <AppText variant="caption" tone="error" style={{ marginTop: 6 }}>
            {errors.subject}
          </AppText>
        ) : null}

        <View style={{ height: spacing.xl }} />
        <AuthField
          label="Qualification"
          icon="ribbon-outline"
          placeholder="e.g. M.Sc Physics, B.Ed"
          maxLength={QUALIFICATION_MAX}
          value={qualification}
          onChangeText={(t) => {
            setQualification(t);
            setErrors((e) => ({ ...e, qualification: undefined }));
          }}
          error={errors.qualification}
        />
        <AuthField
          label="Teaching experience (years)"
          optional
          icon="time-outline"
          placeholder="e.g. 5"
          keyboardType="number-pad"
          maxLength={2}
          value={experience}
          onChangeText={(t) => {
            setExperience(t.replace(/\D/g, ''));
            setErrors((e) => ({ ...e, experience: undefined }));
          }}
          error={errors.experience}
        />
        <AuthField
          label={`About you (${bio.length}/${BIO_MAX})`}
          optional
          placeholder="Teaching style, achievements, what students can expect…"
          multiline
          maxLength={BIO_MAX}
          value={bio}
          onChangeText={setBio}
          style={{ minHeight: 110, textAlignVertical: 'top' }}
        />

        <ListEditor
          label="Achievements"
          icon="trophy-outline"
          placeholder="e.g. 100+ Selections in NEET 2025"
          items={achievements}
          onChange={setAchievements}
          maxItems={LIST_MAX_ITEMS}
          minLength={LIST_ITEM_MIN}
          maxLength={LIST_ITEM_MAX}
        />
        <ListEditor
          label="Authored books"
          icon="book-outline"
          placeholder="Book title"
          items={books}
          onChange={setBooks}
          maxItems={LIST_MAX_ITEMS}
          minLength={LIST_ITEM_MIN}
          maxLength={LIST_ITEM_MAX}
        />

        <Button
          label={existing ? 'Save changes' : 'Create teacher profile'}
          iconName={existing ? 'checkmark-circle-outline' : 'school-outline'}
          size="lg"
          fullWidth
          loading={save.isPending}
          onPress={submit}
          style={{ marginTop: spacing.md }}
        />
        <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.md }}>
          Your name, WhatsApp and email come from your account.
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
