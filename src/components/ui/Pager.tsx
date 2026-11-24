import React, { useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  type FlatListInstance,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Full-width pages you swipe through (days, months). Same file in the student
 * and teacher apps. The pages next to the current one are built ahead of time
 * (`preload` on each side), so a swipe shows the real next page under the
 * finger — no waiting, no blank flash. Moving `current` from outside (arrows,
 * a date picker, "today") scrolls there; settling on a page calls `onChange`.
 */
export function Pager<P extends string>({
  pages,
  current,
  onChange,
  renderPage,
  preload = 2,
}: {
  /** Page keys in order (e.g. dates "YYYY-MM-DD" or months "YYYY-MM"). */
  pages: P[];
  current: P;
  onChange: (page: P) => void;
  renderPage: (page: P) => React.ReactElement;
  /** Pages kept ready on each side of the current one. */
  preload?: number;
}) {
  const { width } = useWindowDimensions();
  const list = useRef<FlatListInstance>(null);
  // The page the list is resting on, and the pages it was built with.
  const shown = useRef(Math.max(0, pages.indexOf(current)));
  const lastPages = useRef(pages);
  const webTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `current` moved from outside, or pages were added before it: scroll there.
  useEffect(() => {
    const i = pages.indexOf(current);
    const pagesChanged = lastPages.current !== pages;
    lastPages.current = pages;
    if (i < 0 || i === shown.current) return;
    // Next door: slide over. Far away, or the list shifted under us: jump.
    const animated = !pagesChanged && Math.abs(i - shown.current) === 1;
    shown.current = i;
    list.current?.scrollToIndex({ index: i, animated });
  }, [current, pages]);

  const settle = useCallback(
    (x: number) => {
      const i = Math.max(0, Math.min(pages.length - 1, Math.round(x / width)));
      if (i === shown.current) return;
      shown.current = i;
      Haptics.selectionAsync().catch(() => {});
      onChange(pages[i]);
    },
    [pages, width, onChange],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // The web has no momentum events: settle once scrolling has stopped.
    if (Platform.OS !== 'web') return;
    const x = e.nativeEvent.contentOffset.x;
    if (webTimer.current) clearTimeout(webTimer.current);
    webTimer.current = setTimeout(() => settle(x), 140);
  };

  return (
    <FlatList
      ref={list}
      data={pages}
      keyExtractor={(p) => p}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={Math.max(0, pages.indexOf(current))}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      // The current page plus `preload` on each side are kept built.
      windowSize={preload * 2 + 1}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
      onScroll={onScroll}
      scrollEventThrottle={32}
      onScrollToIndexFailed={({ index }) => list.current?.scrollToOffset({ offset: index * width, animated: false })}
      renderItem={({ item }) => <View style={{ width, flex: 1 }}>{renderPage(item)}</View>}
    />
  );
}
