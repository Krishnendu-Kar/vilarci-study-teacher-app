import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  TextInput,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { AppText, Row } from './base';

/**
 * The keyboard while this sheet is open (null when hidden): its top edge on
 * screen and its height. The sheet is a Modal, which Android draws
 * edge-to-edge, so its window doesn't shrink for the keyboard — the sheet has
 * to move up by itself.
 */
function useKeyboard(active: boolean): { top: number; height: number } | null {
  const [kb, setKb] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    if (!active || Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setKb({ top: e.endCoordinates.screenY, height: e.endCoordinates.height }),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(null));
    return () => {
      show.remove();
      hide.remove();
      setKb(null);
    };
  }, [active]);
  return kb;
}

/** Bottom sheet modal — the mobile stand-in for the website's dialog modals. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightRatio = 0.86,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightRatio?: number;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboard(visible);
  // The modal fills the screen from the top, so its height is its bottom edge
  // on screen; `full` is the tallest it has been (no keyboard).
  const [frame, setFrame] = useState({ height: 0, full: 0 });
  const frameHeight = frame.height;
  // The system already made room (the frame shrank): nothing to add.
  const resized = frame.height < frame.full - 1;
  // How much of the sheet the keyboard covers. iOS reports where the keyboard
  // starts; Android reports its height above the navigation bar, and the
  // edge-to-edge modal reaches under that bar.
  const overlap =
    !keyboard || !frameHeight || resized
      ? 0
      : Platform.OS === 'ios'
        ? Math.max(0, frameHeight - keyboard.top)
        : keyboard.height + insets.bottom;

  const scrollRef = useRef<ScrollViewInstance>(null);
  const contentRef = useRef<ViewInstance>(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);

  // Once the keyboard is up (or changes size), bring the focused field into view.
  useEffect(() => {
    if (!overlap || !scroll) return;
    const id = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const content = contentRef.current;
      if (!input || !content) return;
      input.measureLayout(content, (_x, y, _w, h) => {
        const margin = spacing.lg;
        if (y + h + margin > scrollY.current + viewportHeight.current) {
          scrollRef.current?.scrollTo({ y: y + h + margin - viewportHeight.current, animated: true });
        } else if (y - margin < scrollY.current) {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - margin), animated: true });
        }
      });
    }, 60);
    return () => clearTimeout(id);
  }, [overlap, scroll]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: overlap }}
        onLayout={(e) => {
          const height = e.nativeEvent.layout.height;
          setFrame((f) => ({ height, full: Math.max(f.full, height) }));
        }}
      >
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        />
        <View
          style={{
            backgroundColor: colors.bgApp,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            // Measured in points so the room above the keyboard is what counts.
            maxHeight: frameHeight ? (frameHeight - overlap) * maxHeightRatio : `${maxHeightRatio * 100}%`,
            paddingBottom: overlap ? spacing.md : Math.max(insets.bottom, spacing.lg),
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <Row
            justify="space-between"
            align="flex-start"
            style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}
          >
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <AppText variant="title">{title}</AppText>
              {subtitle ? (
                <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={17} color={colors.textSecondary} />
            </Pressable>
          </Row>

          {scroll ? (
            <ScrollView
              ref={scrollRef}
              style={{ paddingHorizontal: spacing.lg }}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
              // A tap on Save while typing should save, not just close the keyboard.
              keyboardShouldPersistTaps="handled"
              onLayout={(e) => (viewportHeight.current = e.nativeEvent.layout.height)}
              onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
              scrollEventThrottle={16}
            >
              <View ref={contentRef}>{children}</View>
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: spacing.lg }}>{children}</View>
          )}
        </View>
      </View>
    </Modal>
  );
}
