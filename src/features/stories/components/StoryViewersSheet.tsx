import { memo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { Avatar, EmptyState } from "@/src/components/ui";
import { useStoryViewers } from "../hooks/useStories";

interface Props {
  storyId: string;
  visible: boolean;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}

/**
 * Who watched it — the poster's list, with what each of them reacted.
 *
 * A count alone says how many; this says who, which is the thing a person
 * posting to a marketplace actually wants to know.
 */
export const StoryViewersSheet = memo(function StoryViewersSheet({
  storyId,
  visible,
  onClose,
  onOpenProfile,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useStoryViewers(storyId, visible);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose} />

      <View
        style={{
          maxHeight: "70%",
          paddingBottom: insets.bottom + spacing.md,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ alignItems: "center", paddingVertical: spacing.sm }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.border,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
          }}
        >
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
          <Text style={{ ...text.heading, flex: 1 }}>
            {t("stories.viewers")} · {data?.total ?? 0}
          </Text>
        </View>

        {/* Said plainly, because a list of names is exactly the thing people
            worry is public. */}
        <Text
          style={{
            ...text.caption,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
          }}
        >
          {t("stories.viewersOwnerOnly")}
        </Text>

        {isLoading ? (
          <ActivityIndicator
            style={{ paddingVertical: spacing.xl }}
            color={colors.primary}
          />
        ) : (
          <FlatList
            data={data?.items ?? []}
            keyExtractor={(item, i) => item.viewer?.id ?? String(i)}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            ListEmptyComponent={
              <EmptyState
                icon="eye-off-outline"
                title={t("stories.noViewers")}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => item.viewer && onOpenProfile(item.viewer.id)}
                disabled={!item.viewer}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Avatar
                  uri={item.viewer?.avatarThumbUrl ?? null}
                  name={item.viewer?.name}
                  size={40}
                />
                <Text style={{ ...text.body, flex: 1 }} numberOfLines={1}>
                  {[item.viewer?.name, item.viewer?.surname]
                    .filter(Boolean)
                    .join(" ") || t("chat.unknownUser")}
                </Text>
                {item.reaction ? (
                  <Text style={{ fontSize: 18 }}>{item.reaction}</Text>
                ) : null}
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
});
