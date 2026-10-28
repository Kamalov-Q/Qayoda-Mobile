import {
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  View,
  ViewStyle,
  ScrollView,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
// From expo-router, not @react-navigation/elements: since SDK 56 the router
// vendors React Navigation and refuses a direct import of it at bundle time.
import { HeaderHeightContext } from "expo-router/react-navigation";
import {
  KEYBOARD_GAP,
  ScrollHostProvider,
  useKeyboardVisible,
  type ScrollHost,
} from "./keyboardScroll";
import { spacing } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  /** Vertically centre the content — used by the auth screens. */
  centered?: boolean;
  /** Set false for screens that manage their own scrolling. */
  scroll?: boolean;
  /**
   * Which sides get safe-area padding. Screens pushed onto the stack sit under
   * a header that already clears the notch, so they drop "top" — keeping it
   * insets them twice and leaves a dead band below the title.
   */
  edges?: readonly Edge[];
  /**
   * Scrolls back to the top whenever this value changes.
   *
   * For a screen that swaps its content in place rather than navigating — the
   * post form's steps. Without it, pressing "continue" half-way down one step
   * leaves you half-way down the next one, looking at its middle.
   */
  scrollResetKey?: string | number;
}

const ALL_EDGES = ["top", "left", "right", "bottom"] as const;

/**
 * The `keyboardVerticalOffset` a KeyboardAvoidingView needs on this screen.
 *
 * KeyboardAvoidingView measures itself relative to its parent, not the
 * window, while the keyboard's position comes in window coordinates. Under a
 * stack header the screen starts that far down the window, so without the
 * offset every screen with a header lifted its content short by exactly the
 * header's height — on Android, enough to bury the support composer
 * completely and leave the bottom form fields under the keyboard. Zero where
 * there is no header (tabs, screens drawing their own).
 */
export function useKeyboardOffset(): number {
  return useContext(HeaderHeightContext) ?? 0;
}

export function Screen({
  children,
  style,
  centered,
  scroll = true,
  edges = ALL_EDGES,
  scrollResetKey,
}: Props) {
  const { colors } = useTheme();
  const keyboardOffset = useKeyboardOffset();
  const keyboardUp = useKeyboardVisible();
  const scroller = useRef<ScrollViewInstance>(null);
  // Live scroll offset, as a ref: onScroll fires every frame and none of
  // this is drawn, so a state update here would re-render the screen sixty
  // times a second to deliver a number nobody reads.
  const offset = useRef(0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
    },
    [],
  );
  // Published to the fields inside, so one that takes focus below the fold
  // can ask to be scrolled clear of the keyboard. Lifting the viewport is
  // not the same as moving the field into it.
  const host = useMemo<ScrollHost>(() => ({ scroller, offset }), []);

  useEffect(() => {
    if (scrollResetKey === undefined) return;
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [scrollResetKey]);

  const body = (
    <View
      style={[
        { flex: 1, padding: spacing.lg },
        centered && { justifyContent: "center" },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
    // StatusBar is set once at the root layout — a per-screen one fights it
    // during transitions and flickers the glyph colour.
    <ScrollHostProvider value={scroll ? host : null}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={edges}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          // "padding" on Android too: with edge-to-edge the window stops
          // resizing for the keyboard, and undefined left bottom fields hidden
          // behind it (the chat composer bug, everywhere else).
          behavior="padding"
          keyboardVerticalOffset={keyboardOffset}
        >
          {scroll ? (
            <ScrollView
              ref={scroller}
              // Room BELOW the content while the keyboard is up.
              //
              // This is the half that was missing. The KeyboardAvoidingView
              // shrinks the viewport so nothing sits under the keyboard, but
              // scrolling is still bounded by contentHeight - viewportHeight:
              // once the last field's bottom reaches the keyboard's top edge
              // there is nothing below it to scroll into, so the field that
              // most needs lifting — the description, always last — is the one
              // field that cannot be lifted. Padding the content gives the
              // scroller somewhere to go. Only while the keyboard is open, so
              // a closed form has no dead space under it.
              contentContainerStyle={{
                flexGrow: 1,
                paddingBottom: keyboardUp ? KEYBOARD_GAP : 0,
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              // Not 16. The offset is read at ONE moment — when a field takes
              // focus — and by then the scroll has stopped, so sampling it
              // sixty times a second on every scrolling screen in the app
              // (the feed included) bought nothing but a JS callback per
              // frame. At 100ms the ref can be at most that stale, which
              // costs a few pixels only if a field is tapped mid-fling.
              scrollEventThrottle={100}
            >
              {body}
            </ScrollView>
          ) : (
            body
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScrollHostProvider>
  );
}

/** Convenience for screens rendered under a stack header. */
export const HEADER_EDGES = ["left", "right", "bottom"] as const;

/**
 * Convenience for tab screens. The tab bar is opaque and laid out in flow, so
 * it already occupies the bottom inset — padding for it again leaves a dead
 * band of background above the bar.
 */
export const TAB_EDGES = ["top", "left", "right"] as const;
