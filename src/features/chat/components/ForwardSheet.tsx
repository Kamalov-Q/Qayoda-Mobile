// "Send this to…" — the destination picker for a forwarded message.
//
// Support is pinned to the top rather than sorted in with the chats: passing
// something to the desk is the reason most people open this sheet, and it is
// the one destination that is never in the list of recent conversations.
import { useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/src/lib/query-client";
import { Avatar, toast } from "@/src/components/ui";
import { spacing, radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { errorMessage } from "@/src/lib/api-error";
import { chatApi, type Conversation } from "../api/chat.api";
import { supportApi } from "@/src/features/support/api/support.api";
import { useConversations } from "../hooks/useConversations";

interface Props {
  /** The message being passed on; null closes the sheet. */
  messageId: string | null;
  /** Where it came from, so the sheet does not offer to send it back. */
  fromConversationId: string;
  onClose: () => void;
}

export function ForwardSheet({ messageId, fromConversationId, onClose }: Props) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { data: conversations, isLoading } = useConversations();
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async (target: { kind: "support" } | { kind: "chat"; id: string }) => {
      if (target.kind === "support") return supportApi.forward(messageId!);
      return chatApi.forward(target.id, messageId!);
    },
    onSuccess: (_message, target) => {
      // The destination is a screen the sender is not looking at, so nothing
      // else will notice the new message: the support socket is only
      // connected while the support screen is open, and a chat's cache is
      // per-conversation. Whichever one received it gets invalidated here.
      if (target.kind === "support") {
        void queryClient.invalidateQueries({ queryKey: ["support"] });
      } else {
        void queryClient.invalidateQueries({
          queryKey: ["chat", "messages", target.id],
        });
        void queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      }

      toast.successKey("chat.forwarded");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => setSendingTo(null),
  });

  const targets = (conversations ?? []).filter(
    (c) => c.id !== fromConversationId,
  );

  return (
    <Modal
      visible={!!messageId}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        }}
      >
        <Pressable
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
          onPress={onClose}
        />

        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "75%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xxl,
            borderTopRightRadius: radii.xxl,
            borderWidth: 1,
            borderColor: colors.border,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + spacing.md,
            ...shadow.card,
          }}
        >
          <Text style={{ ...text.heading, paddingHorizontal: spacing.lg }}>
            {t("chat.forwardTo")}
          </Text>

          <Row
            icon="shield-checkmark"
            title={t("support.team")}
            subtitle={t("chat.forwardSupportHint")}
            busy={sendingTo === "support"}
            onPress={() => {
              setSendingTo("support");
              send.mutate({ kind: "support" });
            }}
          />

          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginVertical: spacing.sm,
            }}
          />

          {isLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginVertical: spacing.lg }}
            />
          ) : (
            <FlatList<Conversation>
              data={targets}
              keyExtractor={(c) => c.id}
              ListEmptyComponent={
                <Text
                  style={{
                    ...text.caption,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                  }}
                >
                  {t("chat.forwardNoChats")}
                </Text>
              }
              renderItem={({ item }) => (
                <Row
                  avatarUri={item.other.avatarThumbUrl ?? item.other.avatarUrl}
                  title={
                    [item.other.name, item.other.surname]
                      .filter(Boolean)
                      .join(" ") || t("chat.unknownUser")
                  }
                  subtitle={item.listingTitle ?? undefined}
                  busy={sendingTo === item.id}
                  onPress={() => {
                    setSendingTo(item.id);
                    send.mutate({ kind: "chat", id: item.id });
                  }}
                />
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function Row({
  icon,
  avatarUri,
  title,
  subtitle,
  busy,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  avatarUri?: string | null;
  title: string;
  subtitle?: string;
  busy?: boolean;
  onPress: () => void;
}) {
  const { colors, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      {icon ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
      ) : (
        <Avatar uri={avatarUri} name={title} size={40} />
      )}

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.bodyStrong} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={text.caption} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {busy ? <ActivityIndicator color={colors.primary} /> : null}
    </Pressable>
  );
}
