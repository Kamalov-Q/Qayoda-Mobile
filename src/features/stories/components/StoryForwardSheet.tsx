import { memo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { Avatar, EmptyState } from "@/src/components/ui";
import { toast } from "@/src/components/ui/Toast";
import { errorMessage } from "@/src/lib/api-error";
import { useConversations } from "@/src/features/chat/hooks/useConversations";
import { storiesApi, type Story } from "../api/stories.api";

interface Props {
  story: Story;
  onClose: () => void;
}

/**
 * Passing a story on to a chat.
 *
 * The message is built on the server so that the story's author can be
 * stamped onto it — which is what makes it a forward rather than a
 * re-upload. The chat then renders it like any other forwarded message:
 * "forwarded from <name>", tappable through to their profile.
 */
export const StoryForwardSheet = memo(function StoryForwardSheet({
  story,
  onClose,
}: Props) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { data: conversations, isLoading } = useConversations();
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: (conversationId: string) =>
      storiesApi.forward(story.id, conversationId),
    onSuccess: () => {
      toast.successKey("chat.forwarded");
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => setSendingTo(null),
  });

  return (
    <Modal
      visible
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
          ...shadow.raised,
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
          <Ionicons name="arrow-redo-outline" size={18} color={colors.primary} />
          <Text style={{ ...text.heading, flex: 1 }}>
            {t("stories.forward")}
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator
            style={{ paddingVertical: spacing.xl }}
            color={colors.primary}
          />
        ) : (
          <FlatList
            data={conversations ?? []}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            ListEmptyComponent={
              <EmptyState
                icon="chatbubbles-outline"
                title={t("chat.empty")}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSendingTo(item.id);
                  send.mutate(item.id);
                }}
                disabled={!!sendingTo}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                  opacity: pressed || sendingTo === item.id ? 0.6 : 1,
                })}
              >
                <Avatar
                  uri={item.other.avatarThumbUrl ?? null}
                  name={item.other.name}
                  size={40}
                />
                <Text style={{ ...text.body, flex: 1 }} numberOfLines={1}>
                  {[item.other.name, item.other.surname]
                    .filter(Boolean)
                    .join(" ") || t("chat.unknownUser")}
                </Text>
                {sendingTo === item.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="send-outline"
                    size={17}
                    color={colors.textFaint}
                  />
                )}
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
});
