import { ReactNode } from "react";
import {
  View,
  ViewStyle,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
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
}

const ALL_EDGES = ["top", "left", "right", "bottom"] as const;

export function Screen({
  children,
  style,
  centered,
  scroll = true,
  edges = ALL_EDGES,
}: Props) {
  const { colors } = useTheme();

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={edges}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
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
