import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, spacing } from '../theme/tokens';
import { useAppStore } from '../lib/store/useAppStore';
import { useMyInstitutes } from '../lib/api/hooks';
import { isOwner, mySections, roleLabel } from '../lib/api/selectors';
import {
  AppText,
  CenterMark,
  Divider,
  EmptyState,
  Pill,
  PressableCard,
  Row,
} from '../components/ui/base';
import { Button } from '../components/ui/Button';
import { Field, FormField } from '../components/ui/Field';
import { Screen } from '../components/ui/Screen';
import { Sheet } from '../components/ui/Sheet';
import { useToast } from '../components/ui/Toast';
import { TeacherHeader } from '../components/TeacherHeader';

/** Realm 2 — institutes this teacher owns or teaches at. */
export function InstitutesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const institutes = useMyInstitutes();
  const teacherId = useAppStore((s) => s.teacherId);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (route.params?.join) setJoining(true);
  }, [route.params?.join]);

  const open = (id: string) => navigation.navigate('Institute', { id });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <TeacherHeader overline="Coaching institutes" />
      <Screen>
        <Row gap={spacing.sm}>
          <Button
            label="Join via code"
            iconName="enter-outline"
            variant="secondary"
            onPress={() => setJoining(true)}
            style={{ flex: 1 }}
            fullWidth
          />
          <Button label="Create" iconName="add" onPress={() => setCreating(true)} style={{ flex: 1 }} fullWidth />
        </Row>

        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          {institutes.length ? (
            institutes.map((inst) => {
              const owner = isOwner(inst, teacherId);
              const mine = mySections(inst, teacherId).length;
              return (
                <PressableCard key={inst.id} level={1} onPress={() => open(inst.id)}>
                  <Row gap={spacing.md} align="flex-start">
                    <CenterMark text={inst.logo_text} color={inst.theme_color} size={46} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="heading">{inst.name}</AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={2}>
                        {inst.tagline}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Row>

                  <Row gap={5} wrap style={{ marginTop: spacing.md }}>
                    <Pill
                      label={owner ? 'Director & Owner' : roleLabel(inst, teacherId)}
                      tone={owner ? 'gold' : 'primary'}
                      icon={owner ? 'star' : 'briefcase-outline'}
                    />
                    <Pill label={inst.code} tone="neutral" icon="key-outline" />
                  </Row>

                  <Divider style={{ marginVertical: spacing.md }} />
                  <Row justify="space-between">
                    <Metric value={String(mine)} label="My sections" />
                    <Metric value={String(inst.classes_sections.length)} label="All sections" />
                    <Metric value={String(inst.members.length)} label="Faculty" />
                    <Metric value={String(inst.notices.length)} label="Notices" />
                  </Row>
                  <Row gap={6} style={{ marginTop: spacing.md }}>
                    <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                    <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                      {inst.address}
                    </AppText>
                  </Row>
                </PressableCard>
              );
            })
          ) : (
            <EmptyState
              icon="business-outline"
              title="Not linked to any institute"
              message="Create your own coaching institute and invite faculty, or join one with its 6-character code."
            />
          )}
        </View>
      </Screen>

      <JoinSheet visible={joining} onClose={() => setJoining(false)} onJoined={open} />
      <CreateInstituteSheet visible={creating} onClose={() => setCreating(false)} onCreated={open} />
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <AppText variant="metricSm">{value}</AppText>
      <AppText variant="overline" tone="muted">
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}

function JoinSheet({
  visible,
  onClose,
  onJoined,
}: {
  visible: boolean;
  onClose: () => void;
  onJoined: (id: string) => void;
}) {
  const joinInstituteByCode = useAppStore((s) => s.joinInstituteByCode);
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const res = joinInstituteByCode(code);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast(res.message, 'success');
    setCode('');
    setError(null);
    onClose();
    if (res.id) onJoined(res.id);
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="Join an institute"
      subtitle="Enter the 6-character code the director shared"
    >
      <Field
        placeholder="STLR10"
        value={code}
        onChangeText={(t) => {
          setCode(t.toUpperCase());
          setError(null);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        style={{ fontFamily: fonts.sansSemibold, fontSize: 20, letterSpacing: 6, textAlign: 'center' }}
      />
      {error ? (
        <AppText variant="caption" tone="error" style={{ marginTop: spacing.sm }}>
          {error}
        </AppText>
      ) : (
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
          Demo codes: STLR10 (Stellar Academy) · APEX99 (Apex Science Hub)
        </AppText>
      )}
      <Button
        label="Join institute"
        iconName="enter-outline"
        fullWidth
        disabled={code.trim().length < 6}
        onPress={submit}
        style={{ marginTop: spacing.lg }}
      />
    </Sheet>
  );
}

function CreateInstituteSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const createInstitute = useAppStore((s) => s.createInstitute);
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 2 && /^[A-Z0-9]{6}$/.test(code) && address.trim().length > 3;

  const submit = () => {
    const res = createInstitute({ name, tagline, code, address });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast(res.message, 'success');
    setName('');
    setTagline('');
    setCode('');
    setAddress('');
    onClose();
    if (res.id) onCreated(res.id);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Create an institute" subtitle="You become its Director & Owner">
      <View style={{ gap: spacing.lg }}>
        <FormField label="Institute name" placeholder="e.g. Orbit Science Classes" value={name} onChangeText={setName} />
        <FormField label="Tagline" placeholder="One line students will see" value={tagline} onChangeText={setTagline} />
        <FormField
          label="Admission code"
          placeholder="6 letters or digits"
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''));
            setError(null);
          }}
          autoCapitalize="characters"
          maxLength={6}
          hint="Students and faculty join with this code"
          error={error}
        />
        <FormField label="Campus address" value={address} onChangeText={setAddress} multiline />
        <Button label="Create institute" iconName="checkmark" fullWidth disabled={!valid} onPress={submit} />
      </View>
    </Sheet>
  );
}
