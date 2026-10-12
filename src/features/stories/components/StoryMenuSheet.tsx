// The ⋯ menu over a story: save it, pass it on, or report it.
//
// An overlay in the viewer's own tree rather than a <Modal>, because two of
// its three actions open a modal themselves — and on iOS presenting one in
// the same frame as another is dismissed can leave the second one unshown.
// The viewer is already full-screen, so an inset-0 view covers exactly what a
// modal would have.
//
// Dark on purpose rather than themed: it opens over a photo or a video, and a
// light panel there flashes the reader's eyes at whatever time of night they
// are watching.
import { memo, useEffect } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "@/src/theme/tokens";

export interface StoryMenuItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Reports and deletions read red, so nobody taps one by habit. */
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  items: StoryMenuItem[];
  onClose: () => void;
}

export const StoryMenuSheet = memo(function StoryMenuSheet({
  items,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  // A <Modal> would have got this for free; without one, back would close the
  // whole viewer instead of the menu over it.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  return (
    <View style={{ position: "absolute", inset: 0, justifyContent: "flex-end" }}>
      <Pressable
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
        accessibilityElementsHidden
        importantForAccessibility="no"
        onPress={onClose}
      />

      <View
        accessibilityViewIsModal
        style={{
          margin: spacing.md,
          marginBottom: insets.bottom + spacing.md,
          borderRadius: radii.xl,
          overflow: "hidden",
          backgroundColor: "rgba(28,28,30,0.98)",
        }}
      >
        {items.map((item, i) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              height: 54,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: "rgba(255,255,255,0.08)",
              backgroundColor: pressed
                ? "rgba(255,255,255,0.12)"
                : "transparent",
            })}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={item.destructive ? "#FF6B6B" : "#FFFFFF"}
            />
            <Text
              style={{
                ...type.body,
                color: item.destructive ? "#FF6B6B" : "#FFFFFF",
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});
